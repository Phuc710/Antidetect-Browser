import { rmSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { spawnSync } from 'child_process';

const appDir = resolve(import.meta.dirname, '..');
const workspaceDir = resolve(appDir, '..', '..');
const stagingDir = resolve(appDir, '.packaging');
if (dirname(stagingDir) !== appDir || basename(stagingDir) !== '.packaging') {
  throw new Error(`Unsafe packaging staging path: ${stagingDir}`);
}
rmSync(stagingDir, { recursive: true, force: true });

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli || !basename(pnpmCli).startsWith('pnpm')) {
  throw new Error('package-desktop.mjs must be launched from a pnpm script.');
}
function run(args, cwd) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([
  '--filter',
  'desktop-client',
  'deploy',
  '--prod',
  '--legacy',
  'apps/desktop-client/.packaging',
], workspaceDir);

const builderArgs = [
  '--filter',
  'desktop-client',
  'exec',
  'electron-builder',
  ...(process.argv.includes('--dir') ? ['--dir'] : []),
  '--projectDir',
  '.packaging',
  '--config',
  '../electron-builder.yml',
  '--config.directories.output=../dist',
];
run(builderArgs, appDir);
