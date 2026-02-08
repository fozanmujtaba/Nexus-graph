"""
Chat API Endpoints
Handles real-time chat with the Switchboard Agent
"""

import asyncio
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.core.logging import get_logger
from app.agents.switchboard import get_switchboard
from app.agents.state import AgentState, AgentStep, AgentType, AgentStatus

logger = get_logger(__name__)
router = APIRouter()


# ============================================
# Request/Response Models
# ============================================

class ChatMessage(BaseModel):
    """A single chat message"""
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    """Chat request payload"""
    message: str
    conversation_id: Optional[str] = None
    session_id: Optional[str] = None
    stream: bool = False


class AgentStepResponse(BaseModel):
    """Agent step for frontend visualization"""
    agent: str
    status: str
    thinking: str
    output_summary: str
    started_at: str
    completed_at: Optional[str] = None
    tool_calls: List[Dict[str, Any]] = []


class DataResponseModel(BaseModel):
    """Structured data response"""
    response_type: str
    content: Any
    metadata: Dict[str, Any] = {}


class ChatResponse(BaseModel):
    """Chat response payload"""
    message: str
    conversation_id: str
    data: Optional[DataResponseModel] = None
    execution_trace: List[AgentStepResponse] = []
    sources: List[Dict[str, Any]] = []
    processing_time_ms: float
    validation: Optional[Dict[str, Any]] = None


# ============================================
# Active WebSocket Connections
# ============================================

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info("WebSocket connected", client_id=client_id)
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info("WebSocket disconnected", client_id=client_id)
    
    async def send_step_update(self, client_id: str, step: AgentStep):
        """Send agent step update to client"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json({
                    "type": "step_update",
                    "data": {
                        "agent": step.agent.value,
                        "status": step.status.value,
                        "thinking": step.thinking,
                        "output_summary": step.output_summary,
                        "started_at": step.started_at.isoformat() if step.started_at else None,
                        "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                    }
                })
            except Exception as e:
                logger.error("Failed to send step update", error=str(e))
    
    async def send_token(self, client_id: str, token: str):
        """Send streaming token to client"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json({
                    "type": "token",
                    "data": token
                })
            except Exception as e:
                logger.error("Failed to send token", error=str(e))


manager = ConnectionManager()


# ============================================
# REST Endpoints
# ============================================

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat message through the Switchboard Agent.
    
    Returns the complete response with execution trace for UI visualization.
    """
    logger.info("Processing chat request", message=request.message[:50])
    
    # Generate conversation ID if not provided
    conversation_id = request.conversation_id or str(uuid.uuid4())
    
    try:
        switchboard = get_switchboard()
        
        # Process the query
        result = await switchboard.process_query(
            query=request.message,
            conversation_id=conversation_id,
            session_id=request.session_id or "",
            stream=request.stream
        )
        
        # Format execution trace
        execution_trace = []
        for step in result.get("execution_trace", []):
            if isinstance(step, dict):
                execution_trace.append(AgentStepResponse(**step))
            else:
                execution_trace.append(AgentStepResponse(
                    agent=step.agent.value if hasattr(step.agent, 'value') else str(step.agent),
                    status=step.status.value if hasattr(step.status, 'value') else str(step.status),
                    thinking=step.thinking,
                    output_summary=step.output_summary,
                    started_at=step.started_at.isoformat() if step.started_at else "",
                    completed_at=step.completed_at.isoformat() if step.completed_at else None,
                    tool_calls=step.tool_calls
                ))
        
        # Format data response
        data_response = None
        if result.get("data_response"):
            dr = result["data_response"]
            if isinstance(dr, dict):
                data_response = DataResponseModel(**dr)
            else:
                data_response = DataResponseModel(
                    response_type=dr.response_type,
                    content=dr.content,
                    metadata=dr.metadata
                )
        
        # Format validation
        validation = None
        if result.get("validation"):
            v = result["validation"]
            if isinstance(v, dict):
                validation = v
            else:
                validation = {
                    "is_valid": v.is_valid,
                    "faithfulness_score": v.faithfulness_score,
                    "relevancy_score": v.relevancy_score,
                    "coherence_score": v.coherence_score,
                    "issues": v.issues,
                    "suggestions": v.suggestions
                }
        
        return ChatResponse(
            message=result.get("synthesized_answer", ""),
            conversation_id=conversation_id,
            data=data_response,
            execution_trace=execution_trace,
            sources=result.get("sources", []),
            processing_time_ms=result.get("processing_time_ms", 0),
            validation=validation
        )
        
    except Exception as e:
        logger.error("Chat processing failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat response using Server-Sent Events.
    
    Events:
    - step: Agent step updates
    - token: Response tokens
    - data: Structured data response
    - done: Completion signal
    """
    
    async def event_generator():
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        try:
            switchboard = get_switchboard()
            
            # Send conversation ID
            yield {
                "event": "start",
                "data": json.dumps({"conversation_id": conversation_id})
            }
            
            # Process query
            result = await switchboard.process_query(
                query=request.message,
                conversation_id=conversation_id,
                session_id=request.session_id or "",
                stream=True
            )
            
            # Send execution trace steps
            for step in result.get("execution_trace", []):
                step_data = {
                    "agent": step.agent.value if hasattr(step.agent, 'value') else str(step.agent),
                    "status": step.status.value if hasattr(step.status, 'value') else str(step.status),
                    "thinking": step.thinking,
                    "output_summary": step.output_summary,
                }
                yield {
                    "event": "step",
                    "data": json.dumps(step_data)
                }
            
            # Send response
            yield {
                "event": "message",
                "data": json.dumps({"content": result.get("synthesized_answer", "")})
            }
            
            # Send data if available
            if result.get("data_response"):
                dr = result["data_response"]
                yield {
                    "event": "data",
                    "data": json.dumps({
                        "response_type": dr.response_type,
                        "content": dr.content,
                        "metadata": dr.metadata
                    })
                }
            
            # Send completion
            yield {
                "event": "done",
                "data": json.dumps({
                    "processing_time_ms": result.get("processing_time_ms", 0)
                })
            }
            
        except Exception as e:
            logger.error("Stream processing failed", error=str(e))
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }
    
    return EventSourceResponse(event_generator())


# ============================================
# WebSocket Endpoint
# ============================================

@router.websocket("/ws/{client_id}")
async def websocket_chat(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time bidirectional chat.
    
    Provides real-time updates for:
    - Agent step progress (Thought-Stream)
    - Streaming tokens
    - Data responses
    """
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            message = data.get("message", "")
            conversation_id = data.get("conversation_id", str(uuid.uuid4()))
            
            if not message:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "Empty message"}
                })
                continue
            
            # Send acknowledgment
            await websocket.send_json({
                "type": "ack",
                "data": {"conversation_id": conversation_id}
            })
            
            try:
                switchboard = get_switchboard()
                
                # Process query
                result = await switchboard.process_query(
                    query=message,
                    conversation_id=conversation_id,
                    stream=True
                )
                
                # Send execution trace
                for step in result.get("execution_trace", []):
                    await manager.send_step_update(client_id, step)
                
                # Send final response
                await websocket.send_json({
                    "type": "response",
                    "data": {
                        "message": result.get("synthesized_answer", ""),
                        "data": result.get("data_response"),
                        "processing_time_ms": result.get("processing_time_ms", 0)
                    }
                })
                
            except Exception as e:
                logger.error("WebSocket query processing failed", error=str(e))
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": str(e)}
                })
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(client_id)
