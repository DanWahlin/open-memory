import { config } from 'dotenv';
import * as path from 'path';
import * as os from 'os';

config();

export const CONFIG = {
  // QMD binary path
  qmdBin: process.env.QMD_BIN || 'qmd',

  // Memory directory (where MEMORY.md + memory/*.md live)
  memoryDir: process.env.MEMORY_DIR || path.join(os.homedir(), '.openclaw'),

  // Daily notes subdirectory within memoryDir
  dailyNotesDir: process.env.DAILY_NOTES_DIR || 'memory',

  // Main memory file
  mainMemoryFile: process.env.MAIN_MEMORY_FILE || 'MEMORY.md',

  // QMD collection to search (empty = search all)
  collection: process.env.QMD_COLLECTION || '',

  // Server port
  port: parseInt(process.env.PORT || '3838', 10),

  // Bearer token for auth (empty = no auth)
  authToken: process.env.OPEN_MEMORY_TOKEN || '',
};
