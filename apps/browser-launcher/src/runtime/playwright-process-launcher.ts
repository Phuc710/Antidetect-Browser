import type { BrowserContext } from 'playwright';

import type { BrowserLaunchPlan } from '../application/launch-plan-builder.js';
import type { ResolvedBrowserRuntime } from '../runtime-compatibility/browser-executable-resolver.js';

/**
 * Handle returned after a successful persistent-context launch.
 *
 * - `context` is the live Playwright BrowserContext. It IS the browser session.
 * - `browserPid` is optional: launchPersistentContext does not expose the OS
 *   process ID through a supported public API. Callers must not substitute the
 *   launcher child-process PID.
 * - There is no external automation endpoint. Internal Playwright control is
 *   exercised through the context object directly.
 */
export interface BrowserProcessHandle {
    readonly context: BrowserContext;
    readonly browserPid: number | undefined;
    stop(): Promise<void>;
    onClose(listener: () => void): () => void;
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
        const closeListeners = new Set<() => void>();
        let intentionallyClosed = false;

        // Build Chromium arguments list.
        // NOTE: --user-data-dir must NOT appear here — it is the first positional
        // argument to launchPersistentContext. Playwright throws if it appears in args.
        const args = [
            ...plan.nativeArgs,
        ];

        // launchPersistentContext opens Chromium with the profile's user-data
        // directory and returns the BrowserContext directly. We own the context
        // here — there is no separate Browser handle or external CDP endpoint.
        let context: import('playwright').BrowserContext;
        try {
            context = await playwright.chromium.launchPersistentContext(
                plan.runtime.userDataDir,
                {
                    executablePath: resolvedRuntime.executablePath,
                    headless: plan.runtime.headless,
                    ...(plan.proxy ? { proxy: plan.proxy } : {}),
                    args,
                },
            );
        } catch (err: unknown) {
            throw Object.assign(
                new Error(
                    `Chromium could not be launched: ${err instanceof Error ? err.message : String(err)}`,
                ),
                {
                    code: 'BROWSER_LAUNCH_FAILED',
                    cause: err,
                },
            );
        }

        // Propagate unexpected context close to registered listeners.
        context.on('close', () => {
            if (!intentionallyClosed) {
                for (const listener of closeListeners) {
                    listener();
                }
            }
        });

        // Chromium OS process ID is not exposed by launchPersistentContext through
        // supported public Playwright APIs. We do not substitute the launcher
        // child-process PID — that would misrepresent lock ownership.
        return {
            context,
            browserPid: undefined,
            stop: async () => {
                if (intentionallyClosed) return;
                intentionallyClosed = true;
                await context.close();
            },
            onClose: (listener) => {
                closeListeners.add(listener);
                return () => closeListeners.delete(listener);
            },
        };
    }
}
