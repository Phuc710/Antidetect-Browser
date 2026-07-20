import type { LaunchProfilePayload, ProfileRuntimeState } from 'shared';

import { CookieSyncCoordinator } from '../cookies/cookie-sync-coordinator.js';
import { LauncherError } from '../errors/launcher-error.js';
import { FingerprintService } from '../fingerprint/fingerprint-service.js';
import {
    type BrowserProcessHandle,
    PlaywrightProcessLauncher,
} from '../runtime/playwright-process-launcher.js';
import { PlaywrightRuntimeAdapter } from '../runtime/playwright-runtime-adapter.js';
import { ProfileLockManager } from '../runtime/profile-lock-manager.js';
import { ReadinessChecker } from '../runtime/readiness-checker.js';
import { SessionLifecycleManager } from '../runtime/session-lifecycle-manager.js';
import {
    type BrowserSession,
    SessionRegistry,
} from '../runtime/session-registry.js';
import { BrowserRuntimeRegistry } from '../runtime-compatibility/browser-runtime-registry.js';
import type { ProcessTransport } from '../transport/process-transport.js';
import {
    type BrowserLaunchPlan,
    LaunchPlanBuilder,
} from './launch-plan-builder.js';

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
                this.lockManager.releaseDurableLock(
                    this.identity.profileId,
                    this.identity.sessionId,
                );
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

    async execute(payload: LaunchProfilePayload): Promise<Record<string, unknown>> {
        const plan = this.launchPlanBuilder.build(payload);
        const scope = new LaunchCleanupScope(plan.identity, this.lockManager);
        let currentStage = 'initialize';
        let resolvedExecutablePath = '';

        try {
            // NOTE: Desktop Main creates the durable session record in 'validating'
            // state and publishes the event to the renderer before sending this
            // command. The child does NOT re-emit 'validating' to avoid duplicates.

            // 1. Verify profile is not already running
            if (this.registry.getByProfileId(plan.identity.profileId)) {
                throw LauncherError.profileAlreadyRunning(
                    plan.identity.profileId,
                );
            }

            // 2. Resolve runtime & compatibility check (before lock acquisition)
            currentStage = 'resolve_runtime';
            console.log(`[STAGE:${currentStage}] Resolving compatible browser runtime for ${plan.runtime.engine}/${plan.runtime.distribution}/${plan.runtime.browserVersion}...`);
            const resolvedRuntime = await this.runtimeRegistry.resolveAndVerify(
                {
                    engine: plan.runtime.engine,
                    distribution: plan.runtime.distribution,
                    channel: plan.runtime.channel,
                    browserVersion: plan.runtime.browserVersion,
                    architecture: plan.runtime.architecture,
                },
            );
            resolvedExecutablePath = resolvedRuntime.executablePath;
            console.log(`[STAGE:${currentStage}] Resolved executable: ${resolvedExecutablePath}`);

            // 3. Acquire durable profile lock
            currentStage = 'acquire_lock';
            this.publishState(plan, 'acquiring_lock', 2);
            console.log(`[STAGE:${currentStage}] Acquiring durable file lock for profile ${plan.identity.profileId}...`);
            this.lockManager.acquireDurableLock(
                plan.identity.profileId,
                plan.runtime.userDataDir,
                plan.identity.sessionId,
            );
            scope.markLockAcquired();
            console.log(`[STAGE:${currentStage}] Durable lock acquired.`);

            // 4. Preparing configuration
            currentStage = 'preparing';
            this.publishState(plan, 'preparing', 3);

            // 5. Launch persistent Chromium context
            currentStage = 'chromium_launch';
            console.log(`[STAGE:${currentStage}] Launching Chromium with persistent context at: ${resolvedExecutablePath}...`);
            const processHandle = await this.processLauncher.launch(
                plan,
                resolvedRuntime,
            );
            scope.setProcessHandle(processHandle);
            console.log(`[STAGE:${currentStage}] Chromium persistent context opened.`);

            // 6. Build runtime adapter from the returned context (no CDP reconnect)
            currentStage = 'starting';
            this.publishState(plan, 'starting', 4);
            const runtime = PlaywrightRuntimeAdapter.fromContext(
                processHandle,
                this.fingerprintService,
            );
            scope.setRuntime(runtime);

            // 7. Restore cookies before any page navigates
            if (plan.cookies.length > 0) {
                currentStage = 'cookie_injection';
                console.log(`[STAGE:${currentStage}] Restoring ${plan.cookies.length} cookies...`);
                // Playwright's Cookie type requires path:string. ValidatedCookie.path
                // is optional — default to '/' (the standard HTTP cookie default).
                const playwrightCookies = plan.cookies.map((c) => ({
                    ...c,
                    path: c.path ?? '/',
                }));
                await runtime.injectCookies(playwrightCookies);
                console.log(`[STAGE:${currentStage}] Cookies restored.`);
            }

            // 8. Register fingerprint init scripts before pages execute
            currentStage = 'fingerprint_injection';
            console.log(`[STAGE:${currentStage}] Registering fingerprint configuration...`);
            await runtime.applyFingerprint(
                plan.fingerprint.fingerprintWithHeaders,
                plan.fingerprint.markerScript,
            );
            console.log(`[STAGE:${currentStage}] Fingerprint registered.`);

            // 9. Readiness verification
            currentStage = 'readiness';
            console.log(`[STAGE:${currentStage}] Running readiness checks...`);
            const readinessReport = await this.readinessChecker.verify(
                runtime,
                plan,
            );
            if (!readinessReport.ready) {
                const failedChecks = readinessReport.checks
                    .filter((c) => !c.passed && c.severity === 'critical')
                    .map((c) => c.id);
                throw LauncherError.readinessFailed({
                    failedChecks,
                    durationMs: readinessReport.durationMs,
                });
            }
            console.log(`[STAGE:${currentStage}] Readiness verification passed.`);

            const startedAt = new Date().toISOString();
            const session: BrowserSession = {
                sessionId: plan.identity.sessionId,
                profileId: plan.identity.profileId,
                // browserPid is undefined for persistent-context launch â€”
                // launchPersistentContext does not expose the OS PID.
                browserPid: processHandle.browserPid,
                state: 'running',
                startedAt,
                engine: plan.runtime.engine,
                distribution: plan.runtime.distribution,
                channel: plan.runtime.channel,
                browserVersion: plan.runtime.browserVersion,
                architecture: plan.runtime.architecture,
                // No external automation endpoint for persistent-context sessions.
                automation: undefined,
                browserHandle: runtime,
            };

            // 10. Hand off running session
            this.registry.add(session);
            this.lifecycleManager.watch(session);
            this.cookieSyncCoordinator.start(session);

            this.publishState(plan, 'running', 5);

            return {
                sessionId: plan.identity.sessionId,
                profileId: plan.identity.profileId,
                state: 'running',
                // Truthful metadata: PID and automation endpoint are not available.
                browserPid: processHandle.browserPid ?? null,
                automation: null,
                startedAt,
            };
        } catch (err: unknown) {
            const stage = currentStage;
            console.error(`[LAUNCH_ERROR] Failed at stage: ${stage}`, err);

            // Wrap unknown errors as BROWSER_LAUNCH_FAILED for clean IPC serialization.
            if (err instanceof Error && !('code' in err)) {
                const wrapped = LauncherError.browserLaunchFailed(err.message, {
                    stage,
                    ...(resolvedExecutablePath ? { executablePath: resolvedExecutablePath } : {}),
                });
                (wrapped as Error & { cause?: unknown }).cause = err;
                await scope.cleanup();
                throw wrapped;
            }

            // For LauncherError or errors already carrying a typed code, attach stage
            // details without losing the typed code.
            if (err instanceof Error && 'code' in err) {
                (err as Error & { stage?: string }).stage = stage;
                if (resolvedExecutablePath) {
                    (err as Error & { executablePath?: string }).executablePath = resolvedExecutablePath;
                }
            }

            await scope.cleanup();
            throw err;
        }
    }

    private publishState(
        plan: BrowserLaunchPlan,
        state: ProfileRuntimeState,
        sequence: number,
    ) {
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
