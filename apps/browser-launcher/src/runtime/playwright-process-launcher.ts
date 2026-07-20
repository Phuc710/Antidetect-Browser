import net from 'node:net';

import type { BrowserLaunchPlan } from '../application/launch-plan-builder.js';
import type { ResolvedBrowserRuntime } from '../runtime-compatibility/browser-executable-resolver.js';

export interface BrowserProcessHandle {
    pid: number;
    wsEndpoint: string;
    automation: {
        protocol: 'cdp' | 'webdriver' | 'marionette';
        endpoint: string;
    };
    stop: () => Promise<void>;
    onExit: (listener: (exitCode?: number) => void) => () => void;
}

export class PlaywrightProcessLauncher {
    async launch(
        plan: BrowserLaunchPlan,
        resolvedRuntime: ResolvedBrowserRuntime,
    ): Promise<BrowserProcessHandle> {
        if (plan.runtime.engine !== 'chromium') {
            throw Object.assign(
                new Error(
                    'Only Chromium is supported by fingerprint injection in Phase 1.',
                ),
                {
                    code: 'BROWSER_ENGINE_UNAVAILABLE',
                },
            );
        }

        const playwright = await import('playwright');
        const port = await this.findAvailablePort();
        const closeListeners = new Set<(exitCode?: number) => void>();
        let intentionallyClosed = false;

        // Build Chromium arguments list
        const args = [
            ...plan.nativeArgs,
            `--remote-debugging-port=${port}`,
            '--remote-debugging-address=127.0.0.1',
        ];

        const server = await playwright.chromium.launchServer({
            executablePath: resolvedRuntime.executablePath,
            headless: plan.runtime.headless,
            ...(plan.proxy ? { proxy: plan.proxy } : {}),
            args,
        });

        const { pid } = server.process();
        if (!pid) {
            throw Object.assign(
                new Error('Chromium did not expose a process ID.'),
                {
                    code: 'LAUNCH_FAILED',
                },
            );
        }

        server.on('close', () => {
            if (!intentionallyClosed) {
                closeListeners.forEach((listener) => listener());
            }
        });

        return {
            pid,
            wsEndpoint: server.wsEndpoint(),
            automation: {
                protocol: 'cdp',
                endpoint: `http://127.0.0.1:${port}`,
            },
            stop: async () => {
                if (intentionallyClosed) return;
                intentionallyClosed = true;
                await server.close();
            },
            onExit: (listener) => {
                closeListeners.add(listener);
                return () => closeListeners.delete(listener);
            },
        };
    }

    private async findAvailablePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                const port =
                    typeof address === 'object' && address ? address.port : 0;
                server.close((error) =>
                    error ? reject(error) : resolve(port),
                );
            });
        });
    }
}
