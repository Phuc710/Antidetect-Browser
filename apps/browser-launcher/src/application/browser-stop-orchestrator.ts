import { SessionRegistry } from '../runtime/session-registry.js';
import { SessionLifecycleManager } from '../runtime/session-lifecycle-manager.js';
import { LauncherError } from '../errors/launcher-error.js';

export class BrowserStopOrchestrator {
  constructor(
    private readonly registry: SessionRegistry,
    private readonly lifecycleManager: SessionLifecycleManager,
  ) {}

  async execute(sessionId: string): Promise<void> {
    const session = this.registry.getBySessionId(sessionId);
    if (!session) {
      // Return successfully if session is not found as requested by protocol
      return;
    }

    try {
      session.state = 'stopping';
      await this.lifecycleManager.terminate(session, 'user_stop');
    } catch (err: any) {
      throw LauncherError.browserStopFailed(
        err.message || 'Failed to stop browser session.',
        { sessionId }
      );
    }
  }
}
