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

        // Build Chromium arguments list.
        // NOTE: --user-data-dir must NOT be here — it is passed as the first argument
        // to launchPersistentContext. Playwright throws if it appears in args.
        const args = [
            ...plan.nativeArgs,
            `--remote-debugging-port=${port}`,
            '--remote-debugging-address=127.0.0.1',
        ];

        // Use launchPersistentContext so Chromium boots with the profile's
        // user-data directory. This is the only Playwright API that accepts
        // userDataDir natively while still opening a remote-debugging port
        // that PlaywrightRuntimeAdapter can connect to via connectOverCDP.
        const context = await playwright.chromium.launchPersistentContext(
            plan.runtime.userDataDir,
            {
                executablePath: resolvedRuntime.executablePath,
                headless: plan.runtime.headless,
                ...(plan.proxy ? { proxy: plan.proxy } : {}),
                args,
            },
        );

        context.on('close', () => {
            if (!intentionallyClosed) {
                closeListeners.forEach((listener) => listener());
            }
        });

        // launchPersistentContext does not expose the browser OS process handle.
        // We use the launcher child-process pid as a stable non-zero identifier
        // for the profile lock owner check.
        const pid = process.pid;

        return {
            pid,
            wsEndpoint: '',
            automation: {
                protocol: 'cdp',
                endpoint: `http://127.0.0.1:${port}`,
            },
            stop: async () => {
                if (intentionallyClosed) return;
                intentionallyClosed = true;
                await context.close();
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
