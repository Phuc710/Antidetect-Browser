import Database from 'better-sqlite3';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FingerprintEnvelope } from 'shared';
import type {
  BrowserRuntimeContextSeed,
  BrowserRuntimeSession,
  BrowserRuntimeSessionFactory,
  FingerprintReadinessExpectation,
} from '../../adapters/playwright-runtime-adapter.js';
import { runMigrations } from '../../database/migration-runner.js';
import { BrowserSessionRepository } from '../../database/repositories/browser-session-repository.js';
import { FingerprintEnvelopeCacheRepository } from '../../database/repositories/fingerprint-envelope-cache-repository.js';
import { ProfileRepository } from '../../database/repositories/profile-repository.js';
import { getHostArchitecture } from '../../../shared/profile-contracts.js';
import { signedFingerprintFixture, TEST_FINGERPRINT_KEY_ID, TEST_FINGERPRINT_PUBLIC_KEY } from '../../test/signed-fingerprint-fixture.js';
import {
  BrowserApplicationService,
  type BrowserProcessHandle,
  type BrowserProcessLauncher,
} from '../browser-application-service.js';
import { FingerprintEnvelopeValidator, FingerprintPipelineError } from '../fingerprint-envelope-validator.js';
import { ProfileLockManager } from '../profile-lock-manager.js';
import { ProfileStorageResolver } from '../profile-storage-resolver.js';

const NOW = new Date('2026-01-01T00:30:00.000Z');
const roots: string[] = [];
const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

class TrackingHandle implements BrowserProcessHandle {
  readonly pid = 4545;
  readonly wsEndpoint = 'ws://127.0.0.1/tracking';
  readonly automation = { protocol: 'cdp' as const, endpoint: 'http://127.0.0.1:4546' };
  stopped = false;
  private readonly listeners = new Set<(exitCode?: number) => void>();

  async stop(): Promise<void> { this.stopped = true; }
  onExit(listener: (exitCode?: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

class TrackingRuntime implements BrowserRuntimeSession {
  readonly pid: number;
  stopped = false;
  private verified = false;

  constructor(
    private readonly handle: TrackingHandle,
    private readonly events: string[],
    private readonly readinessFailure = false,
  ) {
    this.pid = handle.pid;
  }

  async applyPrePageConfiguration(): Promise<void> { this.events.push('apply'); }
  async verifyReadiness(): Promise<void> {
    this.events.push('verify');
    if (this.readinessFailure) {
      throw new FingerprintPipelineError('FINGERPRINT_READINESS_FAILED', 'test readiness failure');
    }
    this.verified = true;
  }
  getAutomationEndpoint() {
    this.events.push('endpoint');
    if (!this.verified) throw new Error('endpoint before readiness');
    return { ...this.handle.automation };
  }
  async stop(): Promise<void> {
    this.events.push('stop');
    this.stopped = true;
    await this.handle.stop();
  }
  onExit(listener: (exitCode?: number) => void): () => void {
    return this.handle.onExit(listener);
  }
}

function setup(readinessFailure = false) {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  runMigrations(database);
  databases.push(database);
  const root = fs.mkdtempSync(join(tmpdir(), 'fingerprint-lifecycle-'));
  roots.push(root);
  const resolver = new ProfileStorageResolver(root);
  const events: string[] = [];
  const handle = new TrackingHandle();
  const launcher: BrowserProcessLauncher = {
    async launch() { events.push('launch'); return handle; },
  };
  let runtime: TrackingRuntime | undefined;
  const runtimeFactory: BrowserRuntimeSessionFactory = {
    async connect(_process: BrowserProcessHandle, _seed: BrowserRuntimeContextSeed) {
      events.push('connect');
      runtime = new TrackingRuntime(handle, events, readinessFailure);
      return runtime;
    },
  };
  new ProfileRepository(database).insert({
    id: 'profile-1', name: 'Fingerprint profile', os: 'windows', engine: 'chromium',
    distribution: 'chromium', channel: 'stable', browserVersion: '126.0.1',
    architecture: getHostArchitecture(), storageKey: 'profile_profile-1',
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  });
  const validator = new FingerprintEnvelopeValidator(
    { [TEST_FINGERPRINT_KEY_ID]: TEST_FINGERPRINT_PUBLIC_KEY },
    'integration_test',
    () => NOW,
  );
  const envelope = signedFingerprintFixture();
  const lockManager = new ProfileLockManager(resolver, {
    instanceId: 'fingerprint-test', processId: 8080, isProcessAlive: () => true,
  });
  const prepared = {
    headers: { 'accept-language': 'en-US' },
    initScript: 'Object.defineProperty(window, "__fingerprintVersion", { value: "test" })',
    contextSeed: { userAgent: 'test-ua', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
    readiness: {
      userAgent: 'test-ua', platform: 'Win32', language: 'en-US', screenWidth: 1280,
      screenHeight: 720, injectedMarker: 'test',
    } satisfies FingerprintReadinessExpectation,
  };
  return {
    database, root, events, handle, validator, envelope, launcher, runtimeFactory, lockManager,
    runtime: () => runtime,
    service(providerEnvelope: FingerprintEnvelope = envelope) {
      const service = new BrowserApplicationService({ getConnection: () => database }, {
        fingerprintProvider: {
          async getVerifiedEnvelope() { events.push('provider'); return providerEnvelope; },
        },
        fingerprintValidator: validator,
        fingerprintMapper: () => { events.push('mapper'); return prepared; },
        runtimeFactory,
        launcher,
        storageResolver: resolver,
        lockManager,
        idGenerator: () => 'session-1',
        now: () => NOW,
      });
      service.subscribeRuntime((event) => events.push(`state:${event.state}`));
      return service;
    },
  };
}

describe('fingerprint lifecycle orchestration', () => {
  it('publishes the endpoint and running state only after readiness succeeds', async () => {
    const context = setup();
    const service = context.service();
    await service.launch({ profileId: 'profile-1', headless: true });

    expect(context.events).toEqual([
      'provider', 'mapper', 'state:validating', 'state:acquiring_lock', 'state:preparing',
      'launch', 'connect', 'state:starting', 'apply', 'verify', 'endpoint', 'state:running',
    ]);
    expect(new FingerprintEnvelopeCacheRepository(context.database).find('profile-1'))
      .toEqual(context.envelope);
    await service.stop('session-1');
  });

  it('closes runtime/process, records error, and releases the profile lock on readiness failure', async () => {
    const context = setup(true);
    const service = context.service();
    await expect(service.launch({ profileId: 'profile-1', headless: true })).rejects.toMatchObject({
      code: 'FINGERPRINT_READINESS_FAILED',
    });

    expect(context.runtime()?.stopped).toBe(true);
    expect(context.handle.stopped).toBe(true);
    expect(context.events).not.toContain('endpoint');
    expect(context.events).not.toContain('state:running');
    expect(new BrowserSessionRepository(context.database).findById('session-1')).toMatchObject({
      state: 'error', error_code: 'FINGERPRINT_READINESS_FAILED',
    });
    expect(fs.existsSync(join(context.root, 'profile_profile-1', 'session.lock'))).toBe(false);
  });

  it('rejects an invalid envelope before acquiring a lock or starting a process', async () => {
    const context = setup();
    const tampered = { ...context.envelope, datasetVersion: 'tampered' };
    const service = context.service(tampered);
    await expect(service.launch({ profileId: 'profile-1' })).rejects.toMatchObject({
      code: 'FINGERPRINT_INTEGRITY_INVALID',
    });
    expect(context.events).toEqual(['provider']);
    expect(new BrowserSessionRepository(context.database).findById('session-1')).toBeNull();
    expect(context.handle.stopped).toBe(false);
  });

  it('uses a still-valid signed cache entry only when the provider is unavailable', async () => {
    const context = setup();
    new FingerprintEnvelopeCacheRepository(context.database)
      .store('profile-1', context.envelope, NOW.toISOString());
    const service = new BrowserApplicationService({ getConnection: () => context.database }, {
      fingerprintProvider: {
        async getVerifiedEnvelope() {
          throw new FingerprintPipelineError(
            'FINGERPRINT_SERVICE_UNAVAILABLE',
            'offline',
          );
        },
      },
      fingerprintValidator: context.validator,
      fingerprintMapper: () => ({
        headers: {}, initScript: 'void 0',
        contextSeed: { userAgent: 'test', viewport: { width: 1, height: 1 }, deviceScaleFactor: 1 },
        readiness: {
          userAgent: 'test', platform: 'Win32', language: 'en-US', screenWidth: 1,
          screenHeight: 1, injectedMarker: 'test',
        },
      }),
      runtimeFactory: context.runtimeFactory,
      launcher: context.launcher,
      storageResolver: new ProfileStorageResolver(context.root),
      lockManager: context.lockManager,
      idGenerator: () => 'session-cache',
      now: () => NOW,
    });
    await expect(service.launch({ profileId: 'profile-1' })).resolves.toMatchObject({
      sessionId: 'session-cache', state: 'running',
    });
    await service.stop('session-cache');
  });
});
