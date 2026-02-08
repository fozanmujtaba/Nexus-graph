# Nexus-Graph Development Workflow

## Project Overview
Nexus-Graph is a production-ready Hybrid-Graph RAG System with Next.js frontend and FastAPI backend.

## Starting Development

// turbo-all

### 1. Start Backend Services

```bash
cd /Users/mac/projects/Nexus-graph
docker-compose up -d postgres neo4j redis
```

### 2. Install Backend Dependencies

```bash
cd /Users/mac/projects/Nexus-graph/backend
python -m venv venv
source venv/bin/activate
pip install -e .
```

### 3. Start Backend Server

```bash
cd /Users/mac/projects/Nexus-graph/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Install Frontend Dependencies

```bash
cd /Users/mac/projects/Nexus-graph/frontend
npm install
```

### 5. Start Frontend Development Server

```bash
cd /Users/mac/projects/Nexus-graph/frontend
npm run dev
```

## Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Neo4j Browser: http://localhost:7474

## Docker Full Stack

To start the entire stack with Docker:

```bash
cd /Users/mac/projects/Nexus-graph
docker-compose up -d
```

## Environment Setup

Make sure to copy .env.example to .env and fill in your API keys:

```bash
cp .env.example .env
```

Required environment variables:
- OPENAI_API_KEY
- PINECONE_API_KEY
- PINECONE_INDEX
- NEO4J_PASSWORD
- POSTGRES_PASSWORD
