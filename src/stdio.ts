#!/usr/bin/env node
/**
 * Stdio MCP transport for local clients (Claude Code, Cursor, Copilot, etc.)
 * Usage: npx open-memory --stdio
 * Or:    node dist/stdio.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CONFIG } from './config.js';
import { search, getDocument, getStatus } from './qmd.js';
import { writeMemory, readMemory, listMemories, browseRecent } from './memory.js';

const mcp = new McpServer({
  name: 'open-memory',
  version: '0.1.0',
});

// Register the same tools as the HTTP server
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
  "Write/append to your memory. Defaults to today's daily note.",
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
  'List memory files.',
  { subdir: z.string().optional().describe('Subdirectory to list') },
  async ({ subdir }) => {
    const files = listMemories(subdir);
    return { content: [{ type: 'text' as const, text: files.join('\n') || 'No files found.' }] };
  }
);

mcp.tool(
  'browse_recent',
  'Browse recent daily notes with previews.',
  { days: z.number().min(1).max(30).default(7).describe('Number of recent days') },
  async ({ days }) => {
    const notes = browseRecent(days);
    if (!notes.length) return { content: [{ type: 'text' as const, text: 'No recent daily notes found.' }] };
    const text = notes.map(n => `## ${n.date}\n${n.preview}\n`).join('\n---\n');
    return { content: [{ type: 'text' as const, text }] };
  }
);

mcp.tool(
  'get_document',
  'Get full content of any indexed document.',
  {
    file: z.string().describe('File path or docid'),
    fromLine: z.number().optional(),
    maxLines: z.number().optional(),
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

mcp.tool('memory_status', 'Show memory index status.', {}, async () => {
  const status = await getStatus();
  return { content: [{ type: 'text' as const, text: status }] };
});

// Connect via stdio
const transport = new StdioServerTransport();
await mcp.connect(transport);
