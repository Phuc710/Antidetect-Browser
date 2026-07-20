import { fork, ChildProcess } from 'child_process';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import type { BrowserRuntimePort, BrowserSession, LaunchOptions } from './browser-runtime-port.js';
import type {
  LauncherCommand,
  LauncherResponse,
  LauncherEvent,
  SerializedLauncherError,
  ProfileRuntimeEvent,
  ProfileRuntimeSnapshotEnvelope,
  ProfileRuntimeState,
  BrowserRuntimeDescriptor,
  LaunchProfilePayload,
} from '../../shared/profile-contracts.js';
import { getHostArchitecture } from '../../shared/profile-contracts.js';
import { type ApplicationMode } from './fingerprint-envelope-validator.js';
import { mapFingerprintEnvelope, type PreparedFingerprintInjection } from '../adapters/fingerprint-envelope-mapper.js';
import { FingerprintEnvelopeCacheRepository } from '../database/repositories/fingerprint-envelope-cache-repository.js';
import { BrowserSessionRepository } from '../database/repositories/browser-session-repository.js';
import { ProfileRepository } from '../database/repositories/profile-repository.js';
import type { DatabaseConnectionProvider } from './database-service.js';
import { FingerprintPipelineError } from './fingerprint-envelope-validator.js';
import type { FingerprintEnvelopeValidator } from './fingerprint-envelope-validator.js';
import type { IFingerprintProvider } from './fingerprint-provider.js';
import { ProfileStorageResolver } from './profile-storage-resolver.js';
import { Logger } from './logger.js';

const logger = new Logger('LauncherClient');
const COMMAND_TIMEOUT_MS = 15000; // 15 seconds command timeout
const EVENT_BUFFER_LIMIT = 512;

export interface BrowserLaunchProxy {
  server: string;
  username?: string;
  password?: string;
}

export interface LauncherClientOptions {
  applicationMode?: ApplicationMode | undefined;
  deviceId?: string | undefined;
  launcherScriptPath?: string | undefined;
  fingerprintProvider: IFingerprintProvider;
  fingerprintValidator: FingerprintEnvelopeValidator;
  resolveProxy?: ((proxyId: string) => Promise<BrowserLaunchProxy>) | undefined;
  storageResolver?: ProfileStorageResolver | undefined;
  fingerprintMapper?: ((envelope: any) => PreparedFingerprintInjection) | undefined;
  canUseOfflineFingerprintCache?: ((profileId: string) => boolean) | undefined;
}

interface ResolvedPreparedFingerprint {
  readonly prepared: PreparedFingerprintInjection;
  readonly envelope: any;
  readonly shouldCache: boolean;
}

export class LauncherClient implements BrowserRuntimePort {
  private childProcess: ChildProcess | null = null;
  private isReady = false;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private listeners = new Set<(event: ProfileRuntimeEvent) => void>();
  private readyPromise: Promise<void> | null = null;
  private readonly eventBuffer: ProfileRuntimeEvent[] = [];

  private readonly sessionRepository: BrowserSessionRepository;
  private readonly profileRepository: ProfileRepository;
  private readonly fingerprintCacheRepository: FingerprintEnvelopeCacheRepository;
  private readonly storageResolver: ProfileStorageResolver;
  private readonly fingerprintProvider: IFingerprintProvider;
  private readonly fingerprintValidator: FingerprintEnvelopeValidator;
  private readonly resolveProxy?: ((proxyId: string) => Promise<BrowserLaunchProxy>) | undefined;
  private readonly fingerprintMapper: (envelope: any) => PreparedFingerprintInjection;
  private readonly canUseOfflineFingerprintCache: (profileId: string) => boolean;
  private readonly applicationMode: ApplicationMode;
  private readonly deviceId: string;
  private readonly launcherScriptPath?: string | undefined;

  constructor(
    databaseService: DatabaseConnectionProvider,
    options: LauncherClientOptions,
  ) {
    const db = databaseService.getConnection();
    this.sessionRepository = new BrowserSessionRepository(db);
    this.profileRepository = new ProfileRepository(db);
    this.fingerprintCacheRepository = new FingerprintEnvelopeCacheRepository(db);
    this.storageResolver = options.storageResolver ?? new ProfileStorageResolver();
    this.fingerprintProvider = options.fingerprintProvider;
    this.fingerprintValidator = options.fingerprintValidator;
    this.resolveProxy = options.resolveProxy;
    this.fingerprintMapper = options.fingerprintMapper ?? mapFingerprintEnvelope;
    this.canUseOfflineFingerprintCache = options.canUseOfflineFingerprintCache ?? (() => false);
    this.applicationMode = options.applicationMode ?? 'development';
    this.deviceId = options.deviceId ?? 'local_device';
    this.launcherScriptPath = options.launcherScriptPath;
  }

  async initialize(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const defaultScriptPath = join(__dirname, '../../../../browser-launcher/dist/index.js');
      const scriptPath = this.launcherScriptPath ?? defaultScriptPath;

      logger.info(`Spawning launcher child process at path: ${scriptPath}`);

      try {
        this.childProcess = fork(scriptPath, [], {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env: {
            ...process.env,
            NODE_ENV: this.applicationMode,
          },
        });
      } catch (err: any) {
        logger.error('Failed to fork launcher process', err);
        reject(err);
        return;
      }

      const processRef = this.childProcess;

      processRef.on('message', (message: unknown) => {
        if (!message || typeof message !== 'object') return;

        const event = message as LauncherResponse | LauncherEvent;

        if (event.type === 'launcher:ready') {
          this.sendInitialize()
            .then(() => {
              this.isReady = true;
              this.recoverCrashedSessions();
              resolve();
            })
            .catch((err) => reject(err));
          return;
        }

        if (event.type === 'session:cookies-sync') {
          const { profileId, cookies } = event.payload;
          try {
            this.profileRepository.update(profileId, { cookies, updatedAt: new Date().toISOString() });
          } catch (err) {
            logger.error(`Failed to sync cookies in database for profile ${profileId}`, err);
          }
          return;
        }

        if (event.type === 'runtime:changed') {
          const { browserSessionId, state, occurredAt, errorCode } = event.payload;
          try {
            const dbEvent = this.sessionRepository.transition(
              browserSessionId,
              state,
              occurredAt,
              errorCode ? { errorCode, terminationReason: 'browser_process_exit' } : {}
            );
            this.publish(dbEvent);
          } catch (err) {
            logger.error(`Failed to transition database session ${browserSessionId} state to ${state}`, err);
          }
          return;
        }

        if (event.type === 'command:success' || event.type === 'command:error') {
          const req = this.pendingRequests.get(event.requestId);
          if (req) {
            clearTimeout(req.timeout);
            this.pendingRequests.delete(event.requestId);

            if (event.type === 'command:success') {
              req.resolve(event.payload);
            } else {
              req.reject(this.deserializeError(event.error));
            }
          }
          return;
        }
      });

      processRef.on('error', (err) => {
        logger.error('Launcher process error event', err);
        this.cleanupProcess(err);
        reject(err);
      });

      processRef.on('exit', (code, signal) => {
        logger.warn(`Launcher process exited with code ${code} and signal ${signal}`);
        this.cleanupProcess(new Error(`Launcher process exited unexpectedly (code: ${code}, signal: ${signal})`));
      });
    });

    return this.readyPromise;
  }

  private recoverCrashedSessions(): number {
    let recovered = 0;
    for (const session of this.sessionRepository.listActive()) {
      const profile = this.profileRepository.findById(session.profile_id);
      const storageKey = profile?.storage_key ?? `profile_${session.profile_id}`;
      const lockPath = join(this.storageResolver.resolvePath(storageKey), 'session.lock');

      let lockState: 'missing' | 'owned_by_live_process' | 'removed_stale' = 'missing';
      if (fs.existsSync(lockPath)) {
        try {
          const payload = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
          let isAlive = false;
          try {
            process.kill(payload.ownerProcessId, 0);
            isAlive = true;
          } catch {}
          if (isAlive) {
            lockState = 'owned_by_live_process';
          } else {
            fs.rmSync(lockPath, { force: true });
            lockState = 'removed_stale';
          }
        } catch {
          fs.rmSync(lockPath, { force: true });
          lockState = 'removed_stale';
        }
      }

      const occurredAt = new Date().toISOString();
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

  private async sendInitialize(): Promise<void> {
    await this.sendCommand({
      type: 'launcher:initialize',
      requestId: randomUUID(),
      payload: {
        applicationMode: this.applicationMode,
        deviceId: this.deviceId,
      },
    });
  }

  private sendCommand<T>(cmd: LauncherCommand): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.childProcess) {
        reject(new Error('Launcher process is not running.'));
        return;
      }

      if (!this.isReady && cmd.type !== 'launcher:initialize') {
        reject(new Error('Launcher process is not initialized yet.'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(cmd.requestId);
        reject(Object.assign(new Error(`Command ${cmd.type} timed out.`), { code: 'LAUNCHER_TIMEOUT' }));
      }, COMMAND_TIMEOUT_MS);

      this.pendingRequests.set(cmd.requestId, { resolve, reject, timeout });

      this.childProcess.send(cmd, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(cmd.requestId);
          reject(err);
        }
      });
    });
  }

  private deserializeError(error: SerializedLauncherError): Error {
    return Object.assign(new Error(error.message), { code: error.code });
  }

  private cleanupProcess(error: Error) {
    this.isReady = false;
    this.readyPromise = null;
    this.childProcess = null;

    // Reject all pending requests
    for (const req of this.pendingRequests.values()) {
      clearTimeout(req.timeout);
      req.reject(Object.assign(new Error(`Launcher process crashed: ${error.message}`), { code: 'LAUNCHER_CRASHED' }));
    }
    this.pendingRequests.clear();
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

    const proxy = profile.proxy_id
      ? await this.resolveConfiguredProxy(profile.proxy_id)
      : undefined;

    const sessionId = randomUUID();

    const payload: LaunchProfilePayload = {
      sessionId,
      profileId: options.profileId,
      userDataDir: this.storageResolver.resolvePath(profile.storage_key),
      headless: options.headless ?? false,
      engine: descriptor.engine,
      distribution: descriptor.distribution,
      channel: descriptor.channel,
      browserVersion: descriptor.browserVersion,
      architecture: descriptor.architecture,
      automationProtocol: 'cdp',
      proxy: proxy ? {
        server: proxy.server,
        ...(proxy.username !== undefined ? { username: proxy.username } : {}),
        ...(proxy.password !== undefined ? { password: proxy.password } : {}),
      } : undefined,
      cookies: profile.cookies,
      preparedFingerprint: {
        fingerprintWithHeaders: resolvedFingerprint.prepared.fingerprintWithHeaders,
        markerScript: resolvedFingerprint.prepared.markerScript,
        readiness: resolvedFingerprint.prepared.readiness,
      },
    };

    if (resolvedFingerprint.shouldCache) {
      try {
        this.fingerprintCacheRepository.store(
          options.profileId,
          resolvedFingerprint.envelope,
          new Date().toISOString(),
        );
      } catch (error) {
        logger.error('Validated fingerprint envelope could not be cached.', error);
      }
    }

    return this.sendCommand<BrowserSession>({
      type: 'profile:launch',
      requestId: randomUUID(),
      payload,
    });
  }

  private async resolveConfiguredProxy(proxyId: string): Promise<BrowserLaunchProxy> {
    if (!this.resolveProxy) {
      throw Object.assign(new Error('Proxy runtime resolver is unavailable.'), {
        code: 'PROXY_RUNTIME_UNAVAILABLE',
      });
    }
    return this.resolveProxy(proxyId);
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

  async stop(sessionId: string): Promise<void> {
    return this.sendCommand<void>({
      type: 'profile:stop',
      requestId: randomUUID(),
      payload: { sessionId },
    });
  }

  getRuntimeSnapshot(): ProfileRuntimeSnapshotEnvelope {
    return this.sessionRepository.getRuntimeSnapshot(new Date().toISOString());
  }

  private mapRecordToSession(record: any): BrowserSession {
    return {
      sessionId: record.id,
      profileId: record.profile_id,
      state: record.state,
      pid: record.process_id ?? 0,
      automation: record.automation_endpoint ? {
        protocol: record.automation_protocol ?? 'cdp',
        endpoint: record.automation_endpoint,
      } : { protocol: 'cdp', endpoint: '' },
      startedAt: record.started_at,
      engine: record.engine,
      distribution: record.distribution,
      channel: record.channel,
      browserVersion: record.browser_version,
      architecture: record.architecture,
    };
  }

  listActive(): BrowserSession[] {
    return this.sessionRepository.listActive().map(r => this.mapRecordToSession(r));
  }

  getSession(sessionId: string): BrowserSession | undefined {
    const record = this.sessionRepository.listActive().find(r => r.id === sessionId);
    return record ? this.mapRecordToSession(record) : undefined;
  }

  getActiveForProfile(profileId: string): BrowserSession | undefined {
    const record = this.sessionRepository.getActiveForProfile(profileId);
    return record ? this.mapRecordToSession(record) : undefined;
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

  subscribe(listener: (event: ProfileRuntimeEvent) => void, afterSequence = 0): () => void {
    const buffered = this.eventBuffer.filter((event) => event.sequence > afterSequence);
    for (const event of buffered) {
      listener(event);
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async shutdown(): Promise<void> {
    if (!this.childProcess) return;

    try {
      await this.sendCommand({
        type: 'launcher:shutdown',
        requestId: randomUUID(),
      });
    } catch (err) {
      logger.warn('Error sending shutdown command to launcher process, killing process', err);
    } finally {
      if (this.childProcess) {
        this.childProcess.kill('SIGTERM');
        this.childProcess = null;
      }
      this.isReady = false;
      this.readyPromise = null;
    }
  }
}
