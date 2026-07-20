import type { BrowserSession, SessionRegistry } from './session-registry.js';
import type { ProfileLockManager } from './profile-lock-manager.js';
import type { CookieSyncCoordinator } from '../cookies/cookie-sync-coordinator.js';
import type { ProcessTransport } from '../transport/process-transport.js';
import type { ProfileRuntimeState } from 'shared';

export type SessionTerminationReason =
  | 'user_stop'
  | 'browser_normal_exit'
  | 'browser_crash'
  | 'launcher_shutdown'
  | 'startup_failure'
  | 'force_kill';

export class SessionLifecycleManager {
  private readonly exitListeners = new Map<string, () => void>();

  constructor(
    private readonly registry: SessionRegistry,
    private readonly lockManager: ProfileLockManager,
    private readonly cookieSyncCoordinator: CookieSyncCoordinator,
    private readonly transport: ProcessTransport,
  ) {}

  watch(session: BrowserSession) {
    const removeListener = session.browserHandle.processHandle.onExit((exitCode?: number) => {
      const reason: SessionTerminationReason = (exitCode === 0 || exitCode === undefined)
        ? 'browser_normal_exit'
        : 'browser_crash';
      this.terminate(session, reason, exitCode).catch(() => {});
    });

    this.exitListeners.set(session.sessionId, removeListener);
  }

  async terminate(session: BrowserSession, reason: SessionTerminationReason, exitCode?: number): Promise<void> {
    const { sessionId, profileId } = session;

    // 1. Remove the exit listener to prevent duplicate termination triggers
    const removeListener = this.exitListeners.get(sessionId);
    if (removeListener) {
      removeListener();
      this.exitListeners.delete(sessionId);
    }

    // 2. Stop periodic cookie sync and execute final flush
    if (reason !== 'browser_crash' && reason !== 'force_kill') {
      await this.cookieSyncCoordinator.finalFlush(session).catch(() => {});
    } else {
      this.cookieSyncCoordinator.stop(sessionId);
    }

    // 3. Stop playwritght runtime context & browser process
    try {
      await session.browserHandle.stop();
    } catch {}

    // 4. Release lock files
    try {
      this.lockManager.releaseDurableLock(profileId, sessionId);
    } catch {}

    // 5. Remove registry session
    this.registry.remove(sessionId);

    // 6. Transition state & publish state change to parent
    let finalState: ProfileRuntimeState = 'stopped';
    let errorCode: string | undefined;

    if (reason === 'browser_crash') {
      finalState = 'crashed';
      errorCode = `Unexpected exit code: ${exitCode !== undefined ? exitCode : 'unknown'}`;
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
      sessions.map((session) => this.terminate(session, 'launcher_shutdown'))
    );
    this.lockManager.shutdown();
  }
}
