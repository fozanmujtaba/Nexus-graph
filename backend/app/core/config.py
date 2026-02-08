"""
Application Configuration
Manages all environment variables and settings using Pydantic Settings
"""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    app_name: str = "Nexus-Graph"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    
    # CORS
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    
    # LLM Configuration
    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"
    gemini_api_key: str = ""
    
    # Pinecone (Vector Database)
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1"
    pinecone_index: str = "nexus-graph"
    pinecone_dimension: int = 1536
    
    # Neo4j (Graph Database)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    
    # PostgreSQL
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/nexus_graph"
    
    # Supabase (optional)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    
    # Unstructured.io
    unstructured_api_key: str = ""
    unstructured_api_url: str = "https://api.unstructured.io/general/v0/general"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # JWT Authentication
    jwt_secret: str = "your-super-secret-jwt-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Logging
    log_level: str = "INFO"
    
    # File Upload
    max_upload_size_mb: int = 100
    allowed_extensions: List[str] = Field(
        default=[".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md"]
    )
    upload_dir: str = "./uploads"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
