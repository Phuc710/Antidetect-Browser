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
import { BrowserSessionRepository } from '../database/repositories/browser-session-repository.js';
import { ProfileRepository } from '../database/repositories/profile-repository.js';
import type { DatabaseService } from './database-service.js';
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
  automation: AutomationConnection;
  stop: () => Promise<void>;
  onExit: (listener: (exitCode?: number) => void) => () => void;
}

export interface BrowserProcessLauncher {
  launch(options: BrowserRuntimeDescriptor & {
    automationProtocol: AutomationProtocol;
    userDataDir: string;
    headless: boolean;
  }): Promise<BrowserProcessHandle>;
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
  storageResolver?: ProfileStorageResolver;
  lockManager?: ProfileLockManager;
  launcher?: BrowserProcessLauncher;
  idGenerator?: () => string;
  now?: () => Date;
  deviceId?: string;
}

class PlaywrightProcessLauncher implements BrowserProcessLauncher {
  async launch(
    options: BrowserRuntimeDescriptor & {
      automationProtocol: AutomationProtocol;
      userDataDir: string;
      headless: boolean;
    },
  ): Promise<BrowserProcessHandle> {
    if (options.architecture !== getHostArchitecture()) {
      throw Object.assign(new Error('Configured browser architecture does not match this device.'), {
        code: 'BROWSER_ARCHITECTURE_MISMATCH',
      });
    }
    if (options.engine === 'webkit') {
      throw Object.assign(new Error('WebKit runtime is not installed for desktop profiles.'), {
        code: 'BROWSER_ENGINE_UNAVAILABLE',
      });
    }

    const playwright = await import('playwright');
    const port = await findAvailablePort();
    const closeListeners = new Set<(exitCode?: number) => void>();
    let intentionallyClosed = false;

    if (options.engine === 'firefox') {
      const server = await playwright.firefox.launchServer({
        headless: options.headless,
        args: ['-profile', options.userDataDir, '--marionette', '-marionette-port', String(port)],
      });
      const pid = server.process().pid;
      if (!pid) throw Object.assign(new Error('Firefox did not expose a process ID.'), { code: 'LAUNCH_FAILED' });
      server.on('close', () => {
        if (!intentionallyClosed) closeListeners.forEach((listener) => listener());
      });
      return {
        pid,
        automation: { protocol: 'marionette', driverPath: 'geckodriver', port },
        stop: async () => {
          intentionallyClosed = true;
          await server.close();
        },
        onExit: (listener) => {
          closeListeners.add(listener);
          return () => closeListeners.delete(listener);
        },
      };
    }

    const channel = resolveChromiumChannel(options.distribution, options.channel);
    const server = await playwright.chromium.launchServer({
      headless: options.headless,
      ...(channel ? { channel } : {}),
      args: [
        `--user-data-dir=${options.userDataDir}`,
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
      automation: { protocol: 'cdp', endpoint: `http://127.0.0.1:${port}` },
      stop: async () => {
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

function resolveChromiumChannel(
  distribution: BrowserRuntimeDescriptor['distribution'],
  channel: BrowserRuntimeDescriptor['channel'],
): string | undefined {
  if (distribution === 'chromium') return undefined;
  if (distribution === 'chrome') {
    if (channel === 'beta') return 'chrome-beta';
    if (channel === 'dev') return 'chrome-dev';
    if (channel === 'canary') return 'chrome-canary';
    return 'chrome';
  }
  if (distribution === 'edge') {
    if (channel === 'beta') return 'msedge-beta';
    if (channel === 'dev') return 'msedge-dev';
    if (channel === 'canary') return 'msedge-canary';
    return 'msedge';
  }
  throw Object.assign(new Error(`Distribution ${distribution} requires an explicit runtime path.`), {
    code: 'BROWSER_DISTRIBUTION_UNAVAILABLE',
  });
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
  process: BrowserProcessHandle;
  removeExitListener: () => void;
}

export class BrowserApplicationService {
  private readonly sessionRepository: BrowserSessionRepository;
  private readonly profileRepository: ProfileRepository;
  private readonly storageResolver: ProfileStorageResolver;
  private readonly lockManager: ProfileLockManager;
  private readonly launcher: BrowserProcessLauncher;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;
  private readonly deviceId: string;
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly listeners = new Set<(event: ProfileRuntimeEvent) => void>();
  private readonly eventBuffer: ProfileRuntimeEvent[] = [];
  private readonly stoppingSessions = new Set<string>();

  constructor(db: Pick<DatabaseService, 'getConnection'>, options: BrowserApplicationServiceOptions = {}) {
    const connection = db.getConnection();
    this.sessionRepository = new BrowserSessionRepository(connection);
    this.profileRepository = new ProfileRepository(connection);
    this.storageResolver = options.storageResolver ?? new ProfileStorageResolver();
    this.lockManager = options.lockManager ?? new ProfileLockManager(this.storageResolver);
    this.launcher = options.launcher ?? new PlaywrightProcessLauncher();
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.deviceId = options.deviceId ?? 'local_device';
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

    this.lockManager.acquireInProcessMutex(options.profileId);
    let durableLockAcquired = false;
    let sessionCreated = false;
    const sessionId = this.idGenerator();
    const descriptor: BrowserRuntimeDescriptor = {
      engine: profile.engine as BrowserRuntimeDescriptor['engine'],
      distribution: profile.distribution as BrowserRuntimeDescriptor['distribution'],
      channel: profile.channel as BrowserRuntimeDescriptor['channel'],
      browserVersion: profile.browser_version,
      architecture: profile.architecture as BrowserRuntimeDescriptor['architecture'],
    };
    const automationProtocol = options.automationProtocol ?? (descriptor.engine === 'firefox' ? 'marionette' : 'cdp');

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
      this.publish(validating);
      this.transition(sessionId, 'acquiring_lock');

      this.lockManager.acquireDurableLock(options.profileId, profile.storage_key, sessionId);
      durableLockAcquired = true;
      this.transition(sessionId, 'preparing');

      const startedAt = this.now().toISOString();
      this.transition(sessionId, 'starting', { startedAt });
      const processHandle = await this.launcher.launch({
        ...descriptor,
        automationProtocol,
        userDataDir: this.storageResolver.resolvePath(profile.storage_key),
        headless: options.headless ?? false,
      });

      const readyAt = this.now().toISOString();
      const running = this.transition(sessionId, 'running', {
        processId: processHandle.pid,
        readyAt,
      });
      const view: BrowserSession = {
        sessionId,
        profileId: options.profileId,
        state: running.state,
        pid: processHandle.pid,
        automation: processHandle.automation,
        startedAt,
        ...descriptor,
      };
      const removeExitListener = processHandle.onExit((exitCode) => {
        this.handleUnexpectedExit(sessionId, exitCode);
      });
      this.sessions.set(sessionId, { view, process: processHandle, removeExitListener });
      return view;
    } catch (error: unknown) {
      if (sessionCreated) {
        const occurredAt = this.now().toISOString();
        const errorCode = getErrorCode(error);
        this.publish(this.sessionRepository.transition(sessionId, 'error', occurredAt, {
          stoppedAt: occurredAt,
          terminationReason: 'launch_failed',
          errorCode,
        }));
      }
      if (durableLockAcquired) this.lockManager.releaseDurableLock(options.profileId, sessionId);
      throw error;
    } finally {
      this.lockManager.releaseInProcessMutex(options.profileId);
    }
  }

  async stop(sessionId: string): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) return;
    if (this.stoppingSessions.has(sessionId)) return;

    this.stoppingSessions.add(sessionId);
    active.view.state = 'stopping';
    this.transition(sessionId, 'stopping');
    active.removeExitListener();
    try {
      await active.process.stop();
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
    await Promise.allSettled([...this.sessions.keys()].map((sessionId) => this.stop(sessionId)));
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
    this.lockManager.releaseDurableLock(active.view.profileId, sessionId);
    this.sessions.delete(sessionId);
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
