"""
Document Ingestion Service
Handles multimodal document parsing with Unstructured.io
"""

import asyncio
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime

import httpx
from pydantic import BaseModel, Field
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings
from app.core.logging import get_logger
from app.core.database import (
    async_session_factory,
    Neo4jConnection,
    PineconeConnection,
)

logger = get_logger(__name__)


@dataclass
class IngestionResult:
    """Result of document ingestion"""
    document_id: str
    filename: str
    chunks_created: int
    entities_extracted: int
    tables_extracted: int
    images_processed: int
    processing_time_seconds: float
    metadata: Dict[str, Any]


class DocumentChunk(BaseModel):
    """A chunk of document content"""
    chunk_id: str
    document_id: str
    content: str
    content_type: str  # "text", "table", "image_description"
    page_number: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExtractedEntity(BaseModel):
    """An entity extracted from the document"""
    entity_id: str
    name: str
    entity_type: str
    properties: Dict[str, Any] = Field(default_factory=dict)
    source_chunk_id: str
    source_document_id: str


class IngestionService:
    """
    Service for ingesting documents using Unstructured.io for parsing
    and distributing to vector, graph, and relational stores.
    """
    
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            api_key=settings.openai_api_key,
            model="text-embedding-3-small"
        )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        self.unstructured_client = httpx.AsyncClient(
            timeout=300.0,  # 5 minute timeout for large documents
            headers={"unstructured-api-key": settings.unstructured_api_key}
        )
    
    async def ingest_document(
        self, 
        file_path: str, 
        filename: str
    ) -> IngestionResult:
        """
        Full ingestion pipeline for a document.
        
        Steps:
        1. Parse with Unstructured.io (extract text, tables, images)
        2. Chunk text content
        3. Generate embeddings
        4. Extract entities for graph
        5. Store in all backends
        """
        import time
        start_time = time.time()
        
        document_id = self._generate_document_id(file_path)
        
        logger.info(
            "Starting document ingestion",
            document_id=document_id,
            filename=filename
        )
        
        try:
            # Step 1: Parse document with Unstructured.io
            elements = await self._parse_document(file_path, filename)
            
            # Step 2: Process different element types
            text_chunks = []
            tables = []
            images = []
            
            for element in elements:
                element_type = element.get("type", "")
                
                if element_type in ["NarrativeText", "Text", "Title", "ListItem"]:
                    text_chunks.append(element)
                elif element_type == "Table":
                    tables.append(element)
                elif element_type == "Image":
                    images.append(element)
            
            # Step 3: Create document chunks
            chunks = await self._create_chunks(
                document_id, 
                filename, 
                text_chunks, 
                tables
            )
            
            # Step 4: Generate embeddings and store in Pinecone
            await self._store_vectors(chunks)
            
            # Step 5: Extract entities and store in Neo4j
            entities = await self._extract_and_store_entities(chunks, document_id)
            
            # Step 6: Store metadata in PostgreSQL
            await self._store_document_metadata(document_id, filename, chunks, entities)
            
            processing_time = time.time() - start_time
            
            result = IngestionResult(
                document_id=document_id,
                filename=filename,
                chunks_created=len(chunks),
                entities_extracted=len(entities),
                tables_extracted=len(tables),
                images_processed=len(images),
                processing_time_seconds=processing_time,
                metadata={
                    "total_elements": len(elements),
                    "file_path": file_path
                }
            )
            
            logger.info(
                "Document ingestion completed",
                document_id=document_id,
                chunks=len(chunks),
                entities=len(entities),
                time_seconds=processing_time
            )
            
            return result
            
        except Exception as e:
            logger.error(
                "Document ingestion failed",
                document_id=document_id,
                error=str(e)
            )
            raise
    
    async def _parse_document(
        self, 
        file_path: str, 
        filename: str
    ) -> List[Dict[str, Any]]:
        """Parse document using Unstructured.io API"""
        logger.debug("Parsing document with Unstructured.io", filename=filename)
        
        try:
            with open(file_path, "rb") as f:
                files = {"files": (filename, f)}
                
                response = await self.unstructured_client.post(
                    settings.unstructured_api_url,
                    files=files,
                    data={
                        "strategy": "hi_res",  # High resolution for tables
                        "pdf_infer_table_structure": "true",
                        "extract_images_in_pdf": "true",
                    }
                )
                
                response.raise_for_status()
                return response.json()
                
        except httpx.HTTPError as e:
            logger.error("Unstructured.io API error", error=str(e))
            # Fallback to local parsing if API fails
            return await self._parse_local(file_path, filename)
    
    async def _parse_local(
        self, 
        file_path: str, 
        filename: str
    ) -> List[Dict[str, Any]]:
        """Local document parsing fallback"""
        from unstructured.partition.auto import partition
        
        try:
            elements = partition(filename=file_path)
            return [
                {
                    "type": type(el).__name__,
                    "text": str(el),
                    "metadata": el.metadata.to_dict() if hasattr(el, 'metadata') else {}
                }
                for el in elements
            ]
        except Exception as e:
            logger.error("Local parsing failed", error=str(e))
            # Last resort: read as plain text
            with open(file_path, "r", errors="ignore") as f:
                content = f.read()
            return [{"type": "Text", "text": content, "metadata": {}}]
    
    async def _create_chunks(
        self,
        document_id: str,
        filename: str,
        text_elements: List[Dict],
        tables: List[Dict]
    ) -> List[DocumentChunk]:
        """Create document chunks from parsed elements"""
        chunks = []
        
        # Process text elements
        all_text = "\n\n".join([el.get("text", "") for el in text_elements])
        text_splits = self.text_splitter.split_text(all_text)
        
        for i, text in enumerate(text_splits):
            chunk_id = f"{document_id}_chunk_{i}"
            chunks.append(DocumentChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                content=text,
                content_type="text",
                metadata={
                    "filename": filename,
                    "chunk_index": i,
                    "total_chunks": len(text_splits)
                }
            ))
        
        # Process tables (store as structured data)
        for i, table in enumerate(tables):
            chunk_id = f"{document_id}_table_{i}"
            table_content = table.get("text", "")
            
            # Try to extract structured table data
            table_html = table.get("metadata", {}).get("text_as_html", "")
            
            chunks.append(DocumentChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                content=table_content,
                content_type="table",
                metadata={
                    "filename": filename,
                    "table_index": i,
                    "html": table_html
                }
            ))
        
        return chunks
    
    async def _store_vectors(self, chunks: List[DocumentChunk]):
        """Generate embeddings and store in Pinecone"""
        logger.debug("Storing vectors in Pinecone", chunk_count=len(chunks))
        
        if not chunks:
            return
        
        # Generate embeddings in batches
        batch_size = 100
        index = PineconeConnection.get_index()
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c.content for c in batch]
            
            # Generate embeddings
            embeddings = await self.embeddings.aembed_documents(texts)
            
            # Prepare upsert data
            vectors = [
                {
                    "id": chunk.chunk_id,
                    "values": embedding,
                    "metadata": {
                        "document_id": chunk.document_id,
                        "content_type": chunk.content_type,
                        "text": chunk.content[:1000],  # Truncate for metadata
                        **chunk.metadata
                    }
                }
                for chunk, embedding in zip(batch, embeddings)
            ]
            
            # Upsert to Pinecone
            index.upsert(vectors=vectors)
        
        logger.debug("Vectors stored successfully")
    
    async def _extract_and_store_entities(
        self,
        chunks: List[DocumentChunk],
        document_id: str
    ) -> List[ExtractedEntity]:
        """Extract entities and store relationships in Neo4j"""
        logger.debug("Extracting entities for graph", chunk_count=len(chunks))
        
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate
        
        llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            model="gpt-4-turbo-preview",
            temperature=0
        )
        
        extraction_prompt = ChatPromptTemplate.from_messages([
            ("system", """Extract named entities from the text. Return a JSON array of entities.
Each entity should have: name, type (Person, Organization, Concept, Product, Location, Event), and any relevant properties.

Example output:
[
  {"name": "OpenAI", "type": "Organization", "properties": {"founded": "2015"}},
  {"name": "GPT-4", "type": "Product", "properties": {"type": "LLM"}}
]

Return only valid JSON array, no other text."""),
            ("human", "{text}")
        ])
        
        all_entities = []
        
        # Process chunks in parallel
        for chunk in chunks:
            try:
                chain = extraction_prompt | llm
                response = await chain.ainvoke({"text": chunk.content[:2000]})
                
                # Parse entities from response
                entities_data = json.loads(response.content)
                
                for entity_data in entities_data:
                    entity = ExtractedEntity(
                        entity_id=f"{document_id}_{entity_data['name'][:20]}",
                        name=entity_data["name"],
                        entity_type=entity_data.get("type", "Unknown"),
                        properties=entity_data.get("properties", {}),
                        source_chunk_id=chunk.chunk_id,
                        source_document_id=document_id
                    )
                    all_entities.append(entity)
                    
            except Exception as e:
                logger.warning("Entity extraction failed for chunk", error=str(e))
                continue
        
        # Store entities in Neo4j
        if all_entities:
            await self._store_entities_in_graph(all_entities, document_id)
        
        return all_entities
    
    async def _store_entities_in_graph(
        self,
        entities: List[ExtractedEntity],
        document_id: str
    ):
        """Store entities and their relationships in Neo4j"""
        logger.debug("Storing entities in Neo4j", count=len(entities))
        
        async with Neo4jConnection.session() as session:
            # Create document node
            await session.run(
                """
                MERGE (d:Document {id: $doc_id})
                SET d.updated_at = datetime()
                """,
                {"doc_id": document_id}
            )
            
            # Create entity nodes and relationships
            for entity in entities:
                await session.run(
                    """
                    MERGE (e:Entity {id: $entity_id})
                    SET e.name = $name,
                        e.type = $type,
                        e.properties = $properties,
                        e.updated_at = datetime()
                    
                    WITH e
                    MATCH (d:Document {id: $doc_id})
                    MERGE (d)-[:CONTAINS]->(e)
                    
                    WITH e
                    MATCH (c:Chunk {id: $chunk_id})
                    MERGE (c)-[:MENTIONS]->(e)
                    """,
                    {
                        "entity_id": entity.entity_id,
                        "name": entity.name,
                        "type": entity.entity_type,
                        "properties": json.dumps(entity.properties),
                        "doc_id": document_id,
                        "chunk_id": entity.source_chunk_id
                    }
                )
        
        logger.debug("Entities stored in graph")
    
    async def _store_document_metadata(
        self,
        document_id: str,
        filename: str,
        chunks: List[DocumentChunk],
        entities: List[ExtractedEntity]
    ):
        """Store document metadata in PostgreSQL"""
        from sqlalchemy import text
        
        async with async_session_factory() as session:
            # Check if documents table exists, create if not
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS documents (
                    id VARCHAR(255) PRIMARY KEY,
                    filename VARCHAR(500) NOT NULL,
                    chunk_count INTEGER DEFAULT 0,
                    entity_count INTEGER DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'processed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB DEFAULT '{}'
                )
            """))
            
            # Insert or update document record
            await session.execute(
                text("""
                    INSERT INTO documents (id, filename, chunk_count, entity_count, metadata)
                    VALUES (:id, :filename, :chunk_count, :entity_count, :metadata)
                    ON CONFLICT (id) DO UPDATE SET
                        chunk_count = EXCLUDED.chunk_count,
                        entity_count = EXCLUDED.entity_count,
                        updated_at = CURRENT_TIMESTAMP
                """),
                {
                    "id": document_id,
                    "filename": filename,
                    "chunk_count": len(chunks),
                    "entity_count": len(entities),
                    "metadata": json.dumps({
                        "chunk_types": list(set(c.content_type for c in chunks))
                    })
                }
            )
            
            await session.commit()
    
    def _generate_document_id(self, file_path: str) -> str:
        """Generate a unique document ID based on file content"""
        with open(file_path, "rb") as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()[:16]
        return f"doc_{content_hash}"
