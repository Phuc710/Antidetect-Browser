import { newInjectedContext, newInjectedPage } from 'fingerprint-injector';
import playwright from 'playwright';
import puppeteer from 'puppeteer';

import { describe, test } from 'vitest';

function everyAeveryB(A: any, B: any) {
    const matrix = [];
    for (const a of A) {
        for (const b of B) {
            matrix.push([a, b]);
        }
    }
    return matrix;
}

describe('Playwright controlled instances', () => {
    const runnableBrowsers = [
        'chromium',
        'firefox',
        // 'webkit',
    ] as const;
    const fingerprintBrowsers = [
        'chrome',
        'firefox',
        'safari',
        'edge',
    ] as const;

    test.each(everyAeveryB(runnableBrowsers, fingerprintBrowsers))(
        `[%s] should inject %s fingerprint`,
        async (
            browserType: (typeof runnableBrowsers)[number],
            fingerprintBrowser: (typeof fingerprintBrowsers)[number],
        ) => {
            const browser = await playwright[browserType].launch();
            try {
                const context = await newInjectedContext(browser, {
                    fingerprintOptions: {
                        browsers: [fingerprintBrowser],
                    },
                });

                const page = await context.newPage();

                await page.goto('https://crawlee.dev');
            } finally {
                await browser.close();
            }
        },
    );
});

describe('Puppeteer controlled instances', () => {
    const runnableBrowsers = ['chrome', 'firefox'] as const;
    const fingerprintBrowsers = [
        'chrome',
        'firefox',
        'safari',
        'edge',
    ] as const;

    test.each(everyAeveryB(runnableBrowsers, fingerprintBrowsers))(
        `[%s] should inject %s fingerprint`,
        async (
            browserType: (typeof runnableBrowsers)[number],
            fingerprintBrowser: (typeof fingerprintBrowsers)[number],
        ) => {
            const browser = await puppeteer.launch({
                browser: browserType,
            });
            try {
                const page = await newInjectedPage(browser, {
                    fingerprintOptions: {
                        browsers: [fingerprintBrowser],
                    },
                });

                await page.goto('https://crawlee.dev');
            } finally {
                await browser.close();
            }
        },
    );
});
