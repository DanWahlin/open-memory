# open-memory

One brain, every AI. An MCP server that gives any AI tool (Copilot, Claude, Codex, Cursor, ChatGPT) access to your personal knowledge base through a single open protocol.

Your memory lives as plain markdown files. [QMD](https://github.com/nicobailon/qmd) indexes and searches them (BM25 + vector embeddings). open-memory wraps it all in an MCP server that any client can connect to. No database. No SaaS. Files are the source of truth.

```
                        ┌──────────────────┐
Copilot      ──┐        │  open-memory     │         ┌──────────────┐
Claude Code ──┼── MCP ──→  (stdio or SSE)  ├── QMD ──→ memory/*.md  │
Cursor       ──┤        │                 │         │ MEMORY.md    │
Codex        ──┤        └──────────────────┘         │ notes/*.md   │
ChatGPT      ──┘                                      └──────────────┘
               local (stdio)
               or remote (SSE over Tailscale/tunnel)
```

## Why

Every AI tool has its own memory silo. Copilot doesn't know what you told Claude. Cursor doesn't remember what Codex learned. You re-explain context every time you switch tools.

open-memory fixes this: one directory of markdown files, one search index, one MCP server. Any tool that speaks MCP gets your full context.

Cost: **$0.** Self-hosted, no external services.

## Quick Start

### Prerequisites

- **Node.js** 20+
- **QMD** (the search/indexing engine)

### Install QMD

```bash
# Using bun (fastest)
bun install -g qmd

# Or npm
npm install -g qmd
```

### Set Up Your Memory

If you're starting fresh:

```bash
mkdir -p ~/memory/memory
echo "# My Knowledge Base" > ~/memory/MEMORY.md
echo "# $(date +%Y-%m-%d)" > ~/memory/memory/$(date +%Y-%m-%d).md
```

If you already use OpenClaw, your memory is at `~/.openclaw/` (MEMORY.md + memory/*.md). Point open-memory there.

### Index Your Files with QMD

```bash
# Create a collection pointing to your memory directory
qmd collection add ~/memory --name my-memory --mask "**/*.md"

# Generate vector embeddings (needed for semantic search)
# Requires OPENAI_API_KEY or a local embedding model
qmd embed
```

QMD supports multiple embedding providers. See [QMD docs](https://github.com/nicobailon/qmd) for configuration.

### Install & Run open-memory

```bash
# Clone
git clone https://github.com/DanWahlin/open-memory.git
cd open-memory

# Install & build
npm install
npm run build

# Configure (optional)
cp .env.example .env
# Edit .env to set QMD_BIN path, MEMORY_DIR, auth token, etc.

# Run (HTTP/SSE mode for remote clients)
npm start

# Or run in stdio mode (for local clients)
npm run start:stdio
```

## Connecting AI Tools

### GitHub Copilot CLI

The fastest way to connect. Run `copilot` in your terminal, then:

```
/mcp add
```

Fill in the interactive form:

| Field | Value |
|-------|-------|
| **Server Name** | `open-memory` |
| **Server Type** | `STDIO` (press the corresponding number) |
| **Command** | `node /path/to/open-memory/dist/stdio.js` |
| **Environment Variables** | `{"QMD_BIN": "/path/to/qmd", "MEMORY_DIR": "/path/to/your/memory"}` |
| **Tools** | `*` |

Press `Ctrl+S` to save. The server is available immediately, no restart needed.

You can also edit the config file directly at `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "open-memory": {
      "type": "local",
      "command": "node",
      "args": ["/path/to/open-memory/dist/stdio.js"],
      "env": {
        "QMD_BIN": "/path/to/qmd",
        "MEMORY_DIR": "/path/to/your/memory"
      },
      "tools": ["*"]
    }
  }
}
```

Manage your server with `/mcp show`, `/mcp edit open-memory`, or `/mcp delete open-memory`.

For remote access (SSE), use type `"http"` or `"sse"` with your server URL instead.

### Claude Code

```bash
claude mcp add open-memory -- node /path/to/open-memory/dist/stdio.js
```

Or add to your MCP config:

```json
{
  "mcpServers": {
    "open-memory": {
      "command": "node",
      "args": ["/path/to/open-memory/dist/stdio.js"],
      "env": {
        "QMD_BIN": "/path/to/qmd",
        "MEMORY_DIR": "/path/to/your/memory"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (Settings > MCP Servers):

```json
{
  "mcpServers": {
    "open-memory": {
      "command": "node",
      "args": ["/path/to/open-memory/dist/stdio.js"],
      "env": {
        "QMD_BIN": "/path/to/qmd",
        "MEMORY_DIR": "/path/to/your/memory"
      }
    }
  }
}
```

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.open-memory]
command = 'node'
args = ['/path/to/open-memory/dist/stdio.js']

[mcp_servers.open-memory.env]
QMD_BIN = '/path/to/qmd'
MEMORY_DIR = '/path/to/your/memory'
```

### VS Code (Copilot Chat)

Add to `.vscode/mcp.json` in your workspace (or `~/.vscode/mcp.json` globally):

```json
{
  "servers": {
    "open-memory": {
      "command": "node",
      "args": ["/path/to/open-memory/dist/stdio.js"],
      "env": {
        "QMD_BIN": "/path/to/qmd",
        "MEMORY_DIR": "/path/to/your/memory"
      }
    }
  }
}
```

### Remote Access (SSE mode)

Run the HTTP server on a machine with your memory files:

```bash
OPEN_MEMORY_TOKEN=your-secret-token npm start
```

Connect from any MCP client that supports SSE or HTTP transport:

```
URL: http://<your-server>:3838/sse
Auth: Bearer your-secret-token
```

For GitHub Copilot CLI remote access, use `/mcp add` with type `HTTP` or `SSE` and paste the URL.

Over Tailscale, use your Tailscale IP. Over the internet, put it behind a reverse proxy with HTTPS.

## Tools

open-memory exposes 7 MCP tools:

| Tool | Description |
|------|-------------|
| `search_memory` | Semantic, keyword, or hybrid search across your knowledge base |
| `read_memory` | Read a specific memory file by path |
| `write_memory` | Append to today's daily note (or a specific file) |
| `list_memories` | List memory files in a directory |
| `browse_recent` | Preview recent daily notes |
| `get_document` | Get any indexed document by path or QMD docid |
| `memory_status` | Show index health, collections, and document counts |

## Configuration

All configuration via environment variables (or `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `QMD_BIN` | `qmd` | Path to QMD binary |
| `MEMORY_DIR` | `~/.openclaw` | Root directory for memory files |
| `DAILY_NOTES_DIR` | `memory` | Subdirectory for daily notes (within MEMORY_DIR) |
| `MAIN_MEMORY_FILE` | `MEMORY.md` | Main memory file name |
| `QMD_COLLECTION` | *(empty)* | QMD collection to search (empty = all) |
| `PORT` | `3838` | HTTP server port (SSE mode) |
| `OPEN_MEMORY_TOKEN` | *(empty)* | Bearer token for auth (empty = no auth) |

## QMD Setup Guide

QMD is the search engine behind open-memory. It indexes markdown files and provides BM25 (keyword), vector (semantic), and hybrid search.

### Collections

QMD organizes files into collections. Create one for your memory:

```bash
# Index a directory of markdown files
qmd collection add ~/my-notes --name notes --mask "**/*.md"

# List your collections
qmd collection list

# Re-index after adding files
qmd update
```

### Embeddings

For semantic search, QMD needs vector embeddings:

```bash
# Set your API key (OpenAI, or compatible provider)
export OPENAI_API_KEY=sk-...

# Generate embeddings
qmd embed

# Check status
qmd status
```

### Search Modes

```bash
# Keyword search (fast, exact matching)
qmd search "project decisions"

# Semantic search (finds conceptually related content)
qmd vsearch "what did we decide about the architecture"

# Hybrid (best quality, combines both + reranking via local LLM)
qmd query "why did we choose Postgres over MongoDB"
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ MCP Client (Copilot, Claude, Cursor, Codex...)          │
└───────────────┬─────────────────────────────────────────┘
                │ MCP Protocol (stdio or SSE)
┌───────────────▼─────────────────────────────────────────┐
│ open-memory server                                       │
│                                                          │
│  search_memory ──→ QMD (vsearch/search/query)           │
│  read_memory   ──→ fs.readFileSync                      │
│  write_memory  ──→ fs.appendFileSync                    │
│  get_document  ──→ QMD (get)                            │
│  list_memories ──→ fs.readdirSync                       │
│  browse_recent ──→ fs.readdirSync + readFileSync        │
│  memory_status ──→ QMD (status)                         │
└─────────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│ File System                                              │
│  MEMORY.md          - curated long-term knowledge        │
│  memory/YYYY-MM-DD.md - daily notes                      │
│  *.md               - any other indexed markdown         │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Files are the source of truth, not a database
- QMD handles all indexing and search (BM25 + vector)
- Zero external services required
- Two transport modes: stdio (local) and SSE (remote)
- Auth via bearer token for remote access

## Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ dist/
RUN npm install -g qmd
ENV QMD_BIN=qmd
EXPOSE 3838
CMD ["node", "dist/server.js"]
```

Mount your memory directory:

```bash
docker run -v ~/memory:/memory -e MEMORY_DIR=/memory -p 3838:3838 open-memory
```

## License

MIT
