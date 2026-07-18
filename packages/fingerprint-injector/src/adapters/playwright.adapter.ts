import {
    BrowserFingerprintWithHeaders,
    FingerprintGenerator,
    FingerprintGeneratorOptions,
} from 'fingerprint-generator';
import type {
    BrowserContext,
    Browser as PWBrowser,
    BrowserContextOptions,
} from 'playwright';

import { FingerprintInjector } from '../services/fingerprint-injector.service';

/**
 * Creates a new Playwright BrowserContext pre-injected with a generated fingerprint.
 */
export async function newInjectedContext(
    browser: PWBrowser,
    options?: {
        fingerprint?: BrowserFingerprintWithHeaders;
        fingerprintOptions?: Partial<FingerprintGeneratorOptions>;
        newContextOptions?: BrowserContextOptions;
    },
): Promise<BrowserContext> {
    const fingerprintWithHeaders =
        options?.fingerprint ??
        new FingerprintGenerator().getFingerprint(options?.fingerprintOptions);

    const { fingerprint, headers } = fingerprintWithHeaders;
    const context = await browser.newContext({
        userAgent: fingerprint.navigator.userAgent,
        colorScheme: 'dark',
        ...options?.newContextOptions,
        viewport: {
            width: fingerprint.screen.width,
            height: fingerprint.screen.height,
            ...options?.newContextOptions?.viewport,
        },
        extraHTTPHeaders: {
            'accept-language': headers['accept-language'],
            ...options?.newContextOptions?.extraHTTPHeaders,
        },
    });

    const injector = new FingerprintInjector();
    await injector.attachFingerprintToPlaywright(
        context,
        fingerprintWithHeaders,
    );

    return context;
}
