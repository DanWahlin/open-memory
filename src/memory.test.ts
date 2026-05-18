import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const compiledDir = path.dirname(fileURLToPath(import.meta.url));
const memoryModulePath = path.join(compiledDir, 'memory.js');

function runMemoryScript(memoryDir: string, scriptBody: string) {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `
      import * as fs from 'node:fs';
      import * as path from 'node:path';
      process.env.MEMORY_DIR = ${JSON.stringify(memoryDir)};
      process.env.DAILY_NOTES_DIR = 'memory';
      const { readMemory, writeMemory, listMemories } = await import(${JSON.stringify(memoryModulePath)});
      ${scriptBody}
    `],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(`Script failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout.trim();
}

test('readMemory rejects absolute paths outside memory directory', () => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-memory-read-'));
  const outside = path.join(os.tmpdir(), `open-memory-outside-${process.pid}.md`);
  fs.writeFileSync(outside, 'outside secret', 'utf8');

  const output = runMemoryScript(memoryDir, `
    try {
      readMemory(${JSON.stringify(outside)});
      console.log('NO_THROW');
    } catch (error) {
      console.log(error.message);
    }
  `);

  assert.match(output, /absolute paths/i);
});

test('readMemory rejects parent traversal outside memory directory', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'open-memory-parent-'));
  const memoryDir = path.join(parent, 'memory-root');
  fs.mkdirSync(memoryDir);
  fs.writeFileSync(path.join(parent, 'outside.md'), 'outside secret', 'utf8');

  const output = runMemoryScript(memoryDir, `
    try {
      readMemory('../outside.md');
      console.log('NO_THROW');
    } catch (error) {
      console.log(error.message);
    }
  `);

  assert.match(output, /outside memory directory|path traversal/i);
});

test('writeMemory rejects absolute paths outside memory directory', () => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-memory-write-'));
  const outside = path.join(os.tmpdir(), `open-memory-write-outside-${process.pid}.md`);

  const output = runMemoryScript(memoryDir, `
    try {
      writeMemory('do not write', ${JSON.stringify(outside)});
      console.log('NO_THROW');
    } catch (error) {
      console.log(error.message);
    }
  `);

  assert.match(output, /absolute paths/i);
  assert.equal(fs.existsSync(outside), false);
});

test('listMemories rejects traversal outside memory directory', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'open-memory-list-'));
  const memoryDir = path.join(parent, 'memory-root');
  fs.mkdirSync(memoryDir);

  const output = runMemoryScript(memoryDir, `
    try {
      listMemories('..');
      console.log('NO_THROW');
    } catch (error) {
      console.log(error.message);
    }
  `);

  assert.match(output, /outside memory directory|path traversal/i);
});

test('writeMemory still appends to relative paths under memory directory', () => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-memory-ok-'));

  const output = runMemoryScript(memoryDir, `
    const target = writeMemory('safe note', 'projects/demo.md');
    console.log(JSON.stringify({ target, content: readMemory('projects/demo.md') }));
  `);
  const lines = output.split('\n');
  const parsed = JSON.parse(lines[lines.length - 1] || '{}');

  assert.equal(parsed.target, path.join(memoryDir, 'projects/demo.md'));
  assert.match(parsed.content, /safe note/);
});
