import net from 'net';
import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import type { Browser, BrowserContext, Page } from 'playwright';
import { FingerprintService } from './fingerprint-service.js';

export interface FingerprintReadinessExpectation {
  readonly userAgent: string;
  readonly platform: string;
  readonly language: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly injectedMarker: string;
}

export interface BrowserLaunchProxy {
  server: string;
  username?: string;
  password?: string;
}

export interface BrowserProcessHandle {
  pid: number;
  wsEndpoint: string;
  automation: {
    protocol: 'cdp' | 'webdriver' | 'marionette';
    endpoint: string;
  };
  stop: () => Promise<void>;
  onExit: (listener: (exitCode?: number) => void) => () => void;
}

export class PlaywrightProcessLauncher {
  async launch(options: {
    engine: 'chromium' | 'firefox' | 'webkit';
    distribution: string;
    channel: 'stable' | 'beta' | 'dev' | 'canary' | 'custom';
    browserVersion: string;
    architecture: 'x64' | 'arm64';
    automationProtocol: 'cdp' | 'webdriver' | 'marionette';
    userDataDir: string;
    headless: boolean;
    proxy?: BrowserLaunchProxy;
    userAgent?: string;
    language?: string;
    screenWidth?: number;
    screenHeight?: number;
  }): Promise<BrowserProcessHandle> {
    if (options.engine !== 'chromium') {
      throw Object.assign(new Error('Only Chromium is supported by fingerprint injection in Phase 1.'), {
        code: 'BROWSER_ENGINE_UNAVAILABLE',
      });
    }

    const playwright = await import('playwright');
    const port = await findAvailablePort();
    const closeListeners = new Set<(exitCode?: number) => void>();
    let intentionallyClosed = false;

    const args = [
      `--user-data-dir=${options.userDataDir}`,
      `--remote-debugging-port=${port}`,
      '--remote-debugging-address=127.0.0.1',
      '--disable-blink-features=AutomationControlled',
      ...(options.userAgent ? [`--user-agent=${options.userAgent}`] : []),
      ...(options.language ? [`--lang=${options.language}`] : []),
      ...(options.screenWidth && options.screenHeight ? [`--window-size=${options.screenWidth},${options.screenHeight}`] : []),
    ];

    const server = await playwright.chromium.launchServer({
      headless: options.headless,
      ...(options.proxy ? { proxy: options.proxy } : {}),
      args,
    });

    const pid = server.process().pid;
    if (!pid) throw Object.assign(new Error('Chromium did not expose a process ID.'), { code: 'LAUNCH_FAILED' });
    
    server.on('close', () => {
      if (!intentionallyClosed) closeListeners.forEach((listener) => listener());
    });

    return {
      pid,
      wsEndpoint: server.wsEndpoint(),
      automation: { protocol: 'cdp', endpoint: `http://127.0.0.1:${port}` },
      stop: async () => {
        if (intentionallyClosed) return;
        intentionallyClosed = true;
        await server.close();
      },
      onExit: (listener) => {
        closeListeners.add(listener);
        return () => closeListeners.delete(listener);
      },
    };
  }
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export class PlaywrightRuntimeAdapter {
  private readinessConfirmed = false;
  private configurationApplied = false;
  private stopped = false;

  private constructor(
    private readonly processHandle: BrowserProcessHandle,
    private readonly browser: Browser,
    private readonly context: BrowserContext,
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
    if (this.configurationApplied || this.readinessConfirmed) {
      throw new Error('Fingerprint configuration has already been applied.');
    }
    try {
      await this.fingerprintService.injectIntoContext(
        this.context,
        fingerprintWithHeaders,
        markerScript,
      );
      this.configurationApplied = true;
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

  async verifyReadiness(expected: FingerprintReadinessExpectation): Promise<void> {
    if (!this.configurationApplied) {
      throw new Error('Fingerprint configuration must be applied before readiness verification.');
    }
    let probe: Page | undefined;
    try {
      probe = await this.context.newPage();
      await probe.goto('about:blank');
      const result = await probe.evaluate<any>(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: screen.width,
        screenHeight: screen.height,
        injectedMarker: Reflect.get(window, '__fingerprintVersion'),
      }));
      const checks: ReadonlyArray<readonly [string, unknown, unknown]> = [
        ['userAgent', result.userAgent, expected.userAgent],
        ['platform', result.platform, expected.platform],
        ['language', result.language, expected.language],
        ['screenWidth', result.screenWidth, expected.screenWidth],
        ['screenHeight', result.screenHeight, expected.screenHeight],
        ['injectedMarker', result.injectedMarker, expected.injectedMarker],
      ];
      for (const [field, actual, wanted] of checks) {
        const passed = Object.is(actual, wanted);
        if (!passed) {
          throw new Error(`Fingerprint readiness check failed for ${field}.`);
        }
      }
      this.readinessConfirmed = true;
    } catch (error: unknown) {
      throw Object.assign(new Error('Fingerprint readiness probe failed.'), {
        code: 'FINGERPRINT_READINESS_FAILED',
        cause: error,
      });
    } finally {
      await probe?.close().catch(() => undefined);
    }
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
