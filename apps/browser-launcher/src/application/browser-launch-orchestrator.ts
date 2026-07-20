import type { LaunchProfilePayload } from 'shared';

import { CookieSyncCoordinator } from '../cookies/cookie-sync-coordinator.js';
import { LauncherError } from '../errors/launcher-error.js';
import { FingerprintService } from '../fingerprint/fingerprint-service.js';
import { type BrowserProcessHandle,PlaywrightProcessLauncher } from '../runtime/playwright-process-launcher.js';
import { PlaywrightRuntimeAdapter } from '../runtime/playwright-runtime-adapter.js';
import { ProfileLockManager } from '../runtime/profile-lock-manager.js';
import { ReadinessChecker } from '../runtime/readiness-checker.js';
import { SessionLifecycleManager } from '../runtime/session-lifecycle-manager.js';
import { type BrowserSession,SessionRegistry } from '../runtime/session-registry.js';
import { BrowserRuntimeRegistry } from '../runtime-compatibility/browser-runtime-registry.js';
import type { ProcessTransport } from '../transport/process-transport.js';
import { type BrowserLaunchPlan,LaunchPlanBuilder } from './launch-plan-builder.js';

export class LaunchCleanupScope {
  private lockAcquired = false;
  private processHandle: BrowserProcessHandle | null = null;
  private runtime: PlaywrightRuntimeAdapter | null = null;

  constructor(
    private readonly identity: { profileId: string; sessionId: string },
    private readonly lockManager: ProfileLockManager,
  ) {}

  markLockAcquired() {
    this.lockAcquired = true;
  }

  setProcessHandle(handle: BrowserProcessHandle) {
    this.processHandle = handle;
  }

  setRuntime(runtime: PlaywrightRuntimeAdapter) {
    this.runtime = runtime;
  }

  async cleanup(): Promise<void> {
    if (this.runtime) {
      await this.runtime.stop().catch(() => undefined);
    } else if (this.processHandle) {
      await this.processHandle.stop().catch(() => undefined);
    }
    if (this.lockAcquired) {
      try {
        this.lockManager.releaseDurableLock(this.identity.profileId, this.identity.sessionId);
      } catch {
        // Ignore lock release failures during cleanup
      }
    }
  }
}

export class BrowserLaunchOrchestrator {
  private readonly launchPlanBuilder = new LaunchPlanBuilder();
  private readonly processLauncher = new PlaywrightProcessLauncher();
  private readonly readinessChecker = new ReadinessChecker();
  private readonly fingerprintService = new FingerprintService();

  constructor(
    private readonly registry: SessionRegistry,
    private readonly lockManager: ProfileLockManager,
    private readonly lifecycleManager: SessionLifecycleManager,
    private readonly cookieSyncCoordinator: CookieSyncCoordinator,
    private readonly transport: ProcessTransport,
    private readonly runtimeRegistry: BrowserRuntimeRegistry,
  ) {}

  async execute(payload: LaunchProfilePayload): Promise<any> {
    const plan = this.launchPlanBuilder.build(payload);
    const scope = new LaunchCleanupScope(plan.identity, this.lockManager);

    try {
      // 1. Validating State Change Event
      this.publishState(plan, 'validating', 1);

      // Verify profile is not already running
      if (this.registry.getByProfileId(plan.identity.profileId)) {
        throw LauncherError.profileAlreadyRunning(plan.identity.profileId);
      }

      // 2. Resolve runtime & compatibility check (before lock acquisition)
      const resolvedRuntime = await this.runtimeRegistry.resolveAndVerify({
        engine: plan.runtime.engine,
        distribution: plan.runtime.distribution,
        channel: plan.runtime.channel,
        browserVersion: plan.runtime.browserVersion,
        architecture: plan.runtime.architecture,
      });

      // 3. Acquiring Locks
      this.publishState(plan, 'acquiring_lock', 2);
      this.lockManager.acquireDurableLock(
        plan.identity.profileId,
        plan.runtime.userDataDir,
        plan.identity.sessionId,
      );
      scope.markLockAcquired();

      // 4. Preparing configuration
      this.publishState(plan, 'preparing', 3);

      // 5. Launching native process with resolved executable path
      const processHandle = await this.processLauncher.launch(plan, resolvedRuntime);
      scope.setProcessHandle(processHandle);

      // 6. Starting & Connecting context
      this.publishState(plan, 'starting', 4);
      const runtime = await PlaywrightRuntimeAdapter.connect(processHandle, this.fingerprintService);
      scope.setRuntime(runtime);

      // Inject cookies if present
      if (plan.cookies.length > 0) {
        await runtime.injectCookies(plan.cookies);
      }

      // 7. Applying Fingerprint & Verification
      await runtime.applyFingerprint(
        plan.fingerprint.fingerprintWithHeaders,
        plan.fingerprint.markerScript,
      );

      const readinessReport = await this.readinessChecker.verify(runtime, plan);
      if (!readinessReport.ready) {
        throw LauncherError.readinessFailed({ report: readinessReport } as any);
      }

      const session: BrowserSession = {
        sessionId: plan.identity.sessionId,
        profileId: plan.identity.profileId,
        pid: processHandle.pid,
        state: 'running',
        startedAt: new Date().toISOString(),
        engine: plan.runtime.engine,
        distribution: plan.runtime.distribution,
        channel: plan.runtime.channel,
        browserVersion: plan.runtime.browserVersion,
        architecture: plan.runtime.architecture,
        automation: {
          protocol: processHandle.automation.protocol,
          endpoint: processHandle.automation.endpoint,
        },
        browserHandle: runtime,
      };

      // 8. Handing off running session
      this.registry.add(session);
      this.lifecycleManager.watch(session);
      this.cookieSyncCoordinator.start(session);

      this.publishState(plan, 'running', 5);

      return {
        sessionId: plan.identity.sessionId,
        profileId: plan.identity.profileId,
        state: 'running',
        pid: processHandle.pid,
        automation: session.automation,
        startedAt: session.startedAt,
      };
    } catch (error) {
      await scope.cleanup();
      throw error;
    }
  }

  private publishState(plan: BrowserLaunchPlan, state: any, sequence: number) {
    this.transport.send({
      type: 'runtime:changed',
      payload: {
        profileId: plan.identity.profileId,
        browserSessionId: plan.identity.sessionId,
        sequence,
        state,
        occurredAt: new Date().toISOString(),
      },
    });
  }
}
