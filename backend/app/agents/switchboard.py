"""
Switchboard Agent
The main orchestrator that coordinates all sub-agents using LangGraph
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Literal
from datetime import datetime
import uuid

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.core.config import settings
from app.core.logging import get_logger
from .state import (
    AgentState,
    AgentStep,
    AgentType,
    AgentStatus,
    SubTask,
    DataResponse,
    create_initial_state,
)
from .router import get_router, QueryIntent
from .validator import get_validator
from .tools import AVAILABLE_TOOLS, TOOL_MAPPING

logger = get_logger(__name__)


class SwitchboardAgent:
    """
    The Switchboard Agent is the main orchestrator for the Nexus-Graph system.
    It uses LangGraph to coordinate sub-agents and manage the query lifecycle.
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            temperature=0.3,
        )
        self.router = get_router()
        self.validator = get_validator()
        self.memory = MemorySaver()
        self.graph = self._build_graph()
        
        # Synthesis prompt
        self.synthesis_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert analyst synthesizing information from multiple sources.

Your task:
1. Integrate information from vector search, graph queries, and SQL results
2. Provide a comprehensive, accurate answer
3. Cite sources when possible
4. Format data appropriately (tables for structured data, narratives for explanations)

Guidelines:
- Be concise but thorough
- Acknowledge limitations or gaps in the data
- Suggest follow-up questions if relevant
- Use markdown formatting for clarity"""),
            ("human", """Question: {question}

Vector Search Results:
{vector_results}

Graph Query Results:
{graph_results}

SQL Query Results:
{sql_results}

Synthesize a comprehensive answer:""")
        ])
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        
        # Create the state graph
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("route", self._route_node)
        workflow.add_node("librarian", self._librarian_node)
        workflow.add_node("analyst", self._analyst_node)
        workflow.add_node("graph_explorer", self._graph_explorer_node)
        workflow.add_node("synthesize", self._synthesize_node)
        workflow.add_node("validate", self._validate_node)
        workflow.add_node("retry", self._retry_node)
        
        # Set entry point
        workflow.set_entry_point("route")
        
        # Add conditional edges from router
        workflow.add_conditional_edges(
            "route",
            self._route_decision,
            {
                "librarian": "librarian",
                "analyst": "analyst",
                "graph_explorer": "graph_explorer",
                "parallel": "librarian",  # Start parallel execution
                "end": END,
            }
        )
        
        # Add edges from worker nodes to synthesize
        workflow.add_edge("librarian", "synthesize")
        workflow.add_edge("analyst", "synthesize")
        workflow.add_edge("graph_explorer", "synthesize")
        
        # Synthesize to validate
        workflow.add_edge("synthesize", "validate")
        
        # Validation conditional edge
        workflow.add_conditional_edges(
            "validate",
            self._validation_decision,
            {
                "pass": END,
                "retry": "retry",
                "end": END,
            }
        )
        
        # Retry loops back to appropriate node
        workflow.add_conditional_edges(
            "retry",
            self._retry_decision,
            {
                "librarian": "librarian",
                "analyst": "analyst",
                "graph_explorer": "graph_explorer",
                "synthesize": "synthesize",
                "end": END,
            }
        )
        
        return workflow.compile(checkpointer=self.memory)
    
    def _add_step(
        self,
        state: AgentState,
        agent: AgentType,
        status: AgentStatus,
        thinking: str = "",
        output_summary: str = "",
        tool_calls: List[Dict] = None
    ) -> AgentStep:
        """Add a step to the execution trace"""
        step = AgentStep(
            agent=agent,
            status=status,
            thinking=thinking,
            output_summary=output_summary,
            tool_calls=tool_calls or []
        )
        
        if "execution_trace" not in state:
            state["execution_trace"] = []
        state["execution_trace"].append(step)
        
        return step
    
    async def _route_node(self, state: AgentState) -> AgentState:
        """Route the query to appropriate agents"""
        logger.info("Routing query", query=state["user_query"][:50])
        
        self._add_step(
            state,
            AgentType.SWITCHBOARD,
            AgentStatus.RUNNING,
            thinking="Analyzing query intent and determining the best approach..."
        )
        
        # Classify intent and decompose if needed
        intent, decomposition = await self.router.route_query(state["user_query"])
        
        state["intent"] = intent.primary_intent.value
        state["intent_confidence"] = intent.confidence
        
        if decomposition:
            state["decomposed_tasks"] = [
                SubTask(
                    id=task.task_id,
                    task_type=task.task_type.value,
                    query=task.description,
                    priority=task.priority,
                    dependencies=task.depends_on
                )
                for task in decomposition.tasks
            ]
        
        # Update step with completion
        if state["execution_trace"]:
            state["execution_trace"][-1].status = AgentStatus.COMPLETED
            state["execution_trace"][-1].completed_at = datetime.utcnow()
            state["execution_trace"][-1].output_summary = (
                f"Intent: {intent.primary_intent.value} "
                f"(confidence: {intent.confidence:.2f})"
            )
        
        return state
    
    def _route_decision(self, state: AgentState) -> str:
        """Decide which agent(s) to invoke based on routing"""
        intent = state.get("intent", "")
        
        if intent == QueryIntent.SQL_QUERY.value:
            return "analyst"
        elif intent == QueryIntent.GRAPH_QUERY.value:
            return "graph_explorer"
        elif intent == QueryIntent.VECTOR_SEARCH.value:
            return "librarian"
        elif intent == QueryIntent.HYBRID_QUERY.value:
            return "parallel"  # Will execute all in sequence
        elif intent == QueryIntent.CHITCHAT.value:
            # Handle chitchat directly
            state["synthesized_answer"] = "I'm here to help you explore your data. Ask me about documents, relationships, or specific data queries!"
            return "end"
        else:
            return "librarian"  # Default to vector search
    
    async def _librarian_node(self, state: AgentState) -> AgentState:
        """Librarian agent: handles vector search and document retrieval"""
        logger.info("Librarian agent starting")
        
        self._add_step(
            state,
            AgentType.LIBRARIAN,
            AgentStatus.RUNNING,
            thinking="Searching for semantically similar documents in the knowledge base..."
        )
        
        try:
            # Execute vector search
            from .tools import vector_retrieval
            
            result = await vector_retrieval.ainvoke({
                "query": state["user_query"],
                "top_k": 10
            })
            
            if result.get("success"):
                state["vector_results"] = result.get("matches", [])
                output = f"Found {len(state['vector_results'])} relevant documents"
            else:
                state["vector_results"] = []
                output = f"Search failed: {result.get('error', 'Unknown error')}"
            
            # Update step
            if state["execution_trace"]:
                step = state["execution_trace"][-1]
                step.status = AgentStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.output_summary = output
                step.tool_calls = [{"tool": "vector_retrieval", "result": result}]
                
        except Exception as e:
            logger.error("Librarian agent failed", error=str(e))
            state["vector_results"] = []
            if state["execution_trace"]:
                state["execution_trace"][-1].status = AgentStatus.FAILED
                state["execution_trace"][-1].error = str(e)
        
        return state
    
    async def _analyst_node(self, state: AgentState) -> AgentState:
        """Analyst agent: handles SQL queries and structured data"""
        logger.info("Analyst agent starting")
        
        self._add_step(
            state,
            AgentType.ANALYST,
            AgentStatus.RUNNING,
            thinking="Analyzing query to generate appropriate SQL..."
        )
        
        try:
            # Generate SQL from natural language
            sql_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are a SQL expert. Convert the user's question into a SQL query.
Only output the SQL query, nothing else. Use standard PostgreSQL syntax."""),
                ("human", "{question}")
            ])
            
            sql_chain = sql_prompt | self.llm
            sql_response = await sql_chain.ainvoke({"question": state["user_query"]})
            sql_query = sql_response.content.strip()
            
            # Execute the SQL
            from .tools import query_sql
            
            result = await query_sql.ainvoke({
                "query": sql_query
            })
            
            if result.get("success"):
                state["sql_results"] = result.get("rows", [])
                output = f"Retrieved {result.get('row_count', 0)} rows"
            else:
                state["sql_results"] = []
                output = f"Query failed: {result.get('error', 'Unknown error')}"
            
            # Update step
            if state["execution_trace"]:
                step = state["execution_trace"][-1]
                step.status = AgentStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.output_summary = output
                step.tool_calls = [{"tool": "query_sql", "query": sql_query, "result": result}]
                
        except Exception as e:
            logger.error("Analyst agent failed", error=str(e))
            state["sql_results"] = []
            if state["execution_trace"]:
                state["execution_trace"][-1].status = AgentStatus.FAILED
                state["execution_trace"][-1].error = str(e)
        
        return state
    
    async def _graph_explorer_node(self, state: AgentState) -> AgentState:
        """Graph Explorer agent: handles Neo4j relationship queries"""
        logger.info("Graph Explorer agent starting")
        
        self._add_step(
            state,
            AgentType.GRAPH_EXPLORER,
            AgentStatus.RUNNING,
            thinking="Exploring entity relationships and connections..."
        )
        
        try:
            # Generate Cypher from natural language
            cypher_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are a Neo4j Cypher expert. Convert the user's question into a Cypher query.
Only output the Cypher query, nothing else. Use standard Cypher syntax."""),
                ("human", "{question}")
            ])
            
            cypher_chain = cypher_prompt | self.llm
            cypher_response = await cypher_chain.ainvoke({"question": state["user_query"]})
            cypher_query = cypher_response.content.strip()
            
            # Execute the Cypher query
            from .tools import search_graph
            
            result = await search_graph.ainvoke({
                "cypher_query": cypher_query
            })
            
            if result.get("success"):
                state["graph_results"] = result.get("records", [])
                output = (
                    f"Found {len(result.get('nodes', []))} nodes and "
                    f"{len(result.get('relationships', []))} relationships"
                )
            else:
                state["graph_results"] = []
                output = f"Query failed: {result.get('error', 'Unknown error')}"
            
            # Update step
            if state["execution_trace"]:
                step = state["execution_trace"][-1]
                step.status = AgentStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.output_summary = output
                step.tool_calls = [{"tool": "search_graph", "query": cypher_query, "result": result}]
                
        except Exception as e:
            logger.error("Graph Explorer agent failed", error=str(e))
            state["graph_results"] = []
            if state["execution_trace"]:
                state["execution_trace"][-1].status = AgentStatus.FAILED
                state["execution_trace"][-1].error = str(e)
        
        return state
    
    async def _synthesize_node(self, state: AgentState) -> AgentState:
        """Synthesize results from all agents into a coherent response"""
        logger.info("Synthesizing results")
        
        self._add_step(
            state,
            AgentType.SWITCHBOARD,
            AgentStatus.RUNNING,
            thinking="Synthesizing information from all sources into a coherent answer..."
        )
        
        try:
            # Format results for synthesis
            vector_text = self._format_vector_results(state.get("vector_results", []))
            graph_text = self._format_graph_results(state.get("graph_results", []))
            sql_text = self._format_sql_results(state.get("sql_results", []))
            
            # Synthesize
            chain = self.synthesis_prompt | self.llm
            response = await chain.ainvoke({
                "question": state["user_query"],
                "vector_results": vector_text or "No vector results",
                "graph_results": graph_text or "No graph results",
                "sql_results": sql_text or "No SQL results"
            })
            
            state["synthesized_answer"] = response.content
            
            # Determine response type for UI
            state["data_response"] = self._determine_response_type(state)
            
            # Update step
            if state["execution_trace"]:
                step = state["execution_trace"][-1]
                step.status = AgentStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.output_summary = f"Generated {len(response.content)} character response"
                
        except Exception as e:
            logger.error("Synthesis failed", error=str(e))
            state["synthesized_answer"] = "I was unable to synthesize a response. Please try rephrasing your question."
            if state["execution_trace"]:
                state["execution_trace"][-1].status = AgentStatus.FAILED
                state["execution_trace"][-1].error = str(e)
        
        return state
    
    async def _validate_node(self, state: AgentState) -> AgentState:
        """Validate the synthesized response"""
        logger.info("Validating response")
        
        self._add_step(
            state,
            AgentType.CRITIC,
            AgentStatus.RUNNING,
            thinking="Checking response for faithfulness, relevancy, and coherence..."
        )
        
        try:
            # Compile context from all sources
            context = "\n".join([
                self._format_vector_results(state.get("vector_results", [])),
                self._format_graph_results(state.get("graph_results", [])),
                self._format_sql_results(state.get("sql_results", []))
            ])
            
            validation = await self.validator.validate(
                answer=state["synthesized_answer"],
                question=state["user_query"],
                context=context
            )
            
            state["validation"] = validation
            state["needs_retry"] = not validation.is_valid
            
            # Update step
            if state["execution_trace"]:
                step = state["execution_trace"][-1]
                step.status = AgentStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.output_summary = (
                    f"Valid: {validation.is_valid} | "
                    f"Faithfulness: {validation.faithfulness_score:.2f} | "
                    f"Relevancy: {validation.relevancy_score:.2f}"
                )
                
        except Exception as e:
            logger.error("Validation failed", error=str(e))
            # Fail open - accept the response
            state["needs_retry"] = False
            if state["execution_trace"]:
                state["execution_trace"][-1].status = AgentStatus.FAILED
                state["execution_trace"][-1].error = str(e)
        
        return state
    
    def _validation_decision(self, state: AgentState) -> str:
        """Decide whether to pass, retry, or end based on validation"""
        if not state.get("needs_retry", False):
            return "pass"
        
        retry_count = state.get("retry_count", 0)
        max_retries = state.get("max_retries", 3)
        
        if retry_count >= max_retries:
            logger.warning("Max retries reached, accepting current response")
            return "end"
        
        return "retry"
    
    async def _retry_node(self, state: AgentState) -> AgentState:
        """Prepare for retry based on validation feedback"""
        state["retry_count"] = state.get("retry_count", 0) + 1
        
        validation = state.get("validation")
        if validation:
            # Add suggestions to context for improvement
            logger.info(
                "Retrying with feedback",
                retry_count=state["retry_count"],
                issues=validation.issues
            )
        
        return state
    
    def _retry_decision(self, state: AgentState) -> str:
        """Decide what to retry based on validation issues"""
        validation = state.get("validation")
        
        if not validation:
            return "synthesize"
        
        # If faithfulness is low, we need more/better retrieval
        if validation.faithfulness_score < 0.5:
            return "librarian"
        
        # If relevancy is low, we need better synthesis
        if validation.relevancy_score < 0.5:
            return "synthesize"
        
        # Default to re-synthesis
        return "synthesize"
    
    def _format_vector_results(self, results: List[Dict]) -> str:
        """Format vector search results for synthesis"""
        if not results:
            return ""
        
        formatted = []
        for i, result in enumerate(results[:5]):  # Limit to top 5
            metadata = result.get("metadata", {})
            text = metadata.get("text", metadata.get("content", ""))
            source = metadata.get("source", "Unknown")
            formatted.append(f"[{i+1}] ({source}): {text[:500]}")
        
        return "\n\n".join(formatted)
    
    def _format_graph_results(self, results: List[Dict]) -> str:
        """Format graph query results for synthesis"""
        if not results:
            return ""
        
        return "\n".join([str(r) for r in results[:10]])
    
    def _format_sql_results(self, results: List[Dict]) -> str:
        """Format SQL query results for synthesis"""
        if not results:
            return ""
        
        if len(results) > 10:
            return f"Table with {len(results)} rows. First 10 rows:\n" + str(results[:10])
        return str(results)
    
    def _determine_response_type(self, state: AgentState) -> DataResponse:
        """Determine the appropriate response type for UI rendering"""
        sql_results = state.get("sql_results", [])
        graph_results = state.get("graph_results", [])
        
        # If we have SQL tabular data
        if sql_results and len(sql_results) > 1:
            return DataResponse(
                response_type="table",
                content=sql_results,
                metadata={"columns": list(sql_results[0].keys()) if sql_results else []}
            )
        
        # If we have graph relationships
        if graph_results:
            return DataResponse(
                response_type="graph",
                content=graph_results,
                metadata={}
            )
        
        # Default to text
        return DataResponse(
            response_type="text",
            content=state.get("synthesized_answer", ""),
            metadata={}
        )
    
    async def process_query(
        self,
        query: str,
        conversation_id: str = "",
        session_id: str = "",
        stream: bool = False
    ) -> AgentState:
        """
        Process a user query through the agent pipeline.
        
        Args:
            query: The user's natural language query
            conversation_id: Optional conversation ID for context
            session_id: Optional session ID for context
            stream: Whether to stream the response
            
        Returns:
            Final AgentState with results
        """
        start_time = time.time()
        
        # Create initial state
        state = create_initial_state(query, conversation_id, session_id)
        state["is_streaming"] = stream
        
        # Generate unique thread ID for this conversation
        thread_id = conversation_id or str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}
        
        try:
            # Run the graph
            final_state = await self.graph.ainvoke(state, config)
            
            # Calculate processing time
            final_state["processing_time_ms"] = (time.time() - start_time) * 1000
            
            logger.info(
                "Query processed",
                processing_time_ms=final_state["processing_time_ms"],
                steps=len(final_state.get("execution_trace", []))
            )
            
            return final_state
            
        except Exception as e:
            logger.error("Query processing failed", error=str(e))
            state["error"] = str(e)
            state["processing_time_ms"] = (time.time() - start_time) * 1000
            return state


# Singleton instance
_switchboard: Optional[SwitchboardAgent] = None


def get_switchboard() -> SwitchboardAgent:
    """Get or create the switchboard agent instance"""
    global _switchboard
    if _switchboard is None:
        _switchboard = SwitchboardAgent()
    return _switchboard
