/**
 * Example Anti-Detect Launcher Script
 * Demonstration of Phase 3 & Phase 4 integration (Proxy + Fingerprint Evasions)
 */
const playwright = require('playwright');
const { FingerprintGenerator } = require('fingerprint-generator');
const { FingerprintInjector } = require('fingerprint-injector');

async function checkProxy(proxyUrl) {
    console.log(`Checking proxy connectivity for: ${proxyUrl}...`);
    // Implement standard request verification. If offline, reject to avoid IP leaks.
    return true; // Mocked check
}

async function launchProfile(profileId, config) {
    const { proxy, os, browserName } = config;

    // 1. Verify proxy health
    const isProxyHealthy = await checkProxy(proxy);
    if (!isProxyHealthy) {
        throw new Error(`Proxy ${proxy} is unreachable. Aborting launch to prevent IP leak.`);
    }

    // 2. Generate a fingerprint aligned with profile preferences
    const generator = new FingerprintGenerator();
    const fingerprintWithHeaders = generator.getFingerprint({
        browsers: [browserName],
        operatingSystems: [os],
        devices: ['desktop'],
    });

    // 3. Inject canvas noise into the fingerprint configuration
    // Use the profileId as a seed to ensure the noise is unique yet consistent for this profile
    const seed = parseInt(profileId, 16) || 12345;
    fingerprintWithHeaders.fingerprint.canvasSeed = seed;

    console.log(`Launching profile browser: ${profileId}...`);
    const browser = await playwright.chromium.launch({
        headless: false,
        args: [
            `--user-data-dir=./profiles/${profileId}/cache`, // Profile isolation
            `--proxy-server=${proxy}`, // Proxy integration
            '--disable-blink-features=AutomationControlled',
        ],
    });

    const context = await browser.newContext();

    // 4. Inject anti-detect fingerprints
    const injector = new FingerprintInjector();
    await injector.attachFingerprintToPlaywright(context, fingerprintWithHeaders);

    const page = await context.newPage();
    
    // Add canvas override script dynamically
    await context.addInitScript((canvasSeed) => {
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function () {
            const imgData = originalGetImageData.apply(this, arguments);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = Math.sin(i / 4 + canvasSeed) * 2;
                data[i] = Math.min(255, Math.max(0, data[i] + Math.round(noise)));
            }
            return imgData;
        };
    }, seed);

    await page.goto('https://creepjs-demo.vercel.app/test'); // Test page
    
    return { browser, context, page };
}

module.exports = { launchProfile };
