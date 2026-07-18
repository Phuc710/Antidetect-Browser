import { readFileSync } from 'fs';

import {
    BrowserFingerprintWithHeaders,
    Fingerprint,
    type UserAgentData,
} from 'fingerprint-generator';

import type { BrowserContext } from 'playwright';
import type { Page } from 'puppeteer';

import { EnhancedFingerprint } from '../types';
import { REQUEST_HEADERS_TO_FILTER } from '../constants';

// ============================================================================
// Type declarations for functions defined in utils.js.
// These functions exist at runtime in the browser context (injected as a string),
// but need TypeScript declarations here since the inject() function body
// references them. TypeScript would otherwise report "cannot find name" errors.
// ============================================================================

/** Overrides getter properties on an instance's prototype using ES6 Proxy. */
declare function overrideInstancePrototype<T>(
    instance: T,
    overrideObj: Partial<T>,
): void;
/** Overrides `navigator.userAgentData` and `getHighEntropyValues()`. */
declare function overrideUserAgentData(userAgentData: UserAgentData): void;
/** Overrides `document.documentElement.clientWidth/Height`. */
declare function overrideDocumentDimensionsProps(
    props: Record<string, number>,
): void;
/** Overrides `window.innerWidth/Height`, `outerWidth/Height`, etc. */
declare function overrideWindowDimensionsProps(
    props: Record<string, number>,
): void;
/** Overrides `navigator.getBattery()` to return spoofed battery data. */
declare function overrideBattery(
    batteryInfo?: Record<string, string | number>,
): void;
/** Overrides `HTMLMediaElement.canPlayType()` with spoofed codec support. */
declare function overrideCodecs(
    audioCodecs: Record<string, string>,
    videoCodecs: Record<string, string>,
): void;
/** Overrides `WebGLRenderingContext.getParameter()` for GPU vendor/renderer. */
declare function overrideWebGl(
    webGlInfo: Record<'vendor' | 'renderer', string>,
): void;
/** Overrides the `Intl` API to use the specified language as default locale. */
declare function overrideIntlAPI(language: string): void;
/** Hides `SharedArrayBuffer` to prevent cross-origin isolation detection. */
declare function overrideStatic(): void;
/** Applies headless browser fixes (chrome object, permissions, plugins, iframes). */
declare function runHeadlessFixes(): void;
/** Blocks all WebRTC APIs with recursive Proxy to prevent IP leaks. */
declare function blockWebRTC(): void;

export class FingerprintInjector {
    // Loaded once at instantiation; contains all browser-side override functions as a string.
    private utilsJs = this._loadUtils();

    private onlyInjectableHeaders(
        headers: Record<string, string>,
        browserName?: string,
    ): Record<string, string> {
        const filteredHeaders = { ...headers };

        REQUEST_HEADERS_TO_FILTER.forEach((header) => {
            delete filteredHeaders[header];
        });

        // Chromium-based controlled browsers do not support `te` header.
        // Probably needs more investigation, but for now, we can just remove it.
        if (!(browserName?.toLowerCase().includes('firefox') ?? false)) {
            delete filteredHeaders.te;
        }

        return filteredHeaders;
    }

    async attachFingerprintToPlaywright(
        browserContext: BrowserContext,
        browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
    ): Promise<void> {
        const { fingerprint, headers } = browserFingerprintWithHeaders;
        const enhancedFingerprint = this._enhanceFingerprint(fingerprint);

        const content =
            this.getInjectableFingerprintFunction(enhancedFingerprint);

        const browserName = browserContext.browser()?.browserType().name();

        await browserContext.setExtraHTTPHeaders({
            ...this.onlyInjectableHeaders(headers, browserName),
            ...Object.fromEntries(
                // @ts-expect-error Accessing private property
                (browserContext._options?.extraHTTPHeaders ?? []).map(
                    ({ name, value }: { name: string; value: string }) => [
                        name,
                        value,
                    ],
                ),
            ),
        });

        browserContext.on('page', (page) => {
            page.emulateMedia({ colorScheme: 'dark' }).catch(() => {});
        });

        await browserContext.addInitScript({
            content,
        });
    }

    async attachFingerprintToPuppeteer(
        page: Page,
        browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
    ): Promise<void> {
        const { fingerprint, headers } = browserFingerprintWithHeaders;
        const enhancedFingerprint = this._enhanceFingerprint(fingerprint);
        const { screen, userAgent } = enhancedFingerprint;

        await page.setUserAgent(userAgent);

        const browserVersion = await page.browser().version();

        if (!browserVersion.toLowerCase().includes('firefox')) {
            await (
                await page.target().createCDPSession()
            ).send('Page.setDeviceMetricsOverride', {
                screenHeight: screen.height,
                screenWidth: screen.width,
                width: screen.width,
                height: screen.height,
                mobile: /phone|android|mobile/i.test(userAgent),
                screenOrientation:
                    screen.height > screen.width
                        ? { angle: 0, type: 'portraitPrimary' }
                        : { angle: 90, type: 'landscapePrimary' },
                deviceScaleFactor: screen.devicePixelRatio,
            });

            await page.setExtraHTTPHeaders(
                this.onlyInjectableHeaders(headers, browserVersion),
            );

            await page.emulateMediaFeatures([
                { name: 'prefers-color-scheme', value: 'dark' },
            ]);
        }

        await page.evaluateOnNewDocument(
            this.getInjectableFingerprintFunction(enhancedFingerprint),
        );
    }

    getInjectableScript(
        browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
    ): string {
        const { fingerprint } = browserFingerprintWithHeaders;
        const enhancedFingerprint = this._enhanceFingerprint(fingerprint);

        return this.getInjectableFingerprintFunction(enhancedFingerprint);
    }

    private getInjectableFingerprintFunction(
        fingerprint: EnhancedFingerprint,
    ): string {
        function inject() {
            const {
                battery,
                navigator: {
                    extraProperties,
                    userAgentData,
                    webdriver,
                    ...navigatorProps
                },
                screen: allScreenProps,
                videoCard,
                historyLength,
                audioCodecs,
                videoCodecs,
                mockWebRTC,
                slim,
                // @ts-expect-error internal browser code
            } = fp as EnhancedFingerprint;

            const {
                // window screen props
                outerHeight,
                outerWidth,
                devicePixelRatio,
                innerWidth,
                innerHeight,
                screenX,
                pageXOffset,
                pageYOffset,

                // Document screen props
                clientWidth,
                clientHeight,
                // Ignore hdr for now.

                hasHDR,
                // window.screen props
                ...newScreen
            } = allScreenProps;

            const windowScreenProps = {
                innerHeight,
                outerHeight,
                outerWidth,
                innerWidth,
                screenX,
                pageXOffset,
                pageYOffset,
                devicePixelRatio,
            };
            const documentScreenProps = {
                clientHeight,
                clientWidth,
            };

            runHeadlessFixes();

            if (mockWebRTC) blockWebRTC();

            if (slim) {
                // @ts-expect-error internal browser code
                // eslint-disable-next-line dot-notation
                window['slim'] = true;
            }

            overrideIntlAPI(navigatorProps.language);
            overrideStatic();

            if (userAgentData) {
                overrideUserAgentData(userAgentData);
            }

            if (window.navigator.webdriver) {
                (navigatorProps as any).webdriver = false;
            }
            overrideInstancePrototype(window.navigator, navigatorProps);

            overrideInstancePrototype(window.screen, newScreen);
            overrideWindowDimensionsProps(windowScreenProps);
            overrideDocumentDimensionsProps(documentScreenProps);

            overrideInstancePrototype(window.history, {
                length: historyLength,
            });

            overrideWebGl(videoCard);
            overrideCodecs(audioCodecs, videoCodecs);

            overrideBattery(battery);
        }

        const mainFunctionString: string = inject.toString();

        return `(()=>{${this.utilsJs}; const fp=${JSON.stringify(fingerprint)}; (${mainFunctionString})()})()`;
    }

    private _enhanceFingerprint(fingerprint: Fingerprint): EnhancedFingerprint {
        const { navigator, ...rest } = fingerprint;

        return {
            ...rest,
            navigator,
            userAgent: navigator.userAgent,
            historyLength: this._randomInRange(2, 6),
        };
    }

    /**
     * Reads `utils.js` as a raw string at runtime.
     * Must use `readFileSync` (not `path.join`) — Vercel's build system mangles `path.join`.
     * @see https://github.com/apify/fingerprint-suite/issues/135
     */
    private _loadUtils(): string {
        const utilsJs = readFileSync(`${__dirname}/../utils.js`);
        return `\n${utilsJs}\n`;
    }

    private _randomInRange(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min) + min);
    }
}
