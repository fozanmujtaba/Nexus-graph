"""
Health Check Endpoints
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime

from app.core.config import settings
from app.core.database import (
    async_session_factory,
    Neo4jConnection,
    PineconeConnection,
    RedisConnection,
)

router = APIRouter()


class HealthStatus(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str
    services: dict


@router.get("", response_model=HealthStatus)
async def health_check():
    """Check the health of all services"""
    services = {
        "api": "healthy",
        "postgresql": "unknown",
        "neo4j": "unknown",
        "pinecone": "unknown",
        "redis": "unknown",
    }
    
    # Check PostgreSQL
    try:
        from sqlalchemy import text
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        services["postgresql"] = "healthy"
    except Exception as e:
        services["postgresql"] = f"unhealthy: {str(e)[:50]}"
    
    # Check Neo4j
    try:
        async with Neo4jConnection.session() as session:
            await session.run("RETURN 1")
        services["neo4j"] = "healthy"
    except Exception as e:
        services["neo4j"] = f"unhealthy: {str(e)[:50]}"
    
    # Check Pinecone
    try:
        index = PineconeConnection.get_index()
        index.describe_index_stats()
        services["pinecone"] = "healthy"
    except Exception as e:
        services["pinecone"] = f"unhealthy: {str(e)[:50]}"
    
    # Check Redis
    try:
        client = await RedisConnection.get_client()
        await client.ping()
        services["redis"] = "healthy"
    except Exception as e:
        services["redis"] = f"unhealthy: {str(e)[:50]}"
    
    # Determine overall status
    unhealthy_services = [s for s, status in services.items() if "unhealthy" in status]
    overall_status = "healthy" if not unhealthy_services else "degraded"
    
    return HealthStatus(
        status=overall_status,
        version=settings.app_version,
        timestamp=datetime.utcnow().isoformat(),
        services=services
    )


@router.get("/ready")
async def readiness_check():
    """Kubernetes readiness probe"""
    return {"status": "ready"}


@router.get("/live")
async def liveness_check():
    """Kubernetes liveness probe"""
    return {"status": "alive"}
