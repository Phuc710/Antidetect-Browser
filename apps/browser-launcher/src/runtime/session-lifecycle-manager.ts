import type { ProfileRuntimeState } from 'shared';

import type { CookieSyncCoordinator } from '../cookies/cookie-sync-coordinator.js';
import type { ProcessTransport } from '../transport/process-transport.js';
import type { ProfileLockManager } from './profile-lock-manager.js';
import type { BrowserSession, SessionRegistry } from './session-registry.js';

export type SessionTerminationReason =
    | 'user_stop'
    | 'browser_normal_exit'
    | 'browser_crash'
    | 'launcher_shutdown'
    | 'startup_failure'
    | 'force_kill';

export class SessionLifecycleManager {
    /**
     * Maps sessionId → unsubscribe function returned by adapter.onClose().
     * Called to prevent duplicate termination after the first close event.
     */
    private readonly closeUnsubscribers = new Map<string, () => void>();

    constructor(
        private readonly registry: SessionRegistry,
        private readonly lockManager: ProfileLockManager,
        private readonly cookieSyncCoordinator: CookieSyncCoordinator,
        private readonly transport: ProcessTransport,
    ) {}

    /**
     * Register an unexpected-close listener on the adapter.
     * When the BrowserContext closes without an explicit stop() call,
     * the session is terminated with reason 'browser_crash' or
     * 'browser_normal_exit' (both map to stopped/crashed state).
     */
    watch(session: BrowserSession) {
        const unsubscribe = session.browserHandle.onClose(() => {
            // Treat unexpected close as a crash (we did not call stop()).
            this.terminate(session, 'browser_crash').catch(() => {});
        });

        this.closeUnsubscribers.set(session.sessionId, unsubscribe);
    }

    async terminate(
        session: BrowserSession,
        reason: SessionTerminationReason,
    ): Promise<void> {
        const { sessionId, profileId } = session;

        // 1. Remove the close listener to prevent duplicate termination triggers.
        const unsubscribe = this.closeUnsubscribers.get(sessionId);
        if (unsubscribe) {
            unsubscribe();
            this.closeUnsubscribers.delete(sessionId);
        }

        // 2. Stop periodic cookie sync and execute final flush.
        if (reason !== 'browser_crash' && reason !== 'force_kill') {
            await this.cookieSyncCoordinator
                .finalFlush(session)
                .catch(() => {});
        } else {
            this.cookieSyncCoordinator.stop(sessionId);
        }

        // 3. Stop the Playwright runtime context & close the browser.
        try {
            await session.browserHandle.stop();
        } catch {
            // Ignored: context might have already closed.
        }

        // 4. Release durable profile lock.
        try {
            this.lockManager.releaseDurableLock(profileId, sessionId);
        } catch {
            // Ignored: lock might have already been released.
        }

        // 5. Remove from live registry.
        this.registry.remove(sessionId);

        // 6. Publish final state to Electron Main.
        let finalState: ProfileRuntimeState = 'stopped';
        let errorCode: string | undefined;

        if (reason === 'browser_crash') {
            finalState = 'crashed';
            errorCode = 'BROWSER_PROCESS_UNEXPECTED_EXIT';
        }

        this.transport.send({
            type: 'runtime:changed',
            payload: {
                profileId,
                browserSessionId: sessionId,
                sequence: 2,
                state: finalState,
                occurredAt: new Date().toISOString(),
                ...(errorCode ? { errorCode } : {}),
            },
        });
    }

    async forceShutdown(): Promise<void> {
        const sessions = this.registry.list();
        await Promise.allSettled(
            sessions.map((session) =>
                this.terminate(session, 'launcher_shutdown'),
            ),
        );
        this.lockManager.shutdown();
    }
}
