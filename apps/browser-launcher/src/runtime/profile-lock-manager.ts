import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';

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

export class ProfileLockManager {
    private readonly ownedLocks = new Map<
        string,
        {
            path: string;
            payload: LockfilePayload;
            timer: ReturnType<typeof setInterval>;
        }
    >();

    private readonly instanceId: string;
    private readonly processId: number;
    private readonly heartbeatIntervalMs: number;

    constructor(
        options: {
            instanceId?: string;
            processId?: number;
            heartbeatIntervalMs?: number;
        } = {},
    ) {
        this.instanceId = options.instanceId ?? randomUUID();
        this.processId = options.processId ?? process.pid;
        this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
    }

    private isProcessAlive(pid: number): boolean {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    acquireDurableLock(
        profileId: string,
        userDataDir: string,
        browserSessionId: string,
    ): string {
        fs.mkdirSync(userDataDir, { recursive: true });
        const lockPath = join(userDataDir, 'session.lock');

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const payload = this.createPayload(profileId, browserSessionId);
            try {
                const descriptor = fs.openSync(lockPath, 'wx', 0o600);
                try {
                    fs.writeFileSync(
                        descriptor,
                        JSON.stringify(payload),
                        'utf8',
                    );
                    fs.fsyncSync(descriptor);
                } finally {
                    fs.closeSync(descriptor);
                }

                const timer = setInterval(
                    () => this.heartbeat(browserSessionId),
                    this.heartbeatIntervalMs,
                );
                timer.unref();
                this.ownedLocks.set(browserSessionId, {
                    path: lockPath,
                    payload,
                    timer,
                });
                return lockPath;
            } catch (error: unknown) {
                if (!this.isAlreadyExists(error)) throw error;
                const existing = this.readLock(lockPath);
                if (!existing) {
                    throw Object.assign(
                        new Error('Existing profile lock is unreadable.'),
                        { code: 'PROFILE_LOCK_CORRUPT' },
                    );
                }
                if (this.isProcessAlive(existing.ownerProcessId)) {
                    throw Object.assign(
                        new Error(
                            `Profile is locked by live process ${existing.ownerProcessId}.`,
                        ),
                        { code: 'PROFILE_ALREADY_RUNNING' },
                    );
                }
                // Remove stale lock
                this.removeLockIfMatches(lockPath, existing);
            }
        }

        throw Object.assign(new Error('Unable to acquire profile lock.'), {
            code: 'PROFILE_LOCK_FAILED',
        });
    }

    releaseDurableLock(profileId: string, browserSessionId: string): boolean {
        const owned = this.ownedLocks.get(browserSessionId);
        if (!owned) return false;
        clearInterval(owned.timer);
        this.ownedLocks.delete(browserSessionId);

        const current = this.readLock(owned.path);
        if (
            !current ||
            !this.sameOwner(current, owned.payload) ||
            current.profileId !== profileId
        ) {
            return false;
        }
        return this.removeLockIfMatches(owned.path, owned.payload);
    }

    private createPayload(
        profileId: string,
        browserSessionId: string,
    ): LockfilePayload {
        const now = new Date().toISOString();
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
            return;
        }
        owned.payload.heartbeatAt = new Date().toISOString();
        fs.writeFileSync(owned.path, JSON.stringify(owned.payload), {
            encoding: 'utf8',
            mode: 0o600,
        });
    }

    private readLock(lockPath: string): LockfilePayload | null {
        try {
            const value = JSON.parse(
                fs.readFileSync(lockPath, 'utf8'),
            ) as Partial<LockfilePayload>;
            if (
                value.schemaVersion !== 1 ||
                typeof value.profileId !== 'string' ||
                typeof value.browserSessionId !== 'string' ||
                typeof value.ownerProcessId !== 'number' ||
                typeof value.ownerInstanceId !== 'string' ||
                typeof value.ownerToken !== 'string' ||
                typeof value.acquiredAt !== 'string' ||
                typeof value.heartbeatAt !== 'string'
            )
                return null;
            return value as LockfilePayload;
        } catch {
            return null;
        }
    }

    private removeLockIfMatches(
        lockPath: string,
        expected: LockfilePayload,
    ): boolean {
        const current = this.readLock(lockPath);
        if (!current || !this.sameOwner(current, expected)) return false;
        fs.rmSync(lockPath, { force: true });
        return true;
    }

    private sameOwner(left: LockfilePayload, right: LockfilePayload): boolean {
        return (
            left.ownerInstanceId === right.ownerInstanceId &&
            left.ownerToken === right.ownerToken
        );
    }

    private isAlreadyExists(error: unknown): boolean {
        return (
            error instanceof Error &&
            'code' in error &&
            (error as { code?: string }).code === 'EEXIST'
        );
    }

    shutdown(): void {
        for (const [sessionId, owned] of this.ownedLocks) {
            clearInterval(owned.timer);
            this.releaseDurableLock(owned.payload.profileId, sessionId);
        }
        this.ownedLocks.clear();
    }
}
