# Holded AI Agent

An intelligent conversational agent that lets you interact with the Holded API using natural language. Query data, analyze documents, create invoices, and get insights - all through a modern chat interface.

![Demo](https://img.shields.io/badge/demo-live-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Node](https://img.shields.io/badge/node-18+-green)

## Features

### Chat Interface
- **Real-time streaming** responses with step-by-step indicators
- **Voice input** - speak your queries (Web Speech API)
- **Message templates** - quick access to common queries
- **Dark mode** - modern ChatGPT-style interface

### Document Processing
- **PDF & image analysis** - upload invoices and receipts
- **Automatic data extraction** - merchant, amount, date, line items
- **One-click creation** - analyze and create in Holded with approval

### Data Visualization
- **Interactive charts** - bar, line, and pie charts in responses
- **Quick dashboard** - one-click access to key metrics
- **Smart analytics** - trends, comparisons, and insights

### Multi-Agent Architecture
- **Supervisor agent** - routes queries to specialized agents
- **Holded agent** - CRUD operations with approval workflow
- **Analytics agent** - read-only queries with visualizations

## Tech Stack

**Backend:**
- Fastify (HTTP server)
- LangGraph (agent orchestration)
- Claude Sonnet 3.5 (main LLM)
- GPT-4o-mini (document vision)

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- assistant-ui (chat primitives)
- Tailwind CSS
- Recharts (visualizations)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (recommended)
- Holded API key
- Anthropic API key
- OpenAI API key (for vision)

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/holded-agent.git
cd holded-agent

# Create .env file
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose up

# Access the app
open http://localhost:3301
```

### Local Development

```bash
# Backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Configuration

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Optional - LangSmith tracing
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=holded-agent
```

### Holded API Key

Enter your Holded API key in the app settings (gear icon). Get your key from [Holded Developer Portal](https://developers.holded.com).

## Usage Examples

### Basic Queries
```
"Show me this month's sales summary"
"What invoices are pending payment?"
"Find contact named Acme Corp"
```

### With Charts
```
"Sales breakdown by client with chart"
"Monthly revenue trend"
"Top 10 customers by billing"
```

### Document Analysis
```
[Attach invoice image/PDF]
"Analyze this purchase and create it in Holded"
```

### Operations (with approval)
```
"Create an invoice for Client X for €500"
"Update contact email to new@email.com"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  React + assistant-ui + Tailwind + Recharts                 │
└─────────────────────┬───────────────────────────────────────┘
                      │ SSE (Server-Sent Events)
┌─────────────────────▼───────────────────────────────────────┐
│                         Backend                              │
│  Fastify + LangGraph                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Supervisor                         │   │
│  │            (routes to specialized agents)             │   │
│  └──────────┬────────────────────────┬──────────────────┘   │
│             │                        │                       │
│  ┌──────────▼──────────┐  ┌─────────▼─────────┐            │
│  │   Holded Agent      │  │  Analytics Agent   │            │
│  │   (CRUD + approval) │  │  (read-only)       │            │
│  └──────────┬──────────┘  └─────────┬─────────┘            │
│             │                        │                       │
│  ┌──────────▼────────────────────────▼─────────┐            │
│  │                   Tools                       │            │
│  │  • call_holded_api  • analyze_document       │            │
│  │  • brave_search     • get_api_documentation  │            │
│  └──────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │   Holded API    │
            └─────────────────┘
```

## Project Structure

```
holded-agent/
├── src/
│   ├── agent/
│   │   ├── graph.ts              # LangGraph workflow
│   │   ├── state.ts              # Agent state definition
│   │   ├── agents/               # Specialized agents
│   │   └── prompts/              # System prompts
│   ├── strategies/
│   │   └── chatStrategy.ts       # Message handling strategies
│   ├── services/
│   │   └── streamProcessor.ts    # SSE stream processing
│   ├── tools/
│   │   ├── holded.ts             # Holded API wrapper
│   │   ├── vision.ts             # Document analysis
│   │   └── documentation.ts      # API docs fetcher
│   └── server.ts                 # Fastify server
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── assistant-ui/ # Chat components
│   │   │   │   └── Chart.tsx     # Chart renderer
│   │   │   └── Layout/           # Header, Settings
│   │   └── lib/
│   │       ├── holdedRuntime.ts  # SSE adapter
│   │       └── attachmentAdapter.ts
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Reference

### POST /chat

Send a message to the agent.

**Request:**
```json
{
  "message": "Show me pending invoices",
  "threadId": "unique-thread-id",
  "holdedKey": "your-holded-api-key"
}
```

**Response:** Server-Sent Events stream

```
data: {"content": "Looking up invoices...", "status": "streaming"}
data: {"content": "Found 5 pending invoices...", "status": "streaming"}
data: {"status": "success", "final": true}
```

### POST /chat (with file)

Send a message with an attachment (multipart/form-data).

**Fields:**
- `message`: Query text
- `threadId`: Thread identifier
- `holdedKey`: Holded API key
- `file`: Image or PDF file

## Troubleshooting

### Agent stuck in loop
- Check LangSmith traces for errors
- Verify Holded API key is valid
- Recursion limit is set to 25 steps

### Charts not rendering
- Ensure recharts is installed: `npm install recharts`
- Check browser console for errors

### Voice input not working
- Use Chrome/Edge (Web Speech API support)
- Allow microphone permissions
- Check HTTPS in production

### Docker issues
```bash
# Rebuild without cache
docker-compose build --no-cache

# Check logs
docker-compose logs -f

# Reset volumes
docker-compose down -v
docker-compose up --build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Holded](https://holded.com) for the API
- [LangChain](https://langchain.com) / [LangGraph](https://langchain-ai.github.io/langgraphjs/) for agent framework
- [assistant-ui](https://assistant-ui.com) for chat components
- [Anthropic](https://anthropic.com) for Claude
