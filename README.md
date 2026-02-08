# 🔮 Nexus-Graph

> **A Production-Ready Hybrid-Graph RAG System**

Nexus-Graph is a next-generation Retrieval-Augmented Generation (RAG) system that combines the power of graph databases, vector search, and relational storage with intelligent agent orchestration.

![Nexus-Graph Architecture](./docs/architecture.png)

---

## ✨ Features

### 🧠 Intelligent Agent Orchestration
- **Switchboard Agent** - Semantic router that decomposes queries into sub-tasks
- **Librarian Agent** - Handles document retrieval and vector search
- **Analyst Agent** - Processes SQL queries and structured data
- **Critic Agent** - Validates outputs using RAGAS metrics

### 📊 Hybrid Storage Architecture
- **Neo4j** - Graph database for relationship-based queries
- **Pinecone** - Vector database for semantic search
- **PostgreSQL/Supabase** - Relational storage for structured data

### 🎨 Glass Box UI/UX
- **Thought-Stream Visualization** - Real-time agent reasoning display
- **Dynamic Data Rendering** - Auto-switching between tables, graphs, and charts
- **Glassmorphism Design** - Modern, translucent UI components
- **Command Palette** - Quick access to all features (Cmd+K)

### 📄 Multimodal Document Processing
- **Unstructured.io Integration** - Parse PDFs, tables, diagrams
- **Table to SQL** - Automatic table extraction and structuring
- **Diagram to Vision-LLM** - Visual content understanding

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NEXUS-GRAPH FRONTEND                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Chat UI    │  │ Thought     │  │  Graph      │  │  Table     │ │
│  │  Component  │  │  Stream     │  │  Visualizer │  │  View      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SWITCHBOARD AGENT                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Semantic   │  │  Intent     │  │  Function   │  │  Validator │ │
│  │  Router     │──▶│  Classifier │──▶│  Caller    │──▶│  Agent    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │  Neo4j   │  │ Pinecone │  │ Postgres │
              │  (Graph) │  │ (Vector) │  │ (SQL)    │
              └──────────┘  └──────────┘  └──────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Neo4j, Pinecone, and Supabase accounts

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nexus-graph.git
cd nexus-graph
```

2. Copy environment files:
```bash
cp .env.example .env
```

3. Start with Docker:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 📁 Project Structure

```
nexus-graph/
├── frontend/                 # Next.js 16 Application
│   ├── app/                  # App Router pages
│   ├── components/           # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── chat/             # Chat interface
│   │   ├── visualization/    # Data visualization
│   │   └── thought-stream/   # Agent reasoning UI
│   ├── lib/                  # Utilities and hooks
│   └── styles/               # Tailwind CSS v4
│
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── agents/           # LangGraph agents
│   │   ├── api/              # API routes
│   │   ├── core/             # Configuration
│   │   ├── services/         # Business logic
│   │   └── tools/            # Agent tools
│   └── tests/                # Test suite
│
├── docker/                   # Docker configurations
├── docs/                     # Documentation
└── scripts/                  # Utility scripts
```

---

## 🔧 Configuration

### Required Environment Variables

```env
# LLM Configuration
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Vector Database
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=nexus-graph

# Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# Relational Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus

# Supabase (optional)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

---

## 📚 Documentation

- [Architecture Overview](./docs/architecture.md)
- [Agent System](./docs/agents.md)
- [API Reference](./docs/api.md)
- [UI Components](./docs/components.md)
- [Deployment Guide](./docs/deployment.md)

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built with ❤️ using Next.js, FastAPI, and LangGraph
</p>
