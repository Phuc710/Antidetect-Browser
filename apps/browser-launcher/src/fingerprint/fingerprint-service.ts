import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import type { BrowserContext, Page } from 'playwright';

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
      ...this.injector.getInjectableHeaders(fingerprint.headers, browserName),
    });

    // Resolve colorScheme from fingerprint envelope, fallback to 'no-preference'
    const colorScheme = (fingerprint as any).fingerprint?.colorScheme || 
                        (fingerprint as any).fingerprint?.navigator?.colorScheme || 
                        'no-preference';

    const applyScheme = async (page: Page) => {
      try {
        await page.emulateMedia({ colorScheme: colorScheme as any });
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
