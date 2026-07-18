import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const unpackedRoot = join(import.meta.dirname, '..', 'dist', 'win-unpacked');
const resources = join(unpackedRoot, 'resources');
const appAsar = join(resources, 'app.asar');
const injectorUtils = join(
  resources,
  'app.asar.unpacked',
  'node_modules',
  'fingerprint-injector',
  'dist',
  'utils.js',
);

if (!existsSync(appAsar)) throw new Error(`Packaged app.asar is missing: ${appAsar}`);
if (!existsSync(injectorUtils)) {
  throw new Error(`fingerprint-injector utils.js was not unpacked: ${injectorUtils}`);
}

const executableName = readdirSync(unpackedRoot).find((name) => name.endsWith('.exe'));
if (!executableName) throw new Error(`Packaged Electron executable is missing: ${unpackedRoot}`);
const executable = join(unpackedRoot, executableName);
const packagedModule = join(appAsar, 'node_modules', 'fingerprint-injector');
const probe = `
  const { FingerprintInjector } = require(${JSON.stringify(packagedModule)});
  const injector = new FingerprintInjector();
  const result = injector.getInjectableHeaders({ accept: 'drop', 'x-smoke': 'ok' }, 'chromium');
  if (result['x-smoke'] !== 'ok' || result.accept !== undefined) process.exit(2);
`;
const result = spawnSync(executable, ['-e', probe], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  encoding: 'utf8',
  windowsHide: true,
});
if (result.status !== 0) {
  throw new Error(`Packaged injector execution failed (${result.status}): ${result.stderr || result.stdout}`);
}
console.log('Packaged fingerprint-injector smoke test passed.');
