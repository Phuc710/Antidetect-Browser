import type { Page } from 'playwright';

import type { BrowserLaunchPlan } from '../application/launch-plan-builder.js';
import type { PlaywrightRuntimeAdapter } from './playwright-runtime-adapter.js';

export interface ReadinessCheckResult {
  readonly id: string;
  readonly passed: boolean;
  readonly severity: 'critical' | 'warning';
  readonly expected?: unknown;
  readonly actual?: unknown;
}

export interface ReadinessReport {
  readonly ready: boolean;
  readonly durationMs: number;
  readonly checks: ReadinessCheckResult[];
}

export interface ReadinessCheck {
  readonly id: string;
  readonly severity: 'critical' | 'warning';
  execute(runtime: PlaywrightRuntimeAdapter, plan: BrowserLaunchPlan, probeData: any): Promise<{ passed: boolean; expected?: unknown; actual?: unknown }>;
}

export class ReadinessChecker {
  private readonly checks: ReadinessCheck[] = [
    // 1. Process Alive check
    {
      id: 'processAlive',
      severity: 'critical',
      async execute(runtime) {
        let isAlive = false;
        try {
          process.kill(runtime.processHandle.pid, 0);
          isAlive = true;
        } catch {
          // Process not alive or no permission to check
        }
        return { passed: isAlive, expected: true, actual: isAlive };
      }
    },
    // 2. CDP Connected check
    {
      id: 'cdpConnected',
      severity: 'critical',
      async execute(runtime) {
        const connected = runtime.browser.isConnected();
        return { passed: connected, expected: true, actual: connected };
      }
    },
    // 3. User Agent check
    {
      id: 'userAgent',
      severity: 'critical',
      async execute(runtime, plan, probeData) {
        const expected = plan.fingerprint.readiness.userAgent;
        const actual = probeData.userAgent;
        return { passed: actual === expected, expected, actual };
      }
    },
    // 4. Platform check
    {
      id: 'platform',
      severity: 'critical',
      async execute(runtime, plan, probeData) {
        const expected = plan.fingerprint.readiness.platform;
        const actual = probeData.platform;
        return { passed: actual === expected, expected, actual };
      }
    },
    // 5. Language check
    {
      id: 'language',
      severity: 'critical',
      async execute(runtime, plan, probeData) {
        const expected = plan.fingerprint.readiness.language;
        const actual = probeData.language;
        return { passed: actual === expected, expected, actual };
      }
    },
    // 6. Screen size checks
    {
      id: 'screenWidth',
      severity: 'critical',
      async execute(runtime, plan, probeData) {
        const expected = plan.fingerprint.readiness.screenWidth;
        const actual = probeData.screenWidth;
        return { passed: actual === expected, expected, actual };
      }
    },
    {
      id: 'screenHeight',
      severity: 'critical',
      async execute(runtime, plan, probeData) {
        const expected = plan.fingerprint.readiness.screenHeight;
        const actual = probeData.screenHeight;
        return { passed: actual === expected, expected, actual };
      }
    },
    // 7. Fingerprint marker check
    {
      id: 'fingerprintMarker',
      severity: 'critical',
      async execute(runtime, plan, probeData) {
        const expected = plan.fingerprint.readiness.injectedMarker;
        const actual = probeData.injectedMarker;
        return { passed: actual === expected, expected, actual };
      }
    }
  ];

  async verify(runtime: PlaywrightRuntimeAdapter, plan: BrowserLaunchPlan): Promise<ReadinessReport> {
    const startTime = Date.now();
    const checksResults: ReadinessCheckResult[] = [];
    
    let probe: Page | undefined;
    let probeData: any = {};
    
    try {
      probe = await runtime.context.newPage();
      await probe.goto('about:blank');
      probeData = await probe.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        injectedMarker: Reflect.get(window, '__fingerprintVersion'),
      }));
    } catch {
      // If page evaluation fails, it will fail all evaluation checks
    } finally {
      await probe?.close().catch(() => undefined);
    }

    for (const check of this.checks) {
      try {
        const res = await check.execute(runtime, plan, probeData);
        checksResults.push({
          id: check.id,
          passed: res.passed,
          severity: check.severity,
          expected: res.expected,
          actual: res.actual,
        });
      } catch (err: any) {
        checksResults.push({
          id: check.id,
          passed: false,
          severity: check.severity,
          message: err.message || 'Check failed with an exception.',
        } as any);
      }
    }

    const ready = checksResults.every((c) => c.severity !== 'critical' || c.passed);
    const durationMs = Date.now() - startTime;

    return {
      ready,
      durationMs,
      checks: checksResults,
    };
  }
}
