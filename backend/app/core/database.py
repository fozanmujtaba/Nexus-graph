"""
Database Connections & Session Management
Manages connections to PostgreSQL, Neo4j, Pinecone, and Redis
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from neo4j import AsyncGraphDatabase, AsyncDriver
from pinecone import Pinecone
import redis.asyncio as redis

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


# ============================================
# SQLAlchemy Base & Engine
# ============================================

class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models"""
    pass


# Async engine for PostgreSQL
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ============================================
# Neo4j Graph Database
# ============================================

class Neo4jConnection:
    """Neo4j async driver wrapper"""
    
    _driver: Optional[AsyncDriver] = None
    
    @classmethod
    async def get_driver(cls) -> AsyncDriver:
        """Get or create Neo4j driver"""
        if cls._driver is None:
            cls._driver = AsyncGraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )
            logger.info("Neo4j connection established")
        return cls._driver
    
    @classmethod
    async def close(cls) -> None:
        """Close Neo4j driver"""
        if cls._driver is not None:
            await cls._driver.close()
            cls._driver = None
            logger.info("Neo4j connection closed")
    
    @classmethod
    @asynccontextmanager
    async def session(cls):
        """Get a Neo4j session context manager"""
        driver = await cls.get_driver()
        async with driver.session() as session:
            yield session


async def get_neo4j_session():
    """Dependency to get Neo4j session"""
    async with Neo4jConnection.session() as session:
        yield session


# ============================================
# Pinecone Vector Database
# ============================================

class PineconeConnection:
    """Pinecone client wrapper"""
    
    _client: Optional[Pinecone] = None
    _index = None
    
    @classmethod
    def get_client(cls) -> Pinecone:
        """Get or create Pinecone client"""
        if cls._client is None:
            cls._client = Pinecone(api_key=settings.pinecone_api_key)
            logger.info("Pinecone client initialized")
        return cls._client
    
    @classmethod
    def get_index(cls):
        """Get Pinecone index"""
        if cls._index is None:
            client = cls.get_client()
            cls._index = client.Index(settings.pinecone_index)
            logger.info(f"Pinecone index '{settings.pinecone_index}' connected")
        return cls._index


def get_pinecone_index():
    """Dependency to get Pinecone index"""
    return PineconeConnection.get_index()


# ============================================
# Redis Cache
# ============================================

class RedisConnection:
    """Redis async client wrapper"""
    
    _client: Optional[redis.Redis] = None
    
    @classmethod
    async def get_client(cls) -> redis.Redis:
        """Get or create Redis client"""
        if cls._client is None:
            cls._client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            logger.info("Redis connection established")
        return cls._client
    
    @classmethod
    async def close(cls) -> None:
        """Close Redis connection"""
        if cls._client is not None:
            await cls._client.close()
            cls._client = None
            logger.info("Redis connection closed")


async def get_redis() -> redis.Redis:
    """Dependency to get Redis client"""
    return await RedisConnection.get_client()


# ============================================
# Lifecycle Management
# ============================================

async def init_databases() -> None:
    """Initialize all database connections"""
    logger.info("Initializing database connections...")
    
    # Test PostgreSQL connection
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("PostgreSQL initialized")
    
    # Test Neo4j connection
    await Neo4jConnection.get_driver()
    
    # Initialize Pinecone (synchronous)
    PineconeConnection.get_index()
    
    # Test Redis connection
    redis_client = await RedisConnection.get_client()
    await redis_client.ping()
    logger.info("Redis connected")


async def close_databases() -> None:
    """Close all database connections"""
    logger.info("Closing database connections...")
    await Neo4jConnection.close()
    await RedisConnection.close()
    await engine.dispose()
    logger.info("All database connections closed")
