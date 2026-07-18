import Database from 'better-sqlite3';
import { FingerprintGenerator } from 'fingerprint-generator';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BrowserRuntimeSessionFactory } from '../../adapters/playwright-runtime-adapter.js';
import { runMigrations } from '../../database/migration-runner.js';
import { BrowserSessionRepository } from '../../database/repositories/browser-session-repository.js';
import { ProfileRepository } from '../../database/repositories/profile-repository.js';
import {
  BrowserApplicationService,
  type BrowserProcessHandle,
  type BrowserProcessLauncher,
} from '../browser-application-service.js';
import { ProfileLockManager } from '../profile-lock-manager.js';
import { ProfileStorageResolver } from '../profile-storage-resolver.js';
import { FingerprintEnvelopeValidator, signFingerprintEnvelope } from '../fingerprint-envelope-validator.js';
import { createEphemeralDevelopmentSigningMaterial } from '../fingerprint-provider.js';

interface Fixture {
  db: Database.Database;
  root: string;
}

const fixtures: Fixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.db.close();
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
class FakeProcessHandle implements BrowserProcessHandle {
  readonly pid = 4242;
  readonly wsEndpoint = 'ws://127.0.0.1/fake';
  readonly automation = { protocol: 'cdp' as const, endpoint: 'http://127.0.0.1:50000' };
  private readonly listeners = new Set<(exitCode?: number) => void>();

  async stop(): Promise<void> {}

  onExit(listener: (exitCode?: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  crash(exitCode: number): void {
    for (const listener of this.listeners) listener(exitCode);
  }
}

function fingerprintPipeline(now: () => Date): Pick<
  ConstructorParameters<typeof BrowserApplicationService>[1],
  'fingerprintProvider' | 'fingerprintValidator' | 'runtimeFactory' | 'fingerprintMapper'
> {
  const signingMaterial = createEphemeralDevelopmentSigningMaterial();
  const validator = new FingerprintEnvelopeValidator(
    { [signingMaterial.keyId]: signingMaterial.publicKey },
    'integration_test',
    now,
  );
  const generatedAt = now();
  const envelope = signFingerprintEnvelope({
    schemaVersion: 2,
    fingerprintId: 'fingerprint-test',
    generatorVersion: 'test-generator',
    datasetVersion: 'test-dataset',
    targetEngine: 'chromium',
    targetOs: 'windows',
    compatibleRuntimeRange: '>=126.0.0 <127.0.0',
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + 60_000).toISOString(),
    payload: { fingerprint: {}, headers: {} },
  }, signingMaterial.keyId, signingMaterial.privateKey);
  const runtimeFactory: BrowserRuntimeSessionFactory = {
    async connect(process) {
      return {
        pid: process.pid,
        async applyFingerprint() {},
        async verifyReadiness() {},
        getAutomationEndpoint: () => ({ ...process.automation }),
        stop: () => process.stop(),
        onExit: (listener) => process.onExit(listener),
      };
    },
  };
  return {
    fingerprintProvider: { async getVerifiedEnvelope() { return envelope; } },
    fingerprintValidator: validator,
    runtimeFactory,
    fingerprintMapper: () => ({
      fingerprintWithHeaders: new FingerprintGenerator().getFingerprint({
        browsers: ['chrome'], operatingSystems: ['windows'], devices: ['desktop'], locales: ['en-US'],
      }),
      markerScript: 'void 0',
      readiness: {
        userAgent: 'test', platform: 'Win32', language: 'en-US',
        screenWidth: 1280, screenHeight: 720, injectedMarker: 'test-generator',
      },
    }),
  };
}

class FakeLauncher implements BrowserProcessLauncher {
  readonly handles: FakeProcessHandle[] = [];

  async launch(): Promise<BrowserProcessHandle> {
    const handle = new FakeProcessHandle();
    this.handles.push(handle);
    return handle;
  }
}

function fixture(): Fixture & {
  databaseService: { getConnection: () => Database.Database };
  resolver: ProfileStorageResolver;
} {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  const root = fs.mkdtempSync(join(tmpdir(), 'fingerprint-suite-runtime-'));
  const resolver = new ProfileStorageResolver(root);
  const value = { db, root, resolver, databaseService: { getConnection: () => db } };
  fixtures.push(value);
  return value;
}

function insertProfile(db: Database.Database, id = 'profile-1'): void {
  new ProfileRepository(db).insert({
    id,
    name: 'Runtime profile',
    os: 'windows',
    engine: 'chromium',
    distribution: 'chromium',
    channel: 'stable',
    browserVersion: '126.0.1',
    architecture: 'x64',
    storageKey: `profile_${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('BrowserApplicationService lifecycle', () => {
  it('uses one session ID, rejects double launch, and emits globally ordered snapshots', async () => {
    const context = fixture();
    insertProfile(context.db);
    const launcher = new FakeLauncher();
    const lockManager = new ProfileLockManager(context.resolver, {
      instanceId: 'instance-a',
      processId: 1001,
      isProcessAlive: () => true,
    });
    const clock = (() => {
      let tick = 0;
      return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
    })();
    const service = new BrowserApplicationService(context.databaseService, {
      ...fingerprintPipeline(clock),
      storageResolver: context.resolver,
      lockManager,
      launcher,
      idGenerator: () => 'session-1',
      now: clock,
    });
    const events: number[] = [];
    service.subscribeRuntime((event) => events.push(event.sequence));

    const session = await service.launch({ profileId: 'profile-1' });
    expect(session.sessionId).toBe('session-1');
    expect(() => JSON.parse(fs.readFileSync(
      join(context.root, 'profile_profile-1', 'session.lock'),
      'utf8',
    ))).not.toThrow();
    expect(JSON.parse(fs.readFileSync(
      join(context.root, 'profile_profile-1', 'session.lock'),
      'utf8',
    ))).toMatchObject({ browserSessionId: 'session-1', profileId: 'profile-1' });
    expect(new BrowserSessionRepository(context.db).findById('session-1')).toMatchObject({
      id: 'session-1',
      state: 'running',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      browser_version: '126.0.1',
      architecture: 'x64',
    });

    await expect(service.launch({ profileId: 'profile-1' })).rejects.toMatchObject({
      code: 'PROFILE_ALREADY_RUNNING',
    });
    const snapshot = service.getRuntimeSnapshot();
    expect(snapshot.snapshotSequence).toBe(events.at(-1));
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]).toMatchObject({
      browserSessionId: 'session-1',
      state: 'running',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      browserVersion: '126.0.1',
      architecture: 'x64',
    });
    expect(events).toEqual([...events].sort((left, right) => left - right));
    expect(new Set(events).size).toBe(events.length);
    expect(service.getBufferedEvents(snapshot.snapshotSequence)).toEqual([]);

    await service.stop('session-1');
    expect(new BrowserSessionRepository(context.db).findById('session-1')?.state).toBe('stopped');
    expect(fs.existsSync(join(context.root, 'profile_profile-1', 'session.lock'))).toBe(false);
  });

  it('persists a crash and releases the lock when the running process exits', async () => {
    const context = fixture();
    insertProfile(context.db);
    const launcher = new FakeLauncher();
    const service = new BrowserApplicationService(context.databaseService, {
      ...fingerprintPipeline(() => new Date('2026-01-01T00:00:00.000Z')),
      storageResolver: context.resolver,
      lockManager: new ProfileLockManager(context.resolver, {
        instanceId: 'instance-exit', processId: 1002, isProcessAlive: () => true,
      }),
      launcher,
      idGenerator: () => 'session-exit',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    await service.launch({ profileId: 'profile-1' });
    launcher.handles[0]?.crash(137);

    expect(new BrowserSessionRepository(context.db).findById('session-exit')).toMatchObject({
      state: 'crashed', exit_code: 137, termination_reason: 'browser_process_exit',
    });
    const lockPath = join(context.root, 'profile_profile-1', 'session.lock');
    while (fs.existsSync(lockPath)) await new Promise((resolve) => setImmediate(resolve));
    expect(service.getActiveForProfile('profile-1')).toBeUndefined();
  });

  it('marks interrupted sessions crashed and removes only stale owned locks', () => {
    const context = fixture();
    insertProfile(context.db);
    const sessions = new BrowserSessionRepository(context.db);
    sessions.create({
      id: 'session-crashed',
      profileId: 'profile-1',
      deviceId: 'device-a',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      browserVersion: '126',
      architecture: 'x64',
      automationProtocol: 'cdp',
      state: 'validating',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    sessions.transition('session-crashed', 'running', '2026-01-01T00:00:01.000Z', {
      processId: 9001,
      startedAt: '2026-01-01T00:00:00.500Z',
      readyAt: '2026-01-01T00:00:01.000Z',
    });

    const oldOwner = new ProfileLockManager(context.resolver, {
      instanceId: 'dead-instance',
      processId: 7001,
      isProcessAlive: () => true,
    });
    oldOwner.acquireDurableLock('profile-1', 'profile_profile-1', 'session-crashed');

    const recoveringLockManager = new ProfileLockManager(context.resolver, {
      instanceId: 'new-instance',
      processId: 7002,
      isProcessAlive: () => false,
    });
    const service = new BrowserApplicationService(context.databaseService, {
      ...fingerprintPipeline(() => new Date('2026-01-02T00:00:00.000Z')),
      storageResolver: context.resolver,
      lockManager: recoveringLockManager,
      launcher: new FakeLauncher(),
      now: () => new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(service.recoverCrashedSessions()).toBe(1);
    expect(sessions.findById('session-crashed')).toMatchObject({
      state: 'crashed',
      error_code: 'APP_CRASH_RECOVERY',
      termination_reason: 'desktop_process_restarted',
    });
    expect(fs.existsSync(join(context.root, 'profile_profile-1', 'session.lock'))).toBe(false);
    expect(service.getRuntimeSnapshot().sessions).toEqual([]);
    oldOwner.shutdown();
  });
});
