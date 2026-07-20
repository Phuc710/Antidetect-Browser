import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LaunchPlanBuilder } from '../application/launch-plan-builder.js';
import { CookieSyncCoordinator } from '../cookies/cookie-sync-coordinator.js';
import { CookieValidator } from '../cookies/cookie-validator.js';
import { FingerprintService } from '../fingerprint/fingerprint-service.js';
import {
    type BrowserSession,
    SessionRegistry,
} from '../runtime/session-registry.js';
import { CommandValidator } from '../transport/command-validator.js';

describe('Browser Launcher Refactored Pipeline - Unit Tests', () => {
    describe('Command Validation', () => {
        const validator = new CommandValidator();

        it('rejects null or non-object messages', () => {
            const res = validator.validate(null);
            expect(res.success).toBe(false);
            expect(res.issues[0].message).toContain(
                'Message must be a non-null object.',
            );
        });

        it('rejects command with missing type or requestId', () => {
            const res = validator.validate({ type: 'profile:launch' });
            expect(res.success).toBe(false);
            expect(res.issues.some((i) => i.path === 'requestId')).toBe(true);
        });

        it('accepts valid initialize command', () => {
            const cmd = {
                type: 'launcher:initialize',
                requestId: 'req-1',
                payload: {
                    applicationMode: 'development',
                    deviceId: 'dev-123',
                },
            };
            const res = validator.validate(cmd);
            expect(res.success).toBe(true);
            expect(res.command).toMatchObject(cmd);
        });

        it('rejects initialize with invalid mode', () => {
            const cmd = {
                type: 'launcher:initialize',
                requestId: 'req-1',
                payload: {
                    applicationMode: 'super-production',
                    deviceId: 'dev-123',
                },
            };
            const res = validator.validate(cmd);
            expect(res.success).toBe(false);
            expect(
                res.issues.some((i) => i.path === 'payload.applicationMode'),
            ).toBe(true);
        });
    });

    describe('Cookie Parsing and Validation', () => {
        const cookieValidator = new CookieValidator();

        it('parses empty or null cookie payloads successfully', () => {
            const res = cookieValidator.parse(null);
            expect(res.success).toBe(true);
            expect(res.cookies).toHaveLength(0);
        });

        it('rejects invalid JSON string structure', () => {
            const res = cookieValidator.parse('{ invalid json }');
            expect(res.success).toBe(false);
            expect(res.issues[0].path).toBe('json');
        });

        it('rejects non-array JSON cookies', () => {
            const res = cookieValidator.parse('{"name": "foo"}');
            expect(res.success).toBe(false);
            expect(res.issues[0].path).toBe('root');
        });

        it('detects missing required fields in individual cookies', () => {
            const res = cookieValidator.parse(
                '[{"name": "foo", "value": "bar"}]',
            ); // missing domain
            expect(res.success).toBe(false);
            expect(res.issues.some((i) => i.path.includes('domain'))).toBe(
                true,
            );
        });

        it('accepts fully formed valid cookies list', () => {
            const res = cookieValidator.parse(
                '[{"name": "foo", "value": "bar", "domain": "example.com", "path": "/", "secure": true}]',
            );
            expect(res.success).toBe(true);
            expect(res.cookies[0]).toMatchObject({
                name: 'foo',
                value: 'bar',
                domain: 'example.com',
                path: '/',
                secure: true,
            });
        });
    });

    describe('Launch Plan Builder', () => {
        const builder = new LaunchPlanBuilder();

        it('constructs an immutable BrowserLaunchPlan from valid payload', () => {
            const payload: any = {
                profileId: 'prof-123',
                sessionId: 'sess-456',
                userDataDir: '/path/to/profile',
                headless: true,
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: 'x64',
                automationProtocol: 'cdp',
                preparedFingerprint: {
                    fingerprintWithHeaders: {
                        fingerprint: {
                            navigator: {
                                userAgent:
                                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                language: 'vi-VN',
                            },
                            screen: {
                                width: 1920,
                                height: 1080,
                            },
                        },
                        headers: {},
                    },
                    markerScript: 'console.log("faked");',
                    readiness: {
                        userAgent:
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        platform: 'Win32',
                        language: 'vi-VN',
                        screenWidth: 1920,
                        screenHeight: 1080,
                        injectedMarker: '2.1.83',
                    },
                },
            };

            const plan = builder.build(payload);
            expect(plan.identity.profileId).toBe('prof-123');
            expect(plan.runtime.headless).toBe(true);
            expect(plan.nativeArgs).toContain(
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            );
            expect(plan.nativeArgs).toContain('--lang=vi-VN');
            expect(plan.nativeArgs).toContain('--window-size=1920,1080');
        });

        it('throws invalid command error if cookie parse fails', () => {
            const payload: any = {
                profileId: 'prof-123',
                sessionId: 'sess-456',
                cookies: '{ malformed }',
            };
            expect(() => builder.build(payload)).toThrow();
        });
    });

    describe('Session Registry', () => {
        let registry: SessionRegistry;

        beforeEach(() => {
            registry = new SessionRegistry();
        });

        it('rejects duplicate profileId additions', () => {
            const mockSession: any = {
                sessionId: 'sess-1',
                profileId: 'prof-1',
                pid: 1234,
                state: 'running',
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: 'x64',
            };
            registry.add(mockSession);

            const mockSession2: any = {
                sessionId: 'sess-2',
                profileId: 'prof-1', // same profileId
                pid: 1235,
                state: 'running',
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: 'x64',
            };
            expect(() => registry.add(mockSession2)).toThrow(
                /Profile prof-1 is already running/,
            );
        });

        it('ensures snapshot sequence increases monotonically', () => {
            const mockSession: any = {
                sessionId: 'sess-1',
                profileId: 'prof-1',
                pid: 1234,
                state: 'running',
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: 'x64',
            };
            registry.add(mockSession);

            const snapshot1 = registry.snapshot();
            const snapshot2 = registry.snapshot();
            expect(snapshot2[0].sequence).toBe(snapshot1[0].sequence + 1);
        });
    });

    describe('Cookie Sync Coordinator', () => {
        it('prevents sync emissions when cookies do not change', async () => {
            const transportMock = {
                send: vi.fn(),
            } as any;
            const coordinator = new CookieSyncCoordinator(transportMock);

            const runtimeMock = {
                getCookies: vi
                    .fn()
                    .mockResolvedValue([
                        { name: 'foo', value: 'bar', domain: 'example.com' },
                    ]),
            } as any;

            const session: BrowserSession = {
                sessionId: 'sess-1',
                profileId: 'prof-1',
                pid: 1234,
                state: 'running',
                startedAt: '',
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: 'x64',
                automation: {} as any,
                browserHandle: runtimeMock,
            };

            // Tick 1: First time sync emits cookie update
            await coordinator.syncCookies(session);
            expect(transportMock.send).toHaveBeenCalledTimes(1);

            // Tick 2: Cookies did not change - should NOT emit
            await coordinator.syncCookies(session);
            expect(transportMock.send).toHaveBeenCalledTimes(1);
        });

        it('emits precisely once when cookies do change', async () => {
            const transportMock = {
                send: vi.fn(),
            } as any;
            const coordinator = new CookieSyncCoordinator(transportMock);

            const runtimeMock = {
                getCookies: vi
                    .fn()
                    .mockResolvedValueOnce([
                        { name: 'foo', value: 'bar', domain: 'example.com' },
                    ])
                    .mockResolvedValueOnce([
                        { name: 'foo', value: 'baz', domain: 'example.com' },
                    ]),
            } as any;

            const session: BrowserSession = {
                sessionId: 'sess-1',
                profileId: 'prof-1',
                pid: 1234,
                state: 'running',
                startedAt: '',
                engine: 'chromium',
                distribution: 'chromium',
                channel: 'stable',
                browserVersion: '120.0.0',
                architecture: 'x64',
                automation: {} as any,
                browserHandle: runtimeMock,
            };

            // First sync
            await coordinator.syncCookies(session);
            // Second sync with changed value
            await coordinator.syncCookies(session);

            expect(transportMock.send).toHaveBeenCalledTimes(2);
        });
    });

    describe('Fingerprint Service - Color Scheme Emulation', () => {
        it('does not hardcode preferences to dark mode', async () => {
            const fingerprintMock = {
                headers: {},
                fingerprint: {
                    colorScheme: 'light', // explicitly light
                    navigator: {
                        userAgent: 'Mozilla/5.0 ...',
                        userAgentData: {},
                        language: 'en-US',
                        languages: ['en-US'],
                        platform: 'Win32',
                    },
                    screen: {
                        width: 1920,
                        height: 1080,
                    },
                },
            } as any;

            const pageMock = {
                emulateMedia: vi.fn().mockResolvedValue(undefined),
            } as any;

            const contextMock = {
                browser: () => ({
                    browserType: () => ({ name: () => 'chromium' }),
                }),
                setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
                pages: () => [pageMock],
                on: vi.fn(),
                addInitScript: vi.fn().mockResolvedValue(undefined),
            } as any;

            const service = new FingerprintService();
            await service.injectIntoContext(
                contextMock,
                fingerprintMock,
                'console.log("marker");',
            );

            // Emulate media must have been called with light
            expect(pageMock.emulateMedia).toHaveBeenCalledWith({
                colorScheme: 'light',
            });
        });
    });
});
