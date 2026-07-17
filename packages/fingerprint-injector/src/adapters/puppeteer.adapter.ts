import {
    BrowserFingerprintWithHeaders,
    FingerprintGenerator,
    FingerprintGeneratorOptions,
} from 'fingerprint-generator';
import type { Page, Browser as PPBrowser } from 'puppeteer';

import { FingerprintInjector } from '../services/fingerprint-injector.service';

/**
 * Creates a new Puppeteer Page pre-injected with a generated fingerprint.
 */
export async function newInjectedPage(
    browser: PPBrowser,
    options?: {
        fingerprint?: BrowserFingerprintWithHeaders;
        fingerprintOptions?: Partial<FingerprintGeneratorOptions>;
    },
): Promise<Page> {
    const generator = new FingerprintGenerator();
    const fingerprintWithHeaders =
        options?.fingerprint ??
        generator.getFingerprint(options?.fingerprintOptions);

    const page = await browser.newPage();

    const injector = new FingerprintInjector();
    await injector.attachFingerprintToPuppeteer(page, fingerprintWithHeaders);

    return page;
}
