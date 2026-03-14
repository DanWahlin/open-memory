import http from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { CONFIG } from './config.js';
import { search, getDocument, getStatus } from './qmd.js';
import { writeMemory, readMemory, listMemories, browseRecent } from './memory.js';

// ── MCP Server Setup ────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const mcp = new McpServer({ name: 'open-memory', version: '0.1.0' });

  mcp.tool(
    'search_memory',
    'Search your memory/knowledge base by meaning. Uses semantic vector search to find relevant notes, decisions, and context.',
    {
      query: z.string().describe('What to search for (natural language)'),
      mode: z.enum(['semantic', 'keyword', 'hybrid']).default('semantic').describe('Search mode: semantic (vector), keyword (BM25), or hybrid (best quality, slower)'),
      limit: z.number().min(1).max(50).default(10).describe('Max results'),
    },
    async ({ query, mode, limit }) => {
      const modeMap = { semantic: 'vsearch' as const, keyword: 'search' as const, hybrid: 'query' as const };
      const results = await search(query, modeMap[mode], limit);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  mcp.tool(
    'read_memory',
    'Read a specific memory file by path (relative to memory directory).',
    { path: z.string().describe('File path relative to memory dir (e.g., "MEMORY.md", "memory/2026-03-14.md")') },
    async ({ path: filePath }) => {
      try {
        const content = readMemory(filePath);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  mcp.tool(
    'write_memory',
    "Write/append to your memory. Defaults to today's daily note. Use for storing decisions, context, lessons, todos.",
    {
      content: z.string().describe('Content to write'),
      file: z.string().optional().describe('Target file (relative to memory dir). Defaults to today\'s daily note.'),
    },
    async ({ content, file }) => {
      const target = writeMemory(content, file);
      return { content: [{ type: 'text' as const, text: `Written to ${target}` }] };
    }
  );

  mcp.tool(
    'list_memories',
    'List memory files in the daily notes directory (or a subdirectory).',
    { subdir: z.string().optional().describe('Subdirectory to list (default: daily notes dir)') },
    async ({ subdir }) => {
      const files = listMemories(subdir);
      return { content: [{ type: 'text' as const, text: files.join('\n') || 'No files found.' }] };
    }
  );

  mcp.tool(
    'browse_recent',
    'Browse recent daily notes with previews.',
    { days: z.number().min(1).max(30).default(7).describe('Number of recent days to show') },
    async ({ days }) => {
      const notes = browseRecent(days);
      if (!notes.length) return { content: [{ type: 'text' as const, text: 'No recent daily notes found.' }] };
      const text = notes.map(n => `## ${n.date}\n${n.preview}\n`).join('\n---\n');
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  mcp.tool(
    'get_document',
    'Get full content of any indexed document by path or QMD docid.',
    {
      file: z.string().describe('File path or docid from search results'),
      fromLine: z.number().optional().describe('Start from this line'),
      maxLines: z.number().optional().describe('Max lines to return'),
    },
    async ({ file, fromLine, maxLines }) => {
      try {
        const content = await getDocument(file, fromLine, maxLines);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  mcp.tool('memory_status', 'Show the status of the memory index: collections, document counts, health.', {}, async () => {
    const status = await getStatus();
    return { content: [{ type: 'text' as const, text: status }] };
  });

  return mcp;
}

// ── HTTP Server ─────────────────────────────────────────────────────────

const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Auth check
  if (CONFIG.authToken && req.url !== '/health') {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CONFIG.authToken}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', name: 'open-memory', version: '0.1.0' }));
    return;
  }

  // SSE endpoint - MCP clients connect here
  if (url.pathname === '/sse' && req.method === 'GET') {
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    res.on('close', () => transports.delete(sessionId));

    const mcp = createMcpServer();
    await mcp.connect(transport);
    return;
  }

  // Message endpoint - MCP clients post messages here
  if (url.pathname === '/messages' && req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) { res.writeHead(400); res.end('Missing sessionId'); return; }

    const transport = transports.get(sessionId);
    if (!transport) { res.writeHead(404); res.end('Unknown session'); return; }

    let body = '';
    for await (const chunk of req) body += chunk;

    try {
      await transport.handlePostMessage(req, res, JSON.parse(body));
    } catch (e: any) {
      if (!res.headersSent) {
        res.writeHead(400);
        res.end(e.message);
      }
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ── Startup ─────────────────────────────────────────────────────────────

httpServer.listen(CONFIG.port, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │           open-memory v0.1.0            │
  │                                         │
  │  MCP server for personal knowledge      │
  │  Powered by QMD                         │
  │                                         │
  │  Memory dir: ${CONFIG.memoryDir.slice(0, 25).padEnd(25)}│
  │  QMD binary: ${CONFIG.qmdBin.slice(0, 25).padEnd(25)}│
  │  Auth: ${(CONFIG.authToken ? 'enabled' : 'disabled').padEnd(32)}│
  │                                         │
  │  MCP (SSE): http://localhost:${String(CONFIG.port).padEnd(12)}│
  │  Health:    http://localhost:${String(CONFIG.port)}/health${' '.repeat(Math.max(0, 5 - String(CONFIG.port).length))}│
  └─────────────────────────────────────────┘
  `);
});
