import { execFileSync } from 'child_process';
import { BrowserRuntimeDescriptor } from './browser-runtime-descriptor.js';
import { ResolvedBrowserRuntime } from './browser-executable-resolver.js';
import { BrowserRuntimeError } from './runtime-errors.js';

export interface RuntimeCompatibilityIssue {
  readonly code: 'PLATFORM_MISMATCH' | 'ARCHITECTURE_MISMATCH' | 'VERSION_MISMATCH';
  readonly message: string;
  readonly severity: 'critical' | 'warning';
}

export interface RuntimeCompatibilityReport {
  readonly compatible: boolean;
  readonly issues: RuntimeCompatibilityIssue[];
}

export class RuntimeCompatibilityChecker {
  check(resolved: ResolvedBrowserRuntime): RuntimeCompatibilityReport {
    const issues: RuntimeCompatibilityIssue[] = [];

    // 1. Verify Architecture Mismatch
    const hostArch = process.arch; // 'x64' | 'arm64'
    const targetArch = resolved.descriptor.architecture;

    if (hostArch === 'x64' && targetArch === 'arm64') {
      issues.push({
        code: 'ARCHITECTURE_MISMATCH',
        message: `Cannot run arm64 executable on host architecture: ${hostArch}`,
        severity: 'critical',
      });
    }

    // 2. Detect actual version where practical
    try {
      // In Windows, chrome --product-version outputs clean version e.g. "120.0.6099.71"
      // In Mac/Linux, chrome --version outputs e.g. "Google Chrome 120.0.6099.71"
      const args = process.platform === 'win32' ? ['--product-version'] : ['--version'];
      const rawStdout = execFileSync(resolved.executablePath, args, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const match = rawStdout.match(/\b\d+\.\d+\.\d+(\.\d+)?\b/);
      if (match) {
        const actualVersion = match[0];
        const expectedVersion = resolved.descriptor.browserVersion;
        
        // Match major versions
        const actualMajor = actualVersion.split('.')[0];
        const expectedMajor = expectedVersion.split('.')[0];

        if (actualMajor !== expectedMajor) {
          issues.push({
            code: 'VERSION_MISMATCH',
            message: `Actual version "${actualVersion}" does not match expected browser version "${expectedVersion}"`,
            severity: 'critical',
          });
        }
      }
    } catch {
      // If version check fails (e.g. running binary throws/timeout), add warning
      issues.push({
        code: 'VERSION_MISMATCH',
        message: 'Could not verify actual browser executable version.',
        severity: 'warning',
      });
    }

    const compatible = !issues.some((issue) => issue.severity === 'critical');

    return {
      compatible,
      issues,
    };
  }
}
