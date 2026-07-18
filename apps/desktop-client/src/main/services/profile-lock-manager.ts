import { randomUUID } from 'crypto';
import fs from 'fs';
import { join } from 'path';
import type { ProfileStorageResolver } from './profile-storage-resolver.js';
import { Logger } from './logger.js';

const logger = new Logger('ProfileLockManager');

export interface LockfilePayload {
  schemaVersion: 1;
  profileId: string;
  browserSessionId: string;
  ownerProcessId: number;
  ownerInstanceId: string;
  ownerToken: string;
  acquiredAt: string;
  heartbeatAt: string;
}

interface OwnedLock {
  path: string;
  payload: LockfilePayload;
  timer: NodeJS.Timeout;
}

export interface ProfileLockManagerOptions {
  instanceId?: string;
  processId?: number;
  heartbeatIntervalMs?: number;
  isProcessAlive?: (processId: number) => boolean;
  now?: () => Date;
}

export type LockRecoveryResult = 'missing' | 'removed_stale' | 'owned_by_live_process' | 'ownership_mismatch';

function defaultIsProcessAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

export class ProfileLockManager {
  private readonly inProcessMutexes = new Set<string>();
  private readonly ownedLocks = new Map<string, OwnedLock>();
  private readonly instanceId: string;
  private readonly processId: number;
  private readonly heartbeatIntervalMs: number;
  private readonly isProcessAlive: (processId: number) => boolean;
  private readonly now: () => Date;

  constructor(
    private readonly storageResolver: ProfileStorageResolver,
    options: ProfileLockManagerOptions = {},
  ) {
    this.instanceId = options.instanceId ?? randomUUID();
    this.processId = options.processId ?? process.pid;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
    this.isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
    this.now = options.now ?? (() => new Date());
  }

  acquireInProcessMutex(profileId: string): void {
    if (this.inProcessMutexes.has(profileId)) {
      throw Object.assign(new Error('Profile is already launching in this process.'), {
        code: 'PROFILE_ALREADY_RUNNING',
      });
    }
    this.inProcessMutexes.add(profileId);
  }

  releaseInProcessMutex(profileId: string): void {
    this.inProcessMutexes.delete(profileId);
  }

  acquireDurableLock(profileId: string, storageKey: string, browserSessionId: string): string {
    const profileDir = this.storageResolver.resolvePath(storageKey);
    fs.mkdirSync(profileDir, { recursive: true });
    const lockPath = join(profileDir, 'session.lock');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const payload = this.createPayload(profileId, browserSessionId);
      try {
        const descriptor = fs.openSync(lockPath, 'wx', 0o600);
        try {
          fs.writeFileSync(descriptor, JSON.stringify(payload), 'utf8');
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }

        const timer = setInterval(() => this.heartbeat(browserSessionId), this.heartbeatIntervalMs);
        timer.unref();
        this.ownedLocks.set(browserSessionId, { path: lockPath, payload, timer });
        return lockPath;
      } catch (error: unknown) {
        if (!this.isAlreadyExists(error)) throw error;
        const existing = this.readLock(lockPath);
        if (!existing) {
          throw Object.assign(new Error('Existing profile lock is unreadable.'), { code: 'PROFILE_LOCK_CORRUPT' });
        }
        if (this.isProcessAlive(existing.ownerProcessId)) {
          throw Object.assign(
            new Error(`Profile is locked by live process ${existing.ownerProcessId}.`),
            { code: 'PROFILE_ALREADY_RUNNING' },
          );
        }
        logger.warn(`Removing stale lock for profile ${profileId} from dead process ${existing.ownerProcessId}.`);
        this.removeLockIfMatches(lockPath, existing);
      }
    }

    throw Object.assign(new Error('Unable to acquire profile lock.'), { code: 'PROFILE_LOCK_FAILED' });
  }

  releaseDurableLock(profileId: string, browserSessionId: string): boolean {
    const owned = this.ownedLocks.get(browserSessionId);
    if (!owned) return false;
    clearInterval(owned.timer);
    this.ownedLocks.delete(browserSessionId);

    const current = this.readLock(owned.path);
    if (!current || !this.sameOwner(current, owned.payload) || current.profileId !== profileId) {
      logger.warn(`Refused to delete lock without ownership for profile ${profileId}.`);
      return false;
    }
    return this.removeLockIfMatches(owned.path, owned.payload);
  }

  recoverDurableLock(profileId: string, storageKey: string, browserSessionId: string): LockRecoveryResult {
    const lockPath = join(this.storageResolver.resolvePath(storageKey), 'session.lock');
    if (!fs.existsSync(lockPath)) return 'missing';
    const payload = this.readLock(lockPath);
    if (!payload || payload.profileId !== profileId || payload.browserSessionId !== browserSessionId) {
      return 'ownership_mismatch';
    }
    if (this.isProcessAlive(payload.ownerProcessId)) return 'owned_by_live_process';
    return this.removeLockIfMatches(lockPath, payload) ? 'removed_stale' : 'ownership_mismatch';
  }

  shutdown(): void {
    for (const [sessionId, owned] of this.ownedLocks) {
      clearInterval(owned.timer);
      this.releaseDurableLock(owned.payload.profileId, sessionId);
    }
    this.inProcessMutexes.clear();
  }

  private createPayload(profileId: string, browserSessionId: string): LockfilePayload {
    const now = this.now().toISOString();
    return {
      schemaVersion: 1,
      profileId,
      browserSessionId,
      ownerProcessId: this.processId,
      ownerInstanceId: this.instanceId,
      ownerToken: randomUUID(),
      acquiredAt: now,
      heartbeatAt: now,
    };
  }

  private heartbeat(browserSessionId: string): void {
    const owned = this.ownedLocks.get(browserSessionId);
    if (!owned) return;
    const current = this.readLock(owned.path);
    if (!current || !this.sameOwner(current, owned.payload)) {
      clearInterval(owned.timer);
      this.ownedLocks.delete(browserSessionId);
      logger.error(`Lost durable-lock ownership for session ${browserSessionId}.`);
      return;
    }
    owned.payload.heartbeatAt = this.now().toISOString();
    fs.writeFileSync(owned.path, JSON.stringify(owned.payload), { encoding: 'utf8', mode: 0o600 });
  }

  private readLock(lockPath: string): LockfilePayload | null {
    try {
      const value = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Partial<LockfilePayload>;
      if (
        value.schemaVersion !== 1 || typeof value.profileId !== 'string' ||
        typeof value.browserSessionId !== 'string' || typeof value.ownerProcessId !== 'number' ||
        typeof value.ownerInstanceId !== 'string' || typeof value.ownerToken !== 'string' ||
        typeof value.acquiredAt !== 'string' || typeof value.heartbeatAt !== 'string'
      ) return null;
      return value as LockfilePayload;
    } catch {
      return null;
    }
  }

  private removeLockIfMatches(lockPath: string, expected: LockfilePayload): boolean {
    const current = this.readLock(lockPath);
    if (!current || !this.sameOwner(current, expected)) return false;
    fs.rmSync(lockPath, { force: true });
    return true;
  }

  private sameOwner(left: LockfilePayload, right: LockfilePayload): boolean {
    return left.ownerInstanceId === right.ownerInstanceId && left.ownerToken === right.ownerToken;
  }

  private isAlreadyExists(error: unknown): boolean {
    return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST';
  }
}
