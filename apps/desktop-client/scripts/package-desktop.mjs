import { rmSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { spawn, spawnSync } from 'child_process';

const appDir = resolve(import.meta.dirname, '..');
const workspaceDir = resolve(appDir, '..', '..');
const stagingDir = resolve(appDir, '.packaging');
if (dirname(stagingDir) !== appDir || basename(stagingDir) !== '.packaging') {
  throw new Error(`Unsafe packaging staging path: ${stagingDir}`);
}
rmSync(stagingDir, { recursive: true, force: true });

const timeoutValue = Number(process.env.DESKTOP_PACKAGE_STAGE_TIMEOUT_MS ?? 600_000);
if (!Number.isSafeInteger(timeoutValue) || timeoutValue < 1_000) {
  throw new Error('DESKTOP_PACKAGE_STAGE_TIMEOUT_MS must be an integer of at least 1000.');
}

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli || !basename(pnpmCli).startsWith('pnpm')) {
  throw new Error('package-desktop.mjs must be launched from a pnpm script.');
}

function stopProcessTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // The process may already have exited between the timeout and cleanup.
  }
}

async function runStage(name, args, cwd) {
  const startedAt = Date.now();
  console.log(`[desktop-package] stage=${name} status=starting timeoutMs=${timeoutValue}`);
  const child = spawn(process.execPath, [pnpmCli, ...args], {
    cwd,
    detached: process.platform !== 'win32',
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  console.log(`[desktop-package] stage=${name} childPid=${child.pid ?? 'unavailable'}`);

  await new Promise((resolveStage, rejectStage) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) stopProcessTree(child.pid);
    }, timeoutValue);
    child.once('error', (error) => {
      clearTimeout(timer);
      rejectStage(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[desktop-package] stage=${name} status=${timedOut ? 'timeout' : 'finished'} elapsedMs=${elapsedMs} exitCode=${code ?? 'null'} signal=${signal ?? 'none'}`,
      );
      if (timedOut) {
        rejectStage(new Error(`Packaging stage ${name} exceeded ${timeoutValue} ms.`));
      } else if (code !== 0) {
        rejectStage(new Error(`Packaging stage ${name} failed with exit code ${code ?? 'null'}.`));
      } else {
        resolveStage();
      }
    });
  });
}

await runStage('workspace-deploy', [
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
await runStage('electron-builder', builderArgs, appDir);
