import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import type { BrowserContext, Page } from 'playwright';

function resolveColorScheme(
    fingerprint: BrowserFingerprintWithHeaders,
): 'dark' | 'light' | 'no-preference' {
    const raw =
        fingerprint && typeof fingerprint === 'object'
            ? (fingerprint as unknown as Record<string, unknown>)
            : null;
    const innerFingerprint =
        raw?.fingerprint && typeof raw.fingerprint === 'object'
            ? (raw.fingerprint as Record<string, unknown>)
            : null;

    let scheme: unknown = innerFingerprint?.colorScheme;
    if (
        typeof scheme !== 'string' &&
        innerFingerprint?.navigator &&
        typeof innerFingerprint.navigator === 'object'
    ) {
        const navigator = innerFingerprint.navigator as Record<string, unknown>;
        scheme = navigator.colorScheme;
    }

    if (scheme === 'dark' || scheme === 'light' || scheme === 'no-preference') {
        return scheme;
    }
    return 'no-preference';
}

export class FingerprintService {
    private readonly injector = new FingerprintInjector();

    compileInjectionScript(fingerprint: BrowserFingerprintWithHeaders): string {
        return this.injector.getInjectableScript(fingerprint);
    }

    async injectIntoContext(
        context: BrowserContext,
        fingerprint: BrowserFingerprintWithHeaders,
        markerScript: string,
    ): Promise<void> {
        const browserName = context.browser()?.browserType().name();

        // Set HTTP extra headers
        await context.setExtraHTTPHeaders({
            ...this.injector.getInjectableHeaders(
                fingerprint.headers,
                browserName,
            ),
        });

        // Resolve colorScheme from fingerprint envelope, fallback to 'no-preference'
        const colorScheme = resolveColorScheme(fingerprint);

        const applyScheme = async (page: Page) => {
            try {
                await page.emulateMedia({ colorScheme });
            } catch {
                // Ignore emulation failures on closed or detached pages
            }
        };

        // Apply to all existing pages
        for (const page of context.pages()) {
            await applyScheme(page);
        }

        // Listen to new pages
        context.on('page', (page) => {
            applyScheme(page).catch(() => {});
        });

        // Add native fingerprint override injection scripts
        const content = this.compileInjectionScript(fingerprint);
        await context.addInitScript({ content });
        await context.addInitScript({ content: markerScript });
    }
}
