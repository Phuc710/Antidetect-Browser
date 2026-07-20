import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import type { BrowserContext } from 'playwright';

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

    // Enforce dark mode preferences or emulation media features
    context.on('page', (page) => {
      page.emulateMedia({ colorScheme: 'dark' }).catch(() => {});
    });

    // Add native fingerprint override injection scripts
    const content = this.compileInjectionScript(fingerprint);
    await context.addInitScript({ content });
    await context.addInitScript({ content: markerScript });
  }
}
