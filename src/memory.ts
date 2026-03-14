import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config.js';

function dailyNotePath(date?: string): string {
  const d = date || new Date().toISOString().slice(0, 10);
  return path.join(CONFIG.memoryDir, CONFIG.dailyNotesDir, `${d}.md`);
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Append content to today's daily note (or a specific file). */
export function writeMemory(content: string, file?: string): string {
  const target = file
    ? path.resolve(CONFIG.memoryDir, file)
    : dailyNotePath();

  ensureDir(target);

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  if (!fs.existsSync(target)) {
    // Create with header
    const date = path.basename(target, '.md');
    const header = `# Daily Notes — ${date}\n\n`;
    fs.writeFileSync(target, header, 'utf-8');
  }

  const entry = `\n## [${timestamp}]\n${content}\n`;
  fs.appendFileSync(target, entry, 'utf-8');

  return target;
}

/** Read a memory file by path (relative to memoryDir). */
export function readMemory(file: string): string {
  const target = path.resolve(CONFIG.memoryDir, file);
  if (!fs.existsSync(target)) {
    throw new Error(`File not found: ${file}`);
  }
  return fs.readFileSync(target, 'utf-8');
}

/** List memory files matching a pattern. */
export function listMemories(subdir?: string): string[] {
  const dir = subdir
    ? path.resolve(CONFIG.memoryDir, subdir)
    : path.resolve(CONFIG.memoryDir, CONFIG.dailyNotesDir);

  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();
}

/** Get recent daily notes. */
export function browseRecent(days = 7): Array<{ date: string; path: string; preview: string }> {
  const dir = path.resolve(CONFIG.memoryDir, CONFIG.dailyNotesDir);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, days);

  return files.map(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return {
      date: f.replace('.md', ''),
      path: path.join(CONFIG.dailyNotesDir, f),
      preview: lines.slice(0, 5).join('\n'),
    };
  });
}
