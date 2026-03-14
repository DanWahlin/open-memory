#!/usr/bin/env node
/**
 * CLI entry point: open-memory [--stdio | --http]
 */

const mode = process.argv.includes('--stdio') ? 'stdio' : 'http';

if (mode === 'stdio') {
  await import('./stdio.js');
} else {
  await import('./server.js');
}
