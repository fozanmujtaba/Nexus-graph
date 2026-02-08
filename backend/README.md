# Nexus-Graph Backend

FastAPI backend for the Nexus-Graph Hybrid RAG System.

## Features

- **Agent Orchestration** - LangGraph-based multi-agent system
- **Hybrid Storage** - Neo4j, Pinecone, and PostgreSQL integration
- **Document Processing** - Unstructured.io multimodal parsing
- **Real-time Updates** - SSE and WebSocket support

## Quick Start

```bash
# Create virtual environment
python3 -m pip install --user virtualenv
python3 -m virtualenv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Docs

Once running, visit:
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
