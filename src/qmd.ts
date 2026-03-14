import { execFile } from 'child_process';
import { CONFIG } from './config.js';

interface SearchResult {
  file: string;
  score: number;
  snippet: string;
  line?: number;
}

function runQmd(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(CONFIG.qmdBin, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        reject(new Error(stderr || err.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function search(query: string, mode: 'search' | 'vsearch' | 'query' = 'vsearch', limit = 10, minScore = 0): Promise<SearchResult[]> {
  const args = [mode, query, '-n', String(limit), '--json'];
  if (minScore > 0) args.push('--min-score', String(minScore));
  if (CONFIG.collection) args.push('-c', CONFIG.collection);

  const raw = await runQmd(args);
  try {
    const parsed = JSON.parse(raw);
    const results = Array.isArray(parsed) ? parsed : parsed.results || [];
    return results.map((r: any) => ({
      file: r.file || r.docid || r.path || '',
      score: r.score || 0,
      snippet: r.snippet || r.text || r.content || '',
      line: r.line,
    }));
  } catch {
    // QMD might return plain text if --json isn't supported for this mode
    return [{ file: '', score: 0, snippet: raw.trim() }];
  }
}

export async function getDocument(file: string, fromLine?: number, maxLines?: number): Promise<string> {
  const args = ['get', file];
  if (fromLine) args.push('--from', String(fromLine));
  if (maxLines) args.push('-l', String(maxLines));
  args.push('--line-numbers');
  return runQmd(args);
}

export async function getStatus(): Promise<string> {
  return runQmd(['status']);
}

export async function listFiles(collection?: string): Promise<string> {
  const args = ['ls'];
  if (collection) args.push(collection);
  return runQmd(args);
}
