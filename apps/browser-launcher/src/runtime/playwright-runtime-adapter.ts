import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import type { BrowserContext, Cookie } from 'playwright';

import { FingerprintService } from '../fingerprint/fingerprint-service.js';
import type { BrowserProcessHandle } from './playwright-process-launcher.js';

type PlaywrightCookieInput = Parameters<BrowserContext['addCookies']>[0][number];

/**
 * Owns the live Playwright BrowserContext for a running profile session.
 *
 * Created via `PlaywrightRuntimeAdapter.fromContext()` — the context is passed
 * in directly from `launchPersistentContext`. There is no CDP reconnection.
 *
 * Responsibility:
 * - fingerprint injection (init scripts + HTTP headers)
 * - cookie restore and polling
 * - graceful stop (close context exactly once)
 * - forwarding context close events to lifecycle watchers
 */
export class PlaywrightRuntimeAdapter {
    private stopped = false;
    private readonly closeListeners = new Set<() => void>();

    private constructor(
        public readonly context: BrowserContext,
        private readonly handle: BrowserProcessHandle,
        private readonly fingerprintService: FingerprintService,
    ) {
        // Forward unexpected context close (not triggered by our own stop()) to
        // registered lifecycle listeners so the session can be cleaned up.
        const removeHandleListener = handle.onClose(() => {
            // The context was already closed (handle fires on unexpected close).
            // Mark stopped so our own stop() becomes a no-op if called afterward.
            this.stopped = true;
            for (const listener of this.closeListeners) {
                listener();
            }
        });

        // Clean up the handle listener when the adapter is stopped intentionally.
        this.cleanupHandleListener = removeHandleListener;
    }

    private readonly cleanupHandleListener: () => void;

    /**
     * Construct an adapter from the BrowserContext returned by
     * launchPersistentContext. Does NOT reconnect over CDP.
     */
    static fromContext(
        handle: BrowserProcessHandle,
        fingerprintService: FingerprintService = new FingerprintService(),
    ): PlaywrightRuntimeAdapter {
        return new PlaywrightRuntimeAdapter(handle.context, handle, fingerprintService);
    }

    /**
     * Register a listener that fires when the context closes unexpectedly
     * (i.e. not due to a call to stop()). Used by SessionLifecycleManager.
     *
     * Returns an unsubscribe function.
     */
    onClose(listener: () => void): () => void {
        this.closeListeners.add(listener);
        return () => this.closeListeners.delete(listener);
    }

    async applyFingerprint(
        fingerprintWithHeaders: BrowserFingerprintWithHeaders,
        markerScript: string,
    ): Promise<void> {
        try {
            await this.fingerprintService.injectIntoContext(
                this.context,
                fingerprintWithHeaders,
                markerScript,
            );
        } catch (error: unknown) {
            throw Object.assign(
                new Error('Failed to register fingerprint configuration.'),
                {
                    code: 'FINGERPRINT_INJECTION_FAILED',
                    cause: error,
                },
            );
        }
    }

    async injectCookies(cookies: PlaywrightCookieInput[]): Promise<void> {
        await this.context.addCookies(cookies);
    }

    async getCookies(): Promise<Cookie[]> {
        return this.context.cookies();
    }

    /**
     * Close the context exactly once. Idempotent — repeated calls are safe.
     */
    async stop(): Promise<void> {
        if (this.stopped) return;
        this.stopped = true;
        this.cleanupHandleListener();
        await this.handle.stop();
    }
}
