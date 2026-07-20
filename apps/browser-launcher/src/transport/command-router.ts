import type { LauncherCommand } from 'shared';

import { BrowserLaunchOrchestrator } from '../application/browser-launch-orchestrator.js';
import { BrowserStopOrchestrator } from '../application/browser-stop-orchestrator.js';
import { ShutdownOrchestrator } from '../application/shutdown-orchestrator.js';
import { SessionRegistry } from '../runtime/session-registry.js';
import { BrowserRuntimeRegistry } from '../runtime-compatibility/browser-runtime-registry.js';
import type { ProcessTransport } from './process-transport.js';

export class CommandRouter {
    private isInitialized = false;

    constructor(
        private readonly launchOrchestrator: BrowserLaunchOrchestrator,
        private readonly stopOrchestrator: BrowserStopOrchestrator,
        private readonly shutdownOrchestrator: ShutdownOrchestrator,
        private readonly registry: SessionRegistry,
        private readonly transport: ProcessTransport,
        private readonly runtimeRegistry: BrowserRuntimeRegistry,
    ) {}

    async route(cmd: LauncherCommand): Promise<void> {
        const { type, requestId } = cmd;

        switch (type) {
            case 'launcher:initialize': {
                const root =
                    cmd.payload.runtimesRoot ||
                    process.env.BROWSER_RUNTIMES_ROOT ||
                    './runtimes';
                const manifest =
                    cmd.payload.runtimesManifest ||
                    process.env.BROWSER_RUNTIMES_MANIFEST ||
                    './runtimes.json';
                await this.runtimeRegistry.initialize(root, manifest);

                this.isInitialized = true;
                this.transport.sendSuccess(requestId);
                break;
            }

            case 'profile:launch': {
                if (!this.isInitialized) {
                    throw new Error('Launcher is not initialized yet.');
                }
                const result = await this.launchOrchestrator.execute(
                    cmd.payload,
                );
                this.transport.sendSuccess(requestId, result);
                break;
            }

            case 'profile:stop': {
                if (!this.isInitialized) {
                    throw new Error('Launcher is not initialized yet.');
                }
                await this.stopOrchestrator.execute(cmd.payload.sessionId);
                this.transport.sendSuccess(requestId);
                break;
            }

            case 'runtime:snapshot': {
                const { sequence, sessions } = this.registry.createSnapshot();
                this.transport.sendSuccess(requestId, {
                    snapshotSequence: sequence,
                    capturedAt: new Date().toISOString(),
                    sessions,
                });
                break;
            }

            case 'launcher:shutdown': {
                await this.shutdownOrchestrator.execute();
                this.transport.sendSuccess(requestId);
                break;
            }

            default:
                throw new Error(`Unsupported command type: ${type}`);
        }
    }
}
