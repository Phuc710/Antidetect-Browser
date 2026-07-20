import { execFile } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlaywrightProcessLauncher } from '../runtime/playwright-process-launcher.js';
import { SessionRegistry } from '../runtime/session-registry.js';
import { BrowserExecutableResolver } from '../runtime-compatibility/browser-executable-resolver.js';
import {
    BrowserRuntimeRegistry,
    buildManifestIndex,
} from '../runtime-compatibility/browser-runtime-registry.js';
import { RuntimeCompatibilityChecker } from '../runtime-compatibility/runtime-compatibility-checker.js';
import { BrowserRuntimeError } from '../runtime-compatibility/runtime-errors.js';
import { RuntimeManifestReader } from '../runtime-compatibility/runtime-manifest-reader.js';

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
}));

vi.mock('node:child_process', () => ({
    execFileSync: vi.fn(),
    execFile: vi.fn(),
}));

describe('Browser Runtime G1.1 Hardening - Unit Tests', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('RuntimeManifestReader', () => {
        const reader = new RuntimeManifestReader();

        it('initialization rejects missing manifest file', async () => {
            vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                BrowserRuntimeError,
            );
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /Manifest file does not exist/,
            );
        });

        it('initialization rejects malformed JSON', async () => {
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue('{ invalid JSON }');
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /Manifest JSON is malformed/,
            );
        });

        it('rejects unsupported schema version', async () => {
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue(
                JSON.stringify({
                    schemaVersion: 2, // Unsupported schema
                    runtimes: [],
                }),
            );
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /Unsupported schema version/,
            );
        });

        it('rejects empty runtimes array', async () => {
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue(
                JSON.stringify({
                    schemaVersion: 1,
                    runtimes: [],
                }),
            );
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /runtimes" must not be empty/,
            );
        });

        it('rejects duplicate runtime id', async () => {
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue(
                JSON.stringify({
                    schemaVersion: 1,
                    runtimes: [
                        {
                            id: 'dup-id',
                            engine: 'chromium',
                            distribution: 'chromium',
                            channel: 'stable',
                            version: '120.0.0',
                            architecture: 'x64',
                            platform: 'win32',
                            relativeExecutablePath: 'chrome.exe',
                        },
                        {
                            id: 'dup-id', // Duplicate
                            engine: 'chromium',
                            distribution: 'chromium',
                            channel: 'stable',
                            version: '121.0.0',
                            architecture: 'x64',
                            platform: 'win32',
                            relativeExecutablePath: 'chrome2.exe',
                        },
                    ],
                }),
            );
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /Duplicate runtime id detected/,
            );
        });

        it('rejects duplicate descriptor key', async () => {
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue(
                JSON.stringify({
                    schemaVersion: 1,
                    runtimes: [
                        {
                            id: 'id-1',
                            engine: 'chromium',
                            distribution: 'chromium',
                            channel: 'stable',
                            version: '120.0.0',
                            architecture: 'x64',
                            platform: 'win32',
                            relativeExecutablePath: 'chrome.exe',
                        },
                        {
                            id: 'id-2',
                            engine: 'chromium', // Duplicate tuple
                            distribution: 'chromium',
                            channel: 'stable',
                            version: '120.0.0',
                            architecture: 'x64',
                            platform: 'win32',
                            relativeExecutablePath: 'chrome-copy.exe',
                        },
                    ],
                }),
            );
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /Duplicate runtime descriptor detected/,
            );
        });

        it('rejects absolute executable path', async () => {
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue(
                JSON.stringify({
                    schemaVersion: 1,
                    runtimes: [
                        {
                            id: 'id-1',
                            engine: 'chromium',
                            distribution: 'chromium',
                            channel: 'stable',
                            version: '120.0.0',
                            architecture: 'x64',
                            platform: 'win32',
                            relativeExecutablePath: '/absolute/path/chrome.exe', // absolute
                        },
                    ],
                }),
            );
            await expect(reader.read('/dummy/manifest.json')).rejects.toThrow(
                /must be a relative path/,
            );
        });
    });

    describe('BrowserExecutableResolver', () => {
        const mockManifest = {
            schemaVersion: 1 as const,
            runtimes: [
                {
                    id: 'id-win',
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    version: '120.0.0',
                    architecture: 'x64' as const,
                    platform: 'win32' as const,
                    relativeExecutablePath: 'win/chrome.exe',
                },
                {
                    id: 'id-mac',
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    version: '120.0.0',
                    architecture: 'arm64' as const,
                    platform: 'darwin' as const,
                    relativeExecutablePath: 'mac/chrome.app',
                },
                {
                    id: 'id-traversal',
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    version: '122.0.0',
                    architecture: 'x64' as const,
                    platform: process.platform as any,
                    relativeExecutablePath: '../../outside/chrome.exe',
                },
                {
                    id: 'id-mismatch-platform',
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    version: '121.0.0',
                    architecture: 'x64' as const,
                    platform: process.platform === 'win32' ? 'darwin' : 'win32', // Mismatched platform
                    relativeExecutablePath: 'other/chrome.exe',
                },
            ],
        };

        it('returns logical match platform/arch errors with correct precedence', async () => {
            const resolver = new BrowserExecutableResolver(
                '/root',
                buildManifestIndex(mockManifest),
            );

            // 1. Logical runtime missing entirely
            try {
                await resolver.resolve({
                    engine: 'chromium',
                    distribution: 'chromium',
                    channel: 'stable',
                    browserVersion: '999.0.0', // logical missing
                    architecture: 'x64',
                });
                expect.fail('Should have failed');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(BrowserRuntimeError);
                expect((err as BrowserRuntimeError).code).toBe(
                    'RUNTIME_NOT_REGISTERED',
                );
            }

            // 2. Logical matches exist, but none matches platform
            try {
                await resolver.resolve({
                    engine: 'chromium',
                    distribution: 'chromium',
                    channel: 'stable',
                    browserVersion: '121.0.0', // Only exists on mismatched platform
                    architecture: 'x64',
                });
                expect.fail('Should have failed');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(BrowserRuntimeError);
                expect((err as BrowserRuntimeError).code).toBe(
                    'PLATFORM_MISMATCH',
                );
            }
        });

        it('rejects traversal paths', async () => {
            const resolver = new BrowserExecutableResolver(
                '/root',
                buildManifestIndex(mockManifest),
            );
            await expect(
                resolver.resolve({
                    engine: 'chromium',
                    distribution: 'chromium',
                    channel: 'stable',
                    browserVersion: '122.0.0',
                    architecture: 'x64',
                }),
            ).rejects.toThrow(/Path traversal detected/);
        });

        it('rejects if resolved executable path points to a directory', async () => {
            const singleManifest = {
                schemaVersion: 1 as const,
                runtimes: [
                    {
                        id: 'id-1',
                        engine: 'chromium' as const,
                        distribution: 'chromium' as const,
                        channel: 'stable' as const,
                        version: '120.0.0',
                        architecture: 'x64' as const,
                        platform: process.platform as any,
                        relativeExecutablePath: 'some-dir',
                    },
                ],
            };
            const resolver = new BrowserExecutableResolver(
                '/root',
                buildManifestIndex(singleManifest),
            );
            vi.mocked(stat).mockResolvedValue({
                isFile: () => false, // directory
            } as any);

            await expect(
                resolver.resolve({
                    engine: 'chromium',
                    distribution: 'chromium',
                    channel: 'stable',
                    browserVersion: '120.0.0',
                    architecture: 'x64',
                }),
            ).rejects.toThrow(/Path is not a regular file/);
        });
    });

    describe('RuntimeCompatibilityChecker', () => {
        const checker = new RuntimeCompatibilityChecker();

        it('treats undetectable version outputs as VERSION_UNDETECTABLE', async () => {
            const resolved = {
                descriptor: {
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    browserVersion: '120.0.0',
                    architecture: process.arch as any,
                },
                executablePath: '/root/chrome.exe',
            };

            // Mock execFile outputting garbage
            const mockExec = vi.mocked(execFile);
            mockExec.mockImplementation(
                (file, args, options, callback: any) => {
                    callback(null, { stdout: 'garbage text output' });
                    return {} as any;
                },
            );

            const report = await checker.check(resolved);
            expect(report.compatible).toBe(true); // warning only
            expect(report.issues[0].code).toBe('VERSION_UNDETECTABLE');
        });

        it('handles version check timeouts properly', async () => {
            const resolved = {
                descriptor: {
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    browserVersion: '120.0.0',
                    architecture: process.arch as any,
                },
                executablePath: '/root/chrome.exe',
            };

            const mockExec = vi.mocked(execFile);
            mockExec.mockImplementation(
                (file, args, options, callback: any) => {
                    const err = Object.assign(new Error('ETIMEDOUT'), {
                        code: 'ETIMEDOUT',
                    });
                    callback(err);
                    return {} as any;
                },
            );

            const report = await checker.check(resolved);
            expect(report.issues[0].code).toBe('VERSION_CHECK_TIMEOUT');
        });

        it('handles execution command failure properly', async () => {
            const resolved = {
                descriptor: {
                    engine: 'chromium' as const,
                    distribution: 'chromium' as const,
                    channel: 'stable' as const,
                    browserVersion: '120.0.0',
                    architecture: process.arch as any,
                },
                executablePath: '/root/chrome.exe',
            };

            const mockExec = vi.mocked(execFile);
            mockExec.mockImplementation(
                (file, args, options, callback: any) => {
                    callback(new Error('Access Denied'));
                    return {} as any;
                },
            );

            const report = await checker.check(resolved);
            expect(report.issues[0].code).toBe('EXECUTABLE_START_FAILED');
        });
    });

    describe('BrowserRuntimeRegistry - Cache and Reload', () => {
        it('caches manifest reads and does not reload file on every resolution unless reload() called', async () => {
            const registry = new BrowserRuntimeRegistry();
            vi.mocked(access).mockResolvedValue(undefined);
            vi.mocked(readFile).mockResolvedValue(
                JSON.stringify({
                    schemaVersion: 1,
                    runtimes: [
                        {
                            id: 'id-1',
                            engine: 'chromium',
                            distribution: 'chromium',
                            channel: 'stable',
                            version: '120.0.0',
                            architecture: process.arch as any,
                            platform: process.platform,
                            relativeExecutablePath: 'chrome.exe',
                        },
                    ],
                }),
            );
            vi.mocked(stat).mockResolvedValue({
                isFile: () => true,
            } as any);

            const mockExec = vi.mocked(execFile);
            mockExec.mockImplementation(
                (file, args, options, callback: any) => {
                    callback(null, { stdout: '120.0.6099.0' });
                    return {} as any;
                },
            );

            // 1. Initialize loads manifest
            await registry.initialize('/root', '/root/manifest.json');
            expect(readFile).toHaveBeenCalledTimes(1);

            // 2. Resolve uses cache, does not trigger readFile again
            await registry.resolveAndVerify({
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: process.arch as any,
            });
            expect(readFile).toHaveBeenCalledTimes(1);

            // 3. Reload does reload file
            await registry.reload();
            expect(readFile).toHaveBeenCalledTimes(2);
        });
    });

    describe('PlaywrightProcessLauncher', () => {
        it('passes exact executablePath parameter into playwright launch options', async () => {
            const mockContext = {
                on: vi.fn(),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockLaunchPersistentContext = vi.fn().mockResolvedValue(mockContext);
            vi.doMock('playwright', () => ({
                chromium: {
                    launchPersistentContext: mockLaunchPersistentContext,
                },
            }));

            const launcher = new PlaywrightProcessLauncher();
            const plan: any = {
                runtime: { engine: 'chromium', userDataDir: '/tmp/profile', headless: true },
                nativeArgs: [],
                proxy: undefined,
            };
            const resolvedRuntime = {
                descriptor: { engine: 'chromium' as const },
                executablePath: '/custom/path/to/chrome.exe',
            } as any;

            await launcher.launch(plan, resolvedRuntime);
            // userDataDir is the first positional arg; executablePath is in the options object
            expect(mockLaunchPersistentContext).toHaveBeenCalledWith(
                '/tmp/profile',
                expect.objectContaining({
                    executablePath: '/custom/path/to/chrome.exe',
                }),
            );
        });
    });

    describe('SessionRegistry & Sequence numbers', () => {
        it('ensures monotonic sequence increments on creating snapshots', () => {
            const registry = new SessionRegistry();
            const snapshot1 = registry.createSnapshot();
            const snapshot2 = registry.createSnapshot();
            expect(snapshot2.sequence).toBe(snapshot1.sequence + 1);
        });
    });
});
