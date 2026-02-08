"""
Semantic Router
Classifies user intent and routes queries to appropriate agents/tools
"""

from typing import Dict, List, Optional, Tuple
from enum import Enum

from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class QueryIntent(str, Enum):
    """Possible query intents"""
    SQL_QUERY = "sql_query"           # Structured data, aggregations, filtering
    GRAPH_QUERY = "graph_query"       # Relationships, paths, entity connections
    VECTOR_SEARCH = "vector_search"   # Semantic similarity, document retrieval
    HYBRID_QUERY = "hybrid_query"     # Combination of multiple methods
    CLARIFICATION = "clarification"   # Query needs clarification
    CHITCHAT = "chitchat"             # General conversation


class SubTaskType(str, Enum):
    """Types of sub-tasks for decomposition"""
    RETRIEVE_DOCUMENTS = "retrieve_documents"
    QUERY_DATABASE = "query_database"
    EXPLORE_RELATIONSHIPS = "explore_relationships"
    AGGREGATE_DATA = "aggregate_data"
    COMPARE_ENTITIES = "compare_entities"
    SUMMARIZE = "summarize"


class IntentClassification(BaseModel):
    """Result of intent classification"""
    primary_intent: QueryIntent = Field(
        description="The primary intent of the user's query"
    )
    confidence: float = Field(
        description="Confidence score between 0 and 1"
    )
    reasoning: str = Field(
        description="Brief explanation of why this intent was chosen"
    )
    suggested_tools: List[str] = Field(
        description="List of tool names to use for this query"
    )


class DecomposedTask(BaseModel):
    """A single decomposed sub-task"""
    task_id: str
    task_type: SubTaskType
    description: str
    tool_to_use: str
    query_params: Dict
    priority: int = Field(default=1, ge=1, le=5)
    depends_on: List[str] = Field(default_factory=list)


class QueryDecomposition(BaseModel):
    """Full query decomposition result"""
    original_query: str
    requires_decomposition: bool
    tasks: List[DecomposedTask]
    execution_strategy: str = Field(
        description="'sequential', 'parallel', or 'hybrid'"
    )
    reasoning: str


class SemanticRouter:
    """
    Routes user queries to appropriate agents based on semantic understanding.
    Uses LLM-based classification with fallback patterns.
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            temperature=0.1,  # Low temperature for consistent classification
        )
        self._setup_prompts()
    
    def _setup_prompts(self):
        """Initialize classification prompts"""
        
        # Intent classification prompt
        self.intent_parser = PydanticOutputParser(pydantic_object=IntentClassification)
        
        self.intent_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an intent classifier for a hybrid RAG system.
Analyze the user's query and determine the best approach to answer it.

Available tools:
- query_sql: For structured data queries, aggregations, counts, filtering database tables
- search_graph: For relationship queries, finding connections between entities, path exploration
- vector_retrieval: For semantic search, finding similar documents, content-based queries
- hybrid_search: When multiple approaches are needed

Intent types:
- sql_query: Questions about specific data, numbers, lists, filtered results
- graph_query: Questions about relationships, connections, hierarchies
- vector_search: Questions requiring semantic understanding, similarity
- hybrid_query: Complex questions requiring multiple data sources
- clarification: Query is ambiguous and needs more information
- chitchat: General conversation, greetings, not related to data

{format_instructions}"""),
            ("human", "Query: {query}\n\nContext (if any): {context}")
        ])
        
        # Query decomposition prompt
        self.decomposition_parser = PydanticOutputParser(pydantic_object=QueryDecomposition)
        
        self.decomposition_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a query planner for a hybrid RAG system.
Decompose complex queries into executable sub-tasks.

Available tools and when to use them:
1. vector_retrieval - Semantic search in document chunks
2. search_graph - Cypher queries for entity relationships
3. query_sql - SQL queries for structured data
4. hybrid_search - Combined vector + graph search

Task types:
- retrieve_documents: Get relevant document chunks
- query_database: Execute structured SQL query
- explore_relationships: Find entity connections
- aggregate_data: Perform calculations/aggregations
- compare_entities: Compare multiple entities
- summarize: Synthesize information

{format_instructions}"""),
            ("human", "Query: {query}")
        ])
    
    async def classify_intent(
        self, 
        query: str, 
        context: str = ""
    ) -> IntentClassification:
        """Classify the intent of a user query"""
        logger.info("Classifying query intent", query=query[:50])
        
        try:
            chain = self.intent_prompt | self.llm | self.intent_parser
            
            result = await chain.ainvoke({
                "query": query,
                "context": context,
                "format_instructions": self.intent_parser.get_format_instructions()
            })
            
            logger.info(
                "Intent classified",
                intent=result.primary_intent,
                confidence=result.confidence
            )
            
            return result
            
        except Exception as e:
            logger.error("Intent classification failed", error=str(e))
            # Fallback to hybrid query for safety
            return IntentClassification(
                primary_intent=QueryIntent.HYBRID_QUERY,
                confidence=0.5,
                reasoning=f"Classification failed: {str(e)}. Defaulting to hybrid approach.",
                suggested_tools=["hybrid_search", "vector_retrieval"]
            )
    
    async def decompose_query(self, query: str) -> QueryDecomposition:
        """Decompose a complex query into sub-tasks"""
        logger.info("Decomposing query", query=query[:50])
        
        try:
            chain = self.decomposition_prompt | self.llm | self.decomposition_parser
            
            result = await chain.ainvoke({
                "query": query,
                "format_instructions": self.decomposition_parser.get_format_instructions()
            })
            
            logger.info(
                "Query decomposed",
                task_count=len(result.tasks),
                strategy=result.execution_strategy
            )
            
            return result
            
        except Exception as e:
            logger.error("Query decomposition failed", error=str(e))
            # Fallback to single hybrid search task
            return QueryDecomposition(
                original_query=query,
                requires_decomposition=False,
                tasks=[
                    DecomposedTask(
                        task_id="task_1",
                        task_type=SubTaskType.RETRIEVE_DOCUMENTS,
                        description="Retrieve relevant information",
                        tool_to_use="hybrid_search",
                        query_params={"query": query},
                        priority=1
                    )
                ],
                execution_strategy="sequential",
                reasoning=f"Decomposition failed: {str(e)}. Using single hybrid search."
            )
    
    async def route_query(
        self, 
        query: str, 
        context: str = ""
    ) -> Tuple[IntentClassification, Optional[QueryDecomposition]]:
        """
        Full routing pipeline: classify intent and decompose if needed.
        
        Returns:
            Tuple of (IntentClassification, Optional[QueryDecomposition])
        """
        # First, classify the intent
        intent = await self.classify_intent(query, context)
        
        decomposition = None
        
        # Decompose complex queries
        if intent.primary_intent in [QueryIntent.HYBRID_QUERY]:
            decomposition = await self.decompose_query(query)
        elif intent.confidence < 0.7:
            # Low confidence - try decomposition for better understanding
            decomposition = await self.decompose_query(query)
        
        return intent, decomposition


# Singleton instance
_router: Optional[SemanticRouter] = None


def get_router() -> SemanticRouter:
    """Get or create the semantic router instance"""
    global _router
    if _router is None:
        _router = SemanticRouter()
    return _router
