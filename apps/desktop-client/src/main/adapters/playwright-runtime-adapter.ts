import type { Browser, BrowserContext, Page } from 'playwright';
import type {
  AutomationConnection,
  BrowserProcessHandle,
} from '../services/browser-application-service.js';
import { FingerprintPipelineError } from '../services/fingerprint-envelope-validator.js';
import { Logger } from '../services/logger.js';

const logger = new Logger('PlaywrightRuntimeAdapter');

export interface BrowserRuntimeContextSeed {
  readonly userAgent: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly deviceScaleFactor: number;
}

export interface FingerprintReadinessExpectation {
  readonly userAgent: string;
  readonly platform: string;
  readonly language: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly injectedMarker: string;
}

export interface BrowserRuntimeSession {
  readonly pid: number;
  applyPrePageConfiguration(headers: Record<string, string>, initScript: string): Promise<void>;
  verifyReadiness(expected: FingerprintReadinessExpectation): Promise<void>;
  getAutomationEndpoint(): AutomationConnection;
  stop(): Promise<void>;
  onExit(listener: (exitCode?: number) => void): () => void;
}

export interface BrowserRuntimeSessionFactory {
  connect(
    process: BrowserProcessHandle,
    contextSeed: BrowserRuntimeContextSeed,
  ): Promise<BrowserRuntimeSession>;
}

interface ReadinessProbeResult {
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  injectedMarker: unknown;
}

export class PlaywrightRuntimeAdapter implements BrowserRuntimeSession {
  private readinessConfirmed = false;
  private configurationApplied = false;
  private stopped = false;

  private constructor(
    private readonly process: BrowserProcessHandle,
    private readonly browser: Browser,
    private readonly context: BrowserContext,
  ) {}

  static async connect(
    process: BrowserProcessHandle,
    _contextSeed: BrowserRuntimeContextSeed,
  ): Promise<PlaywrightRuntimeAdapter> {
    const { chromium } = await import('playwright');
    let browser: Browser | undefined;
    try {
      if (process.automation.protocol !== 'cdp') {
        throw new FingerprintPipelineError(
          'FINGERPRINT_INJECTION_FAILED',
          'Chromium runtime requires a CDP automation endpoint.',
        );
      }
      browser = await chromium.connectOverCDP(process.automation.endpoint);
      const context = browser.contexts()[0];
      if (!context) {
        throw new FingerprintPipelineError(
          'FINGERPRINT_INJECTION_FAILED',
          'Chromium did not expose its default automation context.',
        );
      }
      return new PlaywrightRuntimeAdapter(process, browser, context);
    } catch (error: unknown) {
      await browser?.close().catch(() => undefined);
      await process.stop().catch(() => undefined);
      throw new FingerprintPipelineError(
        'FINGERPRINT_INJECTION_FAILED',
        'Failed to create the internal browser context.',
        { cause: error },
      );
    }
  }

  get pid(): number {
    return this.process.pid;
  }

  async applyPrePageConfiguration(
    headers: Record<string, string>,
    initScript: string,
  ): Promise<void> {
    if (this.configurationApplied || this.readinessConfirmed) {
      throw new FingerprintPipelineError(
        'FINGERPRINT_INJECTION_FAILED',
        'Fingerprint configuration has already been applied.',
      );
    }
    try {
      await this.context.setExtraHTTPHeaders(headers);
      await this.context.addInitScript({ content: initScript });
      this.configurationApplied = true;
    } catch (error: unknown) {
      throw new FingerprintPipelineError(
        'FINGERPRINT_INJECTION_FAILED',
        'Failed to register fingerprint configuration.',
        { cause: error },
      );
    }
  }

  async verifyReadiness(expected: FingerprintReadinessExpectation): Promise<void> {
    if (!this.configurationApplied) {
      throw new FingerprintPipelineError(
        'FINGERPRINT_READINESS_FAILED',
        'Fingerprint configuration must be applied before readiness verification.',
      );
    }
    let probe: Page | undefined;
    try {
      probe = await this.context.newPage();
      await probe.goto('about:blank');
      const result = await probe.evaluate<ReadinessProbeResult>(() => ({
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
        logger.debug('Fingerprint readiness field checked.', { field, result: passed ? 'pass' : 'fail' });
        if (!passed) {
          throw new FingerprintPipelineError(
            'FINGERPRINT_READINESS_FAILED',
            `Fingerprint readiness check failed for ${field}.`,
          );
        }
      }
      this.readinessConfirmed = true;
    } catch (error: unknown) {
      if (error instanceof FingerprintPipelineError) throw error;
      throw new FingerprintPipelineError(
        'FINGERPRINT_READINESS_FAILED',
        'Fingerprint readiness probe failed.',
        { cause: error },
      );
    } finally {
      await probe?.close().catch(() => undefined);
    }
  }

  getAutomationEndpoint(): AutomationConnection {
    if (!this.readinessConfirmed) {
      throw new FingerprintPipelineError(
        'FINGERPRINT_READINESS_FAILED',
        'Automation endpoint is unavailable before fingerprint readiness.',
      );
    }
    return { ...this.process.automation };
  }

  onExit(listener: (exitCode?: number) => void): () => void {
    return this.process.onExit(listener);
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    let firstError: unknown;
    for (const close of [
      () => this.context.close(),
      () => this.browser.close(),
      () => this.process.stop(),
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

export class PlaywrightRuntimeSessionFactory implements BrowserRuntimeSessionFactory {
  connect(
    process: BrowserProcessHandle,
    contextSeed: BrowserRuntimeContextSeed,
  ): Promise<BrowserRuntimeSession> {
    return PlaywrightRuntimeAdapter.connect(process, contextSeed);
  }
}
