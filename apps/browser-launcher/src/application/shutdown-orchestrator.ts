import { SessionLifecycleManager } from '../runtime/session-lifecycle-manager.js';

export class ShutdownOrchestrator {
  constructor(private readonly lifecycleManager: SessionLifecycleManager) {}

  async execute(): Promise<void> {
    await this.lifecycleManager.forceShutdown();
    process.exit(0);
  }
}
