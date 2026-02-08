"""
Document Ingestion API
Handles file uploads and processing with Unstructured.io
"""

import os
import uuid
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import get_logger
from app.services.ingestion import IngestionService, IngestionResult

logger = get_logger(__name__)
router = APIRouter()


# ============================================
# Request/Response Models
# ============================================

class IngestionJobStatus(BaseModel):
    """Status of an ingestion job"""
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    filename: str
    progress: float = 0.0
    chunks_processed: int = 0
    total_chunks: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None


class IngestionResponse(BaseModel):
    """Response for document ingestion"""
    job_id: str
    status: str
    message: str


class BulkIngestionResponse(BaseModel):
    """Response for bulk document ingestion"""
    jobs: List[IngestionResponse]
    total_files: int


# ============================================
# In-memory job tracking (use Redis in production)
# ============================================

_jobs: Dict[str, IngestionJobStatus] = {}


def get_job_status(job_id: str) -> Optional[IngestionJobStatus]:
    """Get the status of an ingestion job"""
    return _jobs.get(job_id)


def update_job_status(job_id: str, **kwargs):
    """Update job status"""
    if job_id in _jobs:
        for key, value in kwargs.items():
            setattr(_jobs[job_id], key, value)


# ============================================
# Background Processing Task
# ============================================

async def process_document(job_id: str, file_path: str, filename: str):
    """Background task to process a document"""
    logger.info("Starting document processing", job_id=job_id, filename=filename)
    
    update_job_status(
        job_id,
        status="processing",
        started_at=datetime.utcnow().isoformat()
    )
    
    try:
        service = IngestionService()
        
        # Process the document
        result = await service.ingest_document(file_path, filename)
        
        update_job_status(
            job_id,
            status="completed",
            progress=1.0,
            chunks_processed=result.chunks_created,
            total_chunks=result.chunks_created,
            completed_at=datetime.utcnow().isoformat()
        )
        
        logger.info(
            "Document processing completed",
            job_id=job_id,
            chunks=result.chunks_created
        )
        
    except Exception as e:
        logger.error("Document processing failed", job_id=job_id, error=str(e))
        update_job_status(
            job_id,
            status="failed",
            error=str(e),
            completed_at=datetime.utcnow().isoformat()
        )
    
    finally:
        # Clean up uploaded file
        try:
            os.remove(file_path)
        except Exception:
            pass


# ============================================
# API Endpoints
# ============================================

@router.post("/upload", response_model=IngestionResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Upload and ingest a single document.
    
    Supported formats: PDF, DOCX, PPTX, XLSX, TXT, MD
    
    Processing happens in the background. Use the job status endpoint to track progress.
    """
    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {settings.allowed_extensions}"
        )
    
    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset
    
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
        )
    
    # Create upload directory if needed
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    # Save file temporarily
    job_id = str(uuid.uuid4())
    file_path = os.path.join(settings.upload_dir, f"{job_id}_{file.filename}")
    
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create job tracking entry
    _jobs[job_id] = IngestionJobStatus(
        job_id=job_id,
        status="pending",
        filename=file.filename
    )
    
    # Queue background processing
    background_tasks.add_task(process_document, job_id, file_path, file.filename)
    
    return IngestionResponse(
        job_id=job_id,
        status="pending",
        message=f"Document '{file.filename}' queued for processing"
    )


@router.post("/upload/bulk", response_model=BulkIngestionResponse)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...)
):
    """
    Upload and ingest multiple documents.
    
    Maximum 10 files per request.
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 files per request"
        )
    
    responses = []
    
    for file in files:
        try:
            response = await upload_document(background_tasks, file)
            responses.append(response)
        except HTTPException as e:
            responses.append(IngestionResponse(
                job_id="",
                status="failed",
                message=f"{file.filename}: {e.detail}"
            ))
    
    return BulkIngestionResponse(
        jobs=responses,
        total_files=len(files)
    )


@router.get("/status/{job_id}", response_model=IngestionJobStatus)
async def get_ingestion_status(job_id: str):
    """
    Get the status of an ingestion job.
    """
    job = get_job_status(job_id)
    
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found"
        )
    
    return job


@router.get("/status", response_model=List[IngestionJobStatus])
async def list_ingestion_jobs(
    status: Optional[str] = None,
    limit: int = 50
):
    """
    List all ingestion jobs, optionally filtered by status.
    """
    jobs = list(_jobs.values())
    
    if status:
        jobs = [j for j in jobs if j.status == status]
    
    # Sort by most recent first
    jobs.sort(key=lambda j: j.started_at or "", reverse=True)
    
    return jobs[:limit]


@router.delete("/job/{job_id}")
async def cancel_ingestion_job(job_id: str):
    """
    Cancel a pending ingestion job.
    """
    job = get_job_status(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    if job.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel completed job")
    
    if job.status == "processing":
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel job in progress"
        )
    
    # Remove from jobs
    del _jobs[job_id]
    
    return {"message": f"Job {job_id} cancelled"}
