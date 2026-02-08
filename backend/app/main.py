"""
FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.core.database import init_databases, close_databases
from app.api import api_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("🚀 Starting Nexus-Graph API...")
    
    # Startup
    try:
        await init_databases()
        logger.info("✅ All systems initialized")
    except Exception as e:
        logger.error("❌ Startup failed", error=str(e))
        # Continue anyway for development
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Nexus-Graph API...")
    await close_databases()
    logger.info("👋 Goodbye!")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
# 🔮 Nexus-Graph API

A **Hybrid-Graph RAG System** with intelligent agent orchestration.

## Features

- **🧠 Intelligent Agents**: Switchboard agent routes queries to specialized sub-agents
- **📊 Hybrid Storage**: Neo4j (Graph) + Pinecone (Vector) + PostgreSQL (Relational)
- **📄 Multimodal Ingestion**: Parse PDFs, tables, and diagrams with Unstructured.io
- **✅ Self-Correction**: Validator agent ensures response quality

## Endpoints

- `/api/v1/chat` - Chat with the AI agents
- `/api/v1/ingest` - Upload and process documents
- `/api/v1/health` - Service health checks
    """,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


# Root redirect to docs
@app.get("/", include_in_schema=False)
async def root():
    """Redirect to API documentation"""
    return RedirectResponse(url="/docs")


# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    from fastapi.openapi.utils import get_openapi
    
    openapi_schema = get_openapi(
        title=settings.app_name,
        version=settings.app_version,
        description=app.description,
        routes=app.routes,
    )
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    # Add server URLs
    openapi_schema["servers"] = [
        {"url": "http://localhost:8000", "description": "Development"},
        {"url": "https://api.nexus-graph.ai", "description": "Production"}
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else settings.workers
    )
