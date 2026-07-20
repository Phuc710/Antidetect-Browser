import type { Browser, BrowserContext } from 'playwright';
import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import type { BrowserProcessHandle } from './playwright-process-launcher.js';
import { FingerprintService } from '../fingerprint/fingerprint-service.js';

export class PlaywrightRuntimeAdapter {
  private stopped = false;

  constructor(
    public readonly processHandle: BrowserProcessHandle,
    public readonly browser: Browser,
    public readonly context: BrowserContext,
    private readonly fingerprintService: FingerprintService,
  ) {}

  static async connect(
    processHandle: BrowserProcessHandle,
    fingerprintService: FingerprintService = new FingerprintService(),
  ): Promise<PlaywrightRuntimeAdapter> {
    const { chromium } = await import('playwright');
    let browser: Browser | undefined;
    try {
      browser = await chromium.connectOverCDP(processHandle.automation.endpoint);
      const context = browser.contexts()[0];
      if (!context) {
        throw new Error('Chromium did not expose its default automation context.');
      }
      return new PlaywrightRuntimeAdapter(processHandle, browser, context, fingerprintService);
    } catch (error: unknown) {
      await browser?.close().catch(() => undefined);
      await processHandle.stop().catch(() => undefined);
      throw Object.assign(new Error('Failed to create the internal browser context.'), {
        code: 'FINGERPRINT_INJECTION_FAILED',
        cause: error,
      });
    }
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
      throw Object.assign(new Error('Failed to register fingerprint configuration.'), {
        code: 'FINGERPRINT_INJECTION_FAILED',
        cause: error,
      });
    }
  }

  async injectCookies(cookies: any[]): Promise<void> {
    await this.context.addCookies(cookies);
  }

  async getCookies(): Promise<any[]> {
    return this.context.cookies();
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    let firstError: unknown;
    for (const close of [
      () => this.context.close(),
      () => this.browser.close(),
      () => this.processHandle.stop(),
    ]) {
      try {
        await close();
      } catch (error: unknown) {
        firstError ??= error;
      }
    }
    if (firstError !== undefined) throw firstError;
  }
}
