import { randomUUID } from 'crypto';
import net from 'net';
import type {
  AutomationProtocol,
  BrowserRuntimeDescriptor,
  ProfileRuntimeEvent,
  ProfileRuntimeSnapshotEnvelope,
  ProfileRuntimeState,
} from '../../shared/profile-contracts.js';
import { getHostArchitecture } from '../../shared/profile-contracts.js';
import { mapFingerprintEnvelope, type PreparedFingerprintInjection } from '../adapters/fingerprint-envelope-mapper.js';
import {
  PlaywrightRuntimeSessionFactory,
  type BrowserRuntimeSession,
  type BrowserRuntimeSessionFactory,
} from '../adapters/playwright-runtime-adapter.js';
import { FingerprintEnvelopeCacheRepository } from '../database/repositories/fingerprint-envelope-cache-repository.js';
import { BrowserSessionRepository } from '../database/repositories/browser-session-repository.js';
import { ProfileRepository } from '../database/repositories/profile-repository.js';
import type { DatabaseConnectionProvider } from './database-service.js';
import { FingerprintPipelineError } from './fingerprint-envelope-validator.js';
import type { FingerprintEnvelopeValidator } from './fingerprint-envelope-validator.js';
import type { IFingerprintProvider } from './fingerprint-provider.js';
import { Logger } from './logger.js';
import { ProfileLockManager } from './profile-lock-manager.js';
import { ProfileStorageResolver } from './profile-storage-resolver.js';

const logger = new Logger('BrowserApplicationService');
const EVENT_BUFFER_LIMIT = 512;

export const CLOUD_LEASE_STATUS = 'stub_not_configured' as const;

export type AutomationConnection =
  | { protocol: 'cdp'; endpoint: string }
  | { protocol: 'webdriver'; driverPath: string; endpoint: string }
  | { protocol: 'marionette'; driverPath: string; port: number };

export interface BrowserProcessHandle {
  pid: number;
  wsEndpoint: string;
  automation: AutomationConnection;
  stop: () => Promise<void>;
  onExit: (listener: (exitCode?: number) => void) => () => void;
}

export interface BrowserProcessLauncher {
  launch(options: BrowserRuntimeDescriptor & {
    automationProtocol: AutomationProtocol;
    userDataDir: string;
    headless: boolean;
    proxy?: BrowserLaunchProxy | undefined;
  }): Promise<BrowserProcessHandle>;
}

export interface BrowserLaunchProxy {
  server: string;
  username?: string;
  password?: string;
}

export interface BrowserSession extends BrowserRuntimeDescriptor {
  sessionId: string;
  profileId: string;
  state: ProfileRuntimeState;
  pid: number;
  automation: AutomationConnection;
  startedAt: string;
}

export interface LaunchOptions {
  profileId: string;
  automationProtocol?: AutomationProtocol;
  headless?: boolean;
}

export interface BrowserApplicationServiceOptions {
  fingerprintProvider: IFingerprintProvider;
  fingerprintValidator: FingerprintEnvelopeValidator;
  runtimeFactory?: BrowserRuntimeSessionFactory;
  fingerprintMapper?: (envelope: Parameters<typeof mapFingerprintEnvelope>[0]) => PreparedFingerprintInjection;
  canUseOfflineFingerprintCache?: (profileId: string) => boolean;
  storageResolver?: ProfileStorageResolver;
  lockManager?: ProfileLockManager;
  launcher?: BrowserProcessLauncher;
  idGenerator?: () => string;
  now?: () => Date;
  deviceId?: string;
  resolveProxy?: (proxyId: string) => Promise<BrowserLaunchProxy>;
}

export class PlaywrightProcessLauncher implements BrowserProcessLauncher {
  async launch(
    options: BrowserRuntimeDescriptor & {
      automationProtocol: AutomationProtocol;
      userDataDir: string;
      headless: boolean;
      proxy?: BrowserLaunchProxy | undefined;
    },
  ): Promise<BrowserProcessHandle> {
    if (options.architecture !== getHostArchitecture()) {
      throw Object.assign(new Error('Configured browser architecture does not match this device.'), {
        code: 'BROWSER_ARCHITECTURE_MISMATCH',
      });
    }
    if (options.engine !== 'chromium') {
      throw Object.assign(new Error('Only Chromium is supported by fingerprint injection Phase 1.'), {
        code: 'BROWSER_ENGINE_UNAVAILABLE',
      });
    }
    if (options.distribution !== 'chromium') {
      throw Object.assign(new Error('Only the bundled Chromium distribution is supported in Phase 1.'), {
        code: 'BROWSER_DISTRIBUTION_UNAVAILABLE',
      });
    }

    const playwright = await import('playwright');
    const port = await findAvailablePort();
    const closeListeners = new Set<(exitCode?: number) => void>();
    let intentionallyClosed = false;

    const server = await playwright.chromium.launchServer({
      headless: options.headless,
      ...(options.proxy ? { proxy: options.proxy } : {}),
      args: [
        `--remote-debugging-port=${port}`,
        '--remote-debugging-address=127.0.0.1',
        '--disable-blink-features=AutomationControlled',
      ],
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
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

interface ActiveSession {
  view: BrowserSession;
  runtime: BrowserRuntimeSession;
  removeExitListener: () => void;
}

interface PendingSession {
  cancelRequested: boolean;
  processHandle?: BrowserProcessHandle;
  runtime?: BrowserRuntimeSession;
}

interface ResolvedPreparedFingerprint {
  readonly prepared: PreparedFingerprintInjection;
  readonly envelope: Parameters<typeof mapFingerprintEnvelope>[0];
  readonly shouldCache: boolean;
}

export class BrowserApplicationService {
  private readonly sessionRepository: BrowserSessionRepository;
  private readonly profileRepository: ProfileRepository;
  private readonly fingerprintCacheRepository: FingerprintEnvelopeCacheRepository;
  private readonly storageResolver: ProfileStorageResolver;
  private readonly lockManager: ProfileLockManager;
  private readonly launcher: BrowserProcessLauncher;
  private readonly fingerprintProvider: IFingerprintProvider;
  private readonly fingerprintValidator: FingerprintEnvelopeValidator;
  private readonly runtimeFactory: BrowserRuntimeSessionFactory;
  private readonly fingerprintMapper: (envelope: Parameters<typeof mapFingerprintEnvelope>[0]) => PreparedFingerprintInjection;
  private readonly canUseOfflineFingerprintCache: (profileId: string) => boolean;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;
  private readonly deviceId: string;
  private readonly resolveProxy: ((proxyId: string) => Promise<BrowserLaunchProxy>) | undefined;
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly listeners = new Set<(event: ProfileRuntimeEvent) => void>();
  private readonly eventBuffer: ProfileRuntimeEvent[] = [];
  private readonly stoppingSessions = new Set<string>();
  private readonly pendingSessions = new Map<string, PendingSession>();

  constructor(db: DatabaseConnectionProvider, options: BrowserApplicationServiceOptions) {
    const connection = db.getConnection();
    this.sessionRepository = new BrowserSessionRepository(connection);
    this.profileRepository = new ProfileRepository(connection);
    this.fingerprintCacheRepository = new FingerprintEnvelopeCacheRepository(connection);
    this.storageResolver = options.storageResolver ?? new ProfileStorageResolver();
    this.lockManager = options.lockManager ?? new ProfileLockManager(this.storageResolver);
    this.launcher = options.launcher ?? new PlaywrightProcessLauncher();
    this.fingerprintProvider = options.fingerprintProvider;
    this.fingerprintValidator = options.fingerprintValidator;
    this.runtimeFactory = options.runtimeFactory ?? new PlaywrightRuntimeSessionFactory();
    this.fingerprintMapper = options.fingerprintMapper ?? mapFingerprintEnvelope;
    this.canUseOfflineFingerprintCache = options.canUseOfflineFingerprintCache ?? (() => false);
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.deviceId = options.deviceId ?? 'local_device';
    this.resolveProxy = options.resolveProxy;
  }

  recoverCrashedSessions(): number {
    let recovered = 0;
    for (const session of this.sessionRepository.listActive()) {
      const profile = this.profileRepository.findById(session.profile_id);
      const storageKey = profile?.storage_key ?? `profile_${session.profile_id}`;
      const lockState = this.lockManager.recoverDurableLock(session.profile_id, storageKey, session.id);
      const occurredAt = this.now().toISOString();
      const state: ProfileRuntimeState = lockState === 'owned_by_live_process' ? 'locked' : 'crashed';
      const errorCode = lockState === 'owned_by_live_process'
        ? 'LOCK_OWNER_STILL_ALIVE'
        : 'APP_CRASH_RECOVERY';
      const event = this.sessionRepository.transition(session.id, state, occurredAt, {
        stoppedAt: occurredAt,
        terminationReason: 'desktop_process_restarted',
        errorCode,
      });
      this.publish(event);
      recovered += 1;
    }
    return recovered;
  }

  async launch(options: LaunchOptions): Promise<BrowserSession> {
    const profile = this.profileRepository.findById(options.profileId);
    if (!profile) throw Object.assign(new Error('Profile not found.'), { code: 'NOT_FOUND' });

    const descriptor: BrowserRuntimeDescriptor = {
      engine: profile.engine as BrowserRuntimeDescriptor['engine'],
      distribution: profile.distribution as BrowserRuntimeDescriptor['distribution'],
      channel: profile.channel as BrowserRuntimeDescriptor['channel'],
      browserVersion: profile.browser_version,
      architecture: profile.architecture as BrowserRuntimeDescriptor['architecture'],
    };
    this.assertPhaseOneRuntime(descriptor);
    const automationProtocol = options.automationProtocol ?? 'cdp';
    if (automationProtocol !== 'cdp') {
      throw Object.assign(new Error('Chromium fingerprint sessions require CDP automation.'), {
        code: 'BROWSER_AUTOMATION_PROTOCOL_UNAVAILABLE',
      });
    }

    const resolvedFingerprint = await this.resolvePreparedFingerprint(
      options.profileId,
      descriptor,
      profile.os,
    );

    this.lockManager.acquireInProcessMutex(options.profileId);
    let durableLockAcquired = false;
    let sessionCreated = false;
    let processHandle: BrowserProcessHandle | undefined;
    let runtime: BrowserRuntimeSession | undefined;
    let registeredActive: ActiveSession | undefined;
    const sessionId = this.idGenerator();
    const pendingSession: PendingSession = {
      cancelRequested: false,
    };

    try {
      if (this.sessionRepository.getActiveForProfile(options.profileId)) {
        throw Object.assign(new Error('Profile already has an active browser session.'), {
          code: 'PROFILE_ALREADY_RUNNING',
        });
      }

      const validating = this.sessionRepository.create({
        id: sessionId,
        profileId: options.profileId,
        deviceId: this.deviceId,
        state: 'validating',
        automationProtocol,
        occurredAt: this.now().toISOString(),
        ...descriptor,
      });
      sessionCreated = true;
      this.pendingSessions.set(sessionId, pendingSession);
      this.publish(validating);
      this.transition(sessionId, 'acquiring_lock');

      this.lockManager.acquireDurableLock(options.profileId, profile.storage_key, sessionId);
      durableLockAcquired = true;
      this.transition(sessionId, 'preparing');

      const startedAt = this.now().toISOString();
      const proxy = profile.proxy_id
        ? await this.resolveConfiguredProxy(profile.proxy_id)
        : undefined;
      processHandle = await this.launcher.launch({
        ...descriptor,
        automationProtocol,
        userDataDir: this.storageResolver.resolvePath(profile.storage_key),
        headless: options.headless ?? false,
        ...(proxy ? { proxy } : {}),
      });
      pendingSession.processHandle = processHandle;
      this.assertLaunchNotCancelled(pendingSession);
      runtime = await this.runtimeFactory.connect(processHandle);
      pendingSession.runtime = runtime;
      this.assertLaunchNotCancelled(pendingSession);
      this.transition(sessionId, 'starting', { startedAt });
      await runtime.applyFingerprint(
        resolvedFingerprint.prepared.fingerprintWithHeaders,
        resolvedFingerprint.prepared.markerScript,
      );
      this.assertLaunchNotCancelled(pendingSession);
      await runtime.verifyReadiness(resolvedFingerprint.prepared.readiness);
      this.assertLaunchNotCancelled(pendingSession);
      const automation = runtime.getAutomationEndpoint();
      if (resolvedFingerprint.shouldCache) {
        try {
          this.fingerprintCacheRepository.store(
            options.profileId,
            resolvedFingerprint.envelope,
            this.now().toISOString(),
          );
        } catch (error: unknown) {
          logger.error('Validated fingerprint envelope could not be cached.', error);
        }
      }

      const readyAt = this.now().toISOString();
      const view: BrowserSession = {
        sessionId,
        profileId: options.profileId,
        state: 'starting',
        pid: processHandle.pid,
        automation,
        startedAt,
        ...descriptor,
      };
      registeredActive = { view, runtime, removeExitListener: () => undefined };
      this.sessions.set(sessionId, registeredActive);
      registeredActive.removeExitListener = runtime.onExit((exitCode) => {
        this.handleUnexpectedExit(sessionId, exitCode);
      });
      const running = this.transition(sessionId, 'running', {
        processId: processHandle.pid,
        readyAt,
      });
      view.state = running.state;
      this.pendingSessions.delete(sessionId);
      return view;
    } catch (error: unknown) {
      const launchError = pendingSession.cancelRequested
        ? Object.assign(new Error('Browser launch was cancelled by a stop request.'), {
          code: 'LAUNCH_FAILED',
        })
        : error;
      if (registeredActive) {
        registeredActive.removeExitListener();
        this.sessions.delete(sessionId);
      }
      if (runtime) {
        await runtime.stop().catch((cleanupError: unknown) => {
          logger.error('Browser runtime cleanup failed after launch error.', cleanupError);
        });
      } else if (processHandle) {
        await processHandle.stop().catch((cleanupError: unknown) => {
          logger.error('Browser process cleanup failed after launch error.', cleanupError);
        });
      }
      if (sessionCreated) {
        const occurredAt = this.now().toISOString();
        if (pendingSession.cancelRequested) {
          this.publish(this.sessionRepository.transition(sessionId, 'stopped', occurredAt, {
            stoppedAt: occurredAt,
            terminationReason: 'requested_during_starting',
          }));
        } else {
          this.publish(this.sessionRepository.transition(sessionId, 'error', occurredAt, {
            stoppedAt: occurredAt,
            terminationReason: 'launch_failed',
            errorCode: getErrorCode(launchError),
          }));
        }
      }
      if (durableLockAcquired) this.lockManager.releaseDurableLock(options.profileId, sessionId);
      throw launchError;
    } finally {
      this.pendingSessions.delete(sessionId);
      this.lockManager.releaseInProcessMutex(options.profileId);
    }
  }

  private async resolveConfiguredProxy(proxyId: string): Promise<BrowserLaunchProxy> {
    if (!this.resolveProxy) {
      throw Object.assign(new Error('Proxy runtime resolver is unavailable.'), {
        code: 'PROXY_RUNTIME_UNAVAILABLE',
      });
    }
    return this.resolveProxy(proxyId);
  }

  async stop(sessionId: string): Promise<void> {
    const pending = this.pendingSessions.get(sessionId);
    if (pending) {
      pending.cancelRequested = true;
      if (pending.runtime) await pending.runtime.stop();
      else if (pending.processHandle) await pending.processHandle.stop();
      return;
    }
    const active = this.sessions.get(sessionId);
    if (!active) return;
    if (this.stoppingSessions.has(sessionId)) return;

    this.stoppingSessions.add(sessionId);
    active.view.state = 'stopping';
    this.transition(sessionId, 'stopping');
    active.removeExitListener();
    try {
      await active.runtime.stop();
      const stoppedAt = this.now().toISOString();
      this.publish(this.sessionRepository.transition(sessionId, 'stopped', stoppedAt, {
        stoppedAt,
        exitCode: 0,
        terminationReason: 'requested',
      }));
    } catch (error: unknown) {
      const stoppedAt = this.now().toISOString();
      this.publish(this.sessionRepository.transition(sessionId, 'error', stoppedAt, {
        stoppedAt,
        terminationReason: 'stop_failed',
        errorCode: getErrorCode(error),
      }));
      throw error;
    } finally {
      this.lockManager.releaseDurableLock(active.view.profileId, sessionId);
      this.sessions.delete(sessionId);
      this.stoppingSessions.delete(sessionId);
    }
  }

  async shutdown(): Promise<void> {
    const sessionIds = new Set([...this.pendingSessions.keys(), ...this.sessions.keys()]);
    await Promise.allSettled([...sessionIds].map((sessionId) => this.stop(sessionId)));
    this.lockManager.shutdown();
  }

  listActive(): BrowserSession[] {
    return [...this.sessions.values()].map(({ view }) => ({ ...view }));
  }

  getSession(sessionId: string): BrowserSession | undefined {
    const session = this.sessions.get(sessionId)?.view;
    return session ? { ...session } : undefined;
  }

  getActiveForProfile(profileId: string): BrowserSession | undefined {
    return this.listActive().find((session) => session.profileId === profileId);
  }

  getRuntimeSnapshot(): ProfileRuntimeSnapshotEnvelope {
    return this.sessionRepository.getRuntimeSnapshot(this.now().toISOString());
  }

  getBufferedEvents(afterSequence: number): ProfileRuntimeEvent[] {
    return this.eventBuffer.filter((event) => event.sequence > afterSequence).map((event) => ({ ...event }));
  }

  subscribeRuntime(listener: (event: ProfileRuntimeEvent) => void, afterSequence = 0): () => void {
    for (const event of this.getBufferedEvents(afterSequence)) listener(event);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private transition(
    sessionId: string,
    state: ProfileRuntimeState,
    updates: Parameters<BrowserSessionRepository['transition']>[3] = {},
  ): ProfileRuntimeEvent {
    const event = this.sessionRepository.transition(sessionId, state, this.now().toISOString(), updates);
    this.publish(event);
    return event;
  }

  private assertLaunchNotCancelled(pending: PendingSession): void {
    if (pending.cancelRequested) {
      throw Object.assign(new Error('Browser launch was cancelled by a stop request.'), {
        code: 'LAUNCH_FAILED',
      });
    }
  }

  private handleUnexpectedExit(sessionId: string, exitCode?: number): void {
    if (this.stoppingSessions.has(sessionId)) return;
    const active = this.sessions.get(sessionId);
    if (!active) return;
    const occurredAt = this.now().toISOString();
    this.publish(this.sessionRepository.transition(sessionId, 'crashed', occurredAt, {
      stoppedAt: occurredAt,
      ...(exitCode !== undefined ? { exitCode } : {}),
      terminationReason: 'browser_process_exit',
      errorCode: 'BROWSER_PROCESS_EXITED',
    }));
    active.removeExitListener();
    this.stoppingSessions.add(sessionId);
    void active.runtime.stop()
      .catch((error: unknown) => logger.error('Crashed browser runtime cleanup failed.', error))
      .finally(() => {
        this.lockManager.releaseDurableLock(active.view.profileId, sessionId);
        this.sessions.delete(sessionId);
        this.stoppingSessions.delete(sessionId);
      });
  }

  private assertPhaseOneRuntime(descriptor: BrowserRuntimeDescriptor): void {
    if (descriptor.engine !== 'chromium') {
      throw Object.assign(new Error('Fingerprint injection Phase 1 supports Chromium only.'), {
        code: 'BROWSER_ENGINE_UNAVAILABLE',
      });
    }
    if (descriptor.distribution !== 'chromium') {
      throw Object.assign(new Error('Fingerprint injection Phase 1 requires bundled Chromium.'), {
        code: 'BROWSER_DISTRIBUTION_UNAVAILABLE',
      });
    }
    if (descriptor.architecture !== getHostArchitecture()) {
      throw Object.assign(new Error('Configured browser architecture does not match this device.'), {
        code: 'BROWSER_ARCHITECTURE_MISMATCH',
      });
    }
  }

  private async resolvePreparedFingerprint(
    profileId: string,
    descriptor: BrowserRuntimeDescriptor,
    profileOs: string,
  ): Promise<ResolvedPreparedFingerprint> {
    if (profileOs !== 'windows' && profileOs !== 'mac' && profileOs !== 'linux') {
      throw new FingerprintPipelineError(
        'FINGERPRINT_OS_MISMATCH',
        'Profile operating system is unsupported.',
      );
    }
    let candidate: unknown;
    let fromCloudOrDevelopmentProvider = false;
    try {
      candidate = await this.fingerprintProvider.getVerifiedEnvelope({
        profileId,
        targetEngine: 'chromium',
        targetOs: profileOs,
      });
      fromCloudOrDevelopmentProvider = true;
    } catch (error: unknown) {
      if (!(error instanceof FingerprintPipelineError)
        || error.code !== 'FINGERPRINT_SERVICE_UNAVAILABLE') {
        throw error;
      }
      if (!this.canUseOfflineFingerprintCache(profileId)) throw error;
      try {
        candidate = this.fingerprintCacheRepository.find(profileId);
      } catch (cacheError: unknown) {
        logger.error('Fingerprint envelope cache could not be read.', cacheError);
      }
      if (candidate === undefined) throw error;
    }

    const envelope = this.fingerprintValidator.validate(candidate, {
      targetEngine: 'chromium',
      targetOs: profileOs,
      runtimeVersion: descriptor.browserVersion,
    });
    return {
      prepared: this.fingerprintMapper(envelope),
      envelope,
      shouldCache: fromCloudOrDevelopmentProvider,
    };
  }

  private publish(event: ProfileRuntimeEvent): void {
    const previous = this.eventBuffer.at(-1);
    if (previous && event.sequence <= previous.sequence) {
      throw new Error(`Runtime event sequence regression: ${event.sequence} <= ${previous.sequence}`);
    }
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > EVENT_BUFFER_LIMIT) this.eventBuffer.shift();
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error: unknown) {
        logger.error('Runtime event listener failed.', error);
      }
    }
  }
}

function getErrorCode(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    return String((error as Error & { code?: unknown }).code ?? 'LAUNCH_FAILED');
  }
  return 'LAUNCH_FAILED';
}
