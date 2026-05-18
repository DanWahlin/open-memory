import test from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'node:os';

test('default memory directory is neutral open-memory path', async () => {
  delete process.env.MEMORY_DIR;
  const configModule = await import(`./config.js?case=${Date.now()}-${Math.random()}`) as typeof import('./config.js');

  assert.equal(configModule.CONFIG.memoryDir, `${os.homedir()}/.open-memory`);
});
