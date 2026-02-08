"""
API Routes
Central router combining all API endpoints
"""

from fastapi import APIRouter
from .chat import router as chat_router
from .ingest import router as ingest_router
from .health import router as health_router

api_router = APIRouter()

# Include sub-routers
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(chat_router, prefix="/chat", tags=["Chat"])
api_router.include_router(ingest_router, prefix="/ingest", tags=["Ingestion"])
