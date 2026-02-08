"""
Agent Tools
Function tools that agents can invoke for retrieval and processing
"""

import json
from typing import Any, Dict, List, Optional
from datetime import datetime

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.core.database import (
    get_db,
    Neo4jConnection,
    PineconeConnection,
)

logger = get_logger(__name__)


# ============================================
# Tool Input/Output Schemas
# ============================================

class SQLQueryInput(BaseModel):
    """Input schema for SQL query tool"""
    query: str = Field(description="The SQL query to execute")
    parameters: Optional[Dict[str, Any]] = Field(
        default=None, 
        description="Query parameters for parameterized queries"
    )


class GraphQueryInput(BaseModel):
    """Input schema for graph query tool"""
    cypher_query: str = Field(description="The Cypher query to execute on Neo4j")
    parameters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Query parameters"
    )


class VectorSearchInput(BaseModel):
    """Input schema for vector search tool"""
    query: str = Field(description="The search query to embed and search")
    top_k: int = Field(default=10, description="Number of results to return")
    filter: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Metadata filter for the search"
    )
    namespace: Optional[str] = Field(
        default=None,
        description="Pinecone namespace to search in"
    )


# ============================================
# SQL Query Tool
# ============================================

@tool(args_schema=SQLQueryInput)
async def query_sql(
    query: str,
    parameters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Execute a SQL query against the PostgreSQL database.
    Use this for structured data queries, aggregations, and table lookups.
    
    Returns:
        Dict containing 'columns', 'rows', and 'row_count'
    """
    from sqlalchemy import text
    from app.core.database import async_session_factory
    
    logger.info("Executing SQL query", query=query[:100])
    
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                text(query),
                parameters or {}
            )
            
            # Handle SELECT queries
            if result.returns_rows:
                columns = list(result.keys())
                rows = [dict(zip(columns, row)) for row in result.fetchall()]
                
                return {
                    "success": True,
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                    "query_type": "SELECT",
                    "executed_at": datetime.utcnow().isoformat()
                }
            else:
                # Handle INSERT/UPDATE/DELETE
                await session.commit()
                return {
                    "success": True,
                    "rows_affected": result.rowcount,
                    "query_type": "WRITE",
                    "executed_at": datetime.utcnow().isoformat()
                }
                
    except Exception as e:
        logger.error("SQL query failed", error=str(e), query=query[:100])
        return {
            "success": False,
            "error": str(e),
            "query": query
        }


# ============================================
# Graph Query Tool
# ============================================

@tool(args_schema=GraphQueryInput)
async def search_graph(
    cypher_query: str,
    parameters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Execute a Cypher query against the Neo4j graph database.
    Use this for relationship-based queries, path finding, and entity connections.
    
    Returns:
        Dict containing 'nodes', 'relationships', and query metadata
    """
    logger.info("Executing Cypher query", query=cypher_query[:100])
    
    try:
        async with Neo4jConnection.session() as session:
            result = await session.run(cypher_query, parameters or {})
            records = await result.data()
            
            # Extract nodes and relationships from results
            nodes = []
            relationships = []
            
            for record in records:
                for key, value in record.items():
                    if hasattr(value, 'labels'):  # It's a node
                        nodes.append({
                            "id": value.element_id,
                            "labels": list(value.labels),
                            "properties": dict(value)
                        })
                    elif hasattr(value, 'type'):  # It's a relationship
                        relationships.append({
                            "id": value.element_id,
                            "type": value.type,
                            "start_node": value.start_node.element_id,
                            "end_node": value.end_node.element_id,
                            "properties": dict(value)
                        })
            
            return {
                "success": True,
                "records": records,
                "nodes": nodes,
                "relationships": relationships,
                "record_count": len(records),
                "executed_at": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        logger.error("Cypher query failed", error=str(e), query=cypher_query[:100])
        return {
            "success": False,
            "error": str(e),
            "query": cypher_query
        }


# ============================================
# Vector Search Tool
# ============================================

@tool(args_schema=VectorSearchInput)
async def vector_retrieval(
    query: str,
    top_k: int = 10,
    filter: Optional[Dict[str, Any]] = None,
    namespace: Optional[str] = None
) -> Dict[str, Any]:
    """
    Perform semantic vector search using Pinecone.
    Use this for semantic similarity, finding related documents, and fuzzy matching.
    
    Returns:
        Dict containing 'matches' with scores and metadata
    """
    from langchain_openai import OpenAIEmbeddings
    from app.core.config import settings
    
    logger.info("Executing vector search", query=query[:50], top_k=top_k)
    
    try:
        # Generate embedding for the query
        embeddings = OpenAIEmbeddings(
            api_key=settings.openai_api_key,
            model="text-embedding-3-small"
        )
        query_embedding = await embeddings.aembed_query(query)
        
        # Search Pinecone
        index = PineconeConnection.get_index()
        
        search_kwargs = {
            "vector": query_embedding,
            "top_k": top_k,
            "include_metadata": True,
            "include_values": False
        }
        
        if filter:
            search_kwargs["filter"] = filter
        if namespace:
            search_kwargs["namespace"] = namespace
            
        results = index.query(**search_kwargs)
        
        # Format results
        matches = []
        for match in results.matches:
            matches.append({
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata or {}
            })
        
        return {
            "success": True,
            "matches": matches,
            "match_count": len(matches),
            "query": query,
            "executed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Vector search failed", error=str(e), query=query[:50])
        return {
            "success": False,
            "error": str(e),
            "query": query
        }


# ============================================
# Hybrid Search Tool
# ============================================

class HybridSearchInput(BaseModel):
    """Input schema for hybrid search"""
    query: str = Field(description="The search query")
    vector_weight: float = Field(
        default=0.5,
        description="Weight for vector search results (0-1)"
    )
    top_k: int = Field(default=10, description="Number of results from each source")


@tool(args_schema=HybridSearchInput)
async def hybrid_search(
    query: str,
    vector_weight: float = 0.5,
    top_k: int = 10
) -> Dict[str, Any]:
    """
    Perform hybrid search combining vector similarity and graph relationships.
    
    Returns:
        Dict containing combined and ranked results from both sources
    """
    logger.info("Executing hybrid search", query=query[:50])
    
    try:
        # Execute both searches in parallel
        import asyncio
        
        vector_task = vector_retrieval.ainvoke({
            "query": query,
            "top_k": top_k
        })
        
        # Generate a Cypher query for related entities
        cypher_query = """
        CALL db.index.fulltext.queryNodes('search_index', $query)
        YIELD node, score
        RETURN node, score
        ORDER BY score DESC
        LIMIT $limit
        """
        
        graph_task = search_graph.ainvoke({
            "cypher_query": cypher_query,
            "parameters": {"query": query, "limit": top_k}
        })
        
        vector_results, graph_results = await asyncio.gather(
            vector_task, graph_task
        )
        
        # Combine and re-rank results
        combined_results = []
        
        # Add vector results with weight
        if vector_results.get("success"):
            for match in vector_results.get("matches", []):
                combined_results.append({
                    "source": "vector",
                    "id": match["id"],
                    "score": match["score"] * vector_weight,
                    "metadata": match["metadata"]
                })
        
        # Add graph results with weight
        graph_weight = 1 - vector_weight
        if graph_results.get("success"):
            for record in graph_results.get("records", []):
                combined_results.append({
                    "source": "graph",
                    "id": record.get("id", "unknown"),
                    "score": record.get("score", 0.5) * graph_weight,
                    "data": record
                })
        
        # Sort by combined score
        combined_results.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "success": True,
            "results": combined_results[:top_k],
            "vector_count": len(vector_results.get("matches", [])),
            "graph_count": len(graph_results.get("records", [])),
            "executed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Hybrid search failed", error=str(e))
        return {
            "success": False,
            "error": str(e),
            "query": query
        }


# ============================================
# Tool Registry
# ============================================

AVAILABLE_TOOLS = [
    query_sql,
    search_graph,
    vector_retrieval,
    hybrid_search,
]

TOOL_MAPPING = {
    "query_sql": query_sql,
    "search_graph": search_graph,
    "vector_retrieval": vector_retrieval,
    "hybrid_search": hybrid_search,
}


def get_tool_by_name(name: str):
    """Get a tool by its name"""
    return TOOL_MAPPING.get(name)
