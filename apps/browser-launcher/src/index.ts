import { ProcessTransport } from './transport/process-transport.js';
import { CommandRouter } from './transport/command-router.js';
import { BrowserLaunchOrchestrator } from './application/browser-launch-orchestrator.js';
import { BrowserStopOrchestrator } from './application/browser-stop-orchestrator.js';
import { ShutdownOrchestrator } from './application/shutdown-orchestrator.js';
import { SessionRegistry } from './runtime/session-registry.js';
import { ProfileLockManager } from './runtime/profile-lock-manager.js';
import { SessionLifecycleManager } from './runtime/session-lifecycle-manager.js';
import { CookieSyncCoordinator } from './cookies/cookie-sync-coordinator.js';

const registry = new SessionRegistry();
const lockManager = new ProfileLockManager();

let router: CommandRouter;

const transport = new ProcessTransport(async (cmd) => {
  await router.route(cmd);
});

const cookieSyncCoordinator = new CookieSyncCoordinator(transport);
const lifecycleManager = new SessionLifecycleManager(registry, lockManager, cookieSyncCoordinator, transport);

const launchOrchestrator = new BrowserLaunchOrchestrator(
  registry,
  lockManager,
  lifecycleManager,
  cookieSyncCoordinator,
  transport
);

const stopOrchestrator = new BrowserStopOrchestrator(registry, lifecycleManager);
const shutdownOrchestrator = new ShutdownOrchestrator(lifecycleManager);

router = new CommandRouter(
  launchOrchestrator,
  stopOrchestrator,
  shutdownOrchestrator,
  registry,
  transport
);

// Listen to parent message loop
transport.start();

// Notify parent that the launcher process is ready to receive commands
transport.publishReady();
