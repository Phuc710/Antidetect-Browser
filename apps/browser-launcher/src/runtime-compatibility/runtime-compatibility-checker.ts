import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ResolvedBrowserRuntime } from './browser-executable-resolver.js';
import type { SupportedArchitecture, SupportedPlatform } from './runtime-manifest-reader.js';

const execFileAsync = promisify(execFile);
const VERSION_CHECK_TIMEOUT_MS = 2000;

export type RuntimeCompatibilityCode =
  | 'VERSION_MISMATCH'
  | 'VERSION_UNDETECTABLE'
  | 'VERSION_CHECK_TIMEOUT'
  | 'EXECUTABLE_START_FAILED'
  | 'ARCHITECTURE_MISMATCH';

export interface RuntimeCompatibilityIssue {
  readonly code: RuntimeCompatibilityCode;
  readonly message: string;
  readonly severity: 'critical' | 'warning';
}

export interface RuntimeCompatibilityReport {
  readonly compatible: boolean;
  readonly issues: RuntimeCompatibilityIssue[];
  readonly actualVersion?: string;
}

export interface ArchitectureCompatibilityPolicy {
  isCompatible(
    host: SupportedArchitecture,
    target: SupportedArchitecture,
    platform: SupportedPlatform,
  ): boolean;
}

export class StrictArchitectureCompatibilityPolicy implements ArchitectureCompatibilityPolicy {
  isCompatible(
    host: SupportedArchitecture,
    target: SupportedArchitecture,
    _platform: SupportedPlatform,
  ): boolean {
    return host === target;
  }
}

export class RuntimeCompatibilityChecker {
  constructor(
    private readonly archPolicy: ArchitectureCompatibilityPolicy = new StrictArchitectureCompatibilityPolicy()
  ) {}

  async check(resolved: ResolvedBrowserRuntime): Promise<RuntimeCompatibilityReport> {
    const issues: RuntimeCompatibilityIssue[] = [];
    let actualVersion: string | undefined;

    let hostArch: SupportedArchitecture = 'x64';
    if (process.arch === 'arm64') {
      hostArch = 'arm64';
    }
    const targetArch = resolved.descriptor.architecture;

    let platform: SupportedPlatform = 'linux';
    if (process.platform === 'win32') {
      platform = 'win32';
    } else if (process.platform === 'darwin') {
      platform = 'darwin';
    }

    if (!this.archPolicy.isCompatible(hostArch, targetArch, platform)) {
      issues.push({
        code: 'ARCHITECTURE_MISMATCH',
        message: `Incompatible target architecture "${targetArch}" for host architecture "${hostArch}" on platform "${platform}".`,
        severity: 'critical',
      });
    }

    // 2. Detect actual version
    try {
      const args = process.platform === 'win32' ? ['--product-version'] : ['--version'];
      
      const { stdout } = await execFileAsync(resolved.executablePath, args, {
        timeout: VERSION_CHECK_TIMEOUT_MS,
        windowsHide: true,
      });

      const match = stdout.match(/\b\d+\.\d+\.\d+(\.\d+)?\b/);
      if (match) {
        actualVersion = match[0];
        const expectedVersion = resolved.descriptor.browserVersion;

        const actualMajor = actualVersion.split('.')[0];
        const expectedMajor = expectedVersion.split('.')[0];

        if (actualMajor !== expectedMajor) {
          issues.push({
            code: 'VERSION_MISMATCH',
            message: `Actual version "${actualVersion}" does not match expected browser version "${expectedVersion}"`,
            severity: 'critical',
          });
        }
      } else {
        issues.push({
          code: 'VERSION_UNDETECTABLE',
          message: `Could not parse version from output: "${stdout.trim()}"`,
          severity: 'warning',
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      // Distinguish timeout vs process failure
      const isTimeout =
        (err && typeof err === 'object' && (('code' in err && (err as any).code === 'ETIMEDOUT') || ('signal' in err && (err as any).signal === 'SIGTERM')));

      if (isTimeout) {
        issues.push({
          code: 'VERSION_CHECK_TIMEOUT',
          message: `Version verification command timed out after ${VERSION_CHECK_TIMEOUT_MS}ms.`,
          severity: 'warning',
        });
      } else {
        issues.push({
          code: 'EXECUTABLE_START_FAILED',
          message: `Failed to execute binary for version check: ${errorMsg}`,
          severity: 'warning',
        });
      }
    }

    const compatible = !issues.some((issue) => issue.severity === 'critical');

    return {
      compatible,
      issues,
      actualVersion,
    };
  }
}
