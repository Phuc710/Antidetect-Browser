import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ResolvedBrowserRuntime } from './browser-executable-resolver.js';
import { BrowserRuntimeError } from './runtime-errors.js';
import type {
    SupportedArchitecture,
    SupportedPlatform,
} from './runtime-manifest-reader.js';

const execFileAsync = promisify(execFile);
const VERSION_CHECK_TIMEOUT_MS = 2000;

export type RuntimeCompatibilityCode =
    | 'VERSION_MISMATCH'
    | 'VERSION_UNDETECTABLE'
    | 'VERSION_CHECK_TIMEOUT'
    | 'EXECUTABLE_START_FAILED'
    | 'ARCHITECTURE_MISMATCH'
    | 'ARCHITECTURE_UNSUPPORTED';

export interface RuntimeCompatibilityIssue {
    readonly code: RuntimeCompatibilityCode;
    readonly message: string;
    readonly severity: 'critical' | 'warning';
    readonly details?: Record<string, unknown>;
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

interface ProcessError extends Error {
    code?: string | number;
    signal?: string;
}

function isProcessError(err: unknown): err is ProcessError {
    return err instanceof Error;
}

function getSupportedHostArchitecture(): SupportedArchitecture {
    if (process.arch === 'x64' || process.arch === 'arm64') {
        return process.arch;
    }
    throw new BrowserRuntimeError(
        'ARCHITECTURE_UNSUPPORTED',
        `Unsupported host architecture: ${process.arch}`,
    );
}

export class RuntimeCompatibilityChecker {
    constructor(
        private readonly archPolicy: ArchitectureCompatibilityPolicy = new StrictArchitectureCompatibilityPolicy(),
    ) {}

    async check(
        resolved: ResolvedBrowserRuntime,
    ): Promise<RuntimeCompatibilityReport> {
        const issues: RuntimeCompatibilityIssue[] = [];
        let actualVersion: string | undefined;

        // 1. Verify Host Architecture is supported
        let hostArch: SupportedArchitecture;
        try {
            hostArch = getSupportedHostArchitecture();
        } catch (err: unknown) {
            if (err instanceof BrowserRuntimeError) {
                issues.push({
                    code: 'ARCHITECTURE_UNSUPPORTED',
                    message: err.message,
                    severity: 'critical',
                });
            } else {
                issues.push({
                    code: 'ARCHITECTURE_UNSUPPORTED',
                    message: 'Unknown host architecture error.',
                    severity: 'critical',
                });
            }
            return {
                compatible: false,
                issues,
            };
        }

        // 2. Verify Architecture Compatibility using policy
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
                details: {
                    hostArchitecture: hostArch,
                    requestedArchitecture: targetArch,
                },
            });
        }

        // 3. Detect actual version
        try {
            const args =
                process.platform === 'win32'
                    ? ['--product-version']
                    : ['--version'];

            const { stdout } = await execFileAsync(
                resolved.executablePath,
                args,
                {
                    timeout: VERSION_CHECK_TIMEOUT_MS,
                    windowsHide: true,
                },
            );

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
                    message:
                        'Browser executable returned an unrecognized version format.',
                    severity: 'warning',
                    details: {
                        outputLength: stdout.length,
                    },
                });
            }
        } catch (err: unknown) {
            if (isProcessError(err)) {
                const errorMsg = err.message;
                const isTimeout =
                    err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM';

                if (isTimeout) {
                    issues.push({
                        code: 'VERSION_CHECK_TIMEOUT',
                        message: `Version verification command timed out after ${VERSION_CHECK_TIMEOUT_MS}ms.`,
                        severity: 'warning',
                    });
                } else if (typeof err.code === 'number') {
                    // Process started but exited with non-zero status (warning severity)
                    issues.push({
                        code: 'EXECUTABLE_START_FAILED',
                        message: `Browser version check exited with status ${err.code}: ${errorMsg}`,
                        severity: 'warning',
                    });
                } else {
                    // Process failed to start (ENOENT, EACCES, bad format, etc.) -> critical!
                    issues.push({
                        code: 'EXECUTABLE_START_FAILED',
                        message: `Browser executable failed to execute: ${errorMsg}`,
                        severity: 'critical',
                    });
                }
            } else {
                issues.push({
                    code: 'EXECUTABLE_START_FAILED',
                    message: 'Unknown version check execution failure.',
                    severity: 'critical',
                });
            }
        }

        const compatible = !issues.some(
            (issue) => issue.severity === 'critical',
        );

        return {
            compatible,
            issues,
            actualVersion,
        };
    }
}
