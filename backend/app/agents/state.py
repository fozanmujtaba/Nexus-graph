"""
Agent State Definitions
Defines the state schema for LangGraph agent orchestration
"""

from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict
from pydantic import BaseModel, Field
from datetime import datetime


class AgentStatus(str, Enum):
    """Status of an agent in the pipeline"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class AgentType(str, Enum):
    """Types of agents in the system"""
    SWITCHBOARD = "switchboard"
    LIBRARIAN = "librarian"
    ANALYST = "analyst"
    GRAPH_EXPLORER = "graph_explorer"
    CRITIC = "critic"


class SubTask(BaseModel):
    """A sub-task decomposed by the Switchboard agent"""
    id: str
    task_type: str  # "sql", "graph", "vector", "hybrid"
    query: str
    priority: int = 1
    dependencies: List[str] = Field(default_factory=list)
    status: AgentStatus = AgentStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None


class AgentStep(BaseModel):
    """A single step in the agent execution trace"""
    agent: AgentType
    status: AgentStatus
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    input_summary: str = ""
    output_summary: str = ""
    thinking: str = ""  # Agent's reasoning (for Thought-Stream UI)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None


class ValidationResult(BaseModel):
    """Result from the Critic/Validator agent"""
    is_valid: bool
    faithfulness_score: float = 0.0
    relevancy_score: float = 0.0
    coherence_score: float = 0.0
    issues: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class DataResponse(BaseModel):
    """Structured data response for UI rendering"""
    response_type: str  # "table", "graph", "text", "chart", "mixed"
    content: Any
    metadata: Dict[str, Any] = Field(default_factory=dict)
    

class AgentState(TypedDict, total=False):
    """
    The shared state passed through the LangGraph workflow.
    This is the central state schema for all agents.
    """
    # User input
    user_query: str
    conversation_id: str
    session_id: str
    
    # Query understanding
    intent: str
    intent_confidence: float
    decomposed_tasks: List[SubTask]
    
    # Agent execution trace (for Thought-Stream UI)
    execution_trace: List[AgentStep]
    current_agent: AgentType
    
    # Retrieved context
    vector_results: List[Dict[str, Any]]
    graph_results: List[Dict[str, Any]]
    sql_results: List[Dict[str, Any]]
    
    # Synthesized response
    synthesized_answer: str
    data_response: DataResponse
    
    # Validation
    validation: ValidationResult
    needs_retry: bool
    retry_count: int
    max_retries: int
    
    # Metadata
    sources: List[Dict[str, Any]]
    processing_time_ms: float
    error: Optional[str]
    
    # Streaming
    is_streaming: bool
    stream_tokens: List[str]


def create_initial_state(
    user_query: str,
    conversation_id: str = "",
    session_id: str = ""
) -> AgentState:
    """Create initial state for a new query"""
    return AgentState(
        user_query=user_query,
        conversation_id=conversation_id,
        session_id=session_id,
        intent="",
        intent_confidence=0.0,
        decomposed_tasks=[],
        execution_trace=[],
        current_agent=AgentType.SWITCHBOARD,
        vector_results=[],
        graph_results=[],
        sql_results=[],
        synthesized_answer="",
        data_response=None,
        validation=None,
        needs_retry=False,
        retry_count=0,
        max_retries=3,
        sources=[],
        processing_time_ms=0.0,
        error=None,
        is_streaming=False,
        stream_tokens=[],
    )
