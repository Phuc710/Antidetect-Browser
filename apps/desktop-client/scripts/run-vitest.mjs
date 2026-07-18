import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const vitestEntry = resolve(import.meta.dirname, '../node_modules/vitest/vitest.mjs');
const result = spawnSync(electronBinary, [vitestEntry, ...process.argv.slice(2)], {
  cwd: resolve(import.meta.dirname, '..'),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
