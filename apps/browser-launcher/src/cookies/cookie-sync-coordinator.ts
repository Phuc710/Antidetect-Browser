import crypto from 'node:crypto';

import type { BrowserSession } from '../runtime/session-registry.js';
import type { ProcessTransport } from '../transport/process-transport.js';

export class CookieSyncCoordinator {
    private readonly intervals = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();

    private readonly previousHashes = new Map<string, string>();
    private readonly activeSyncs = new Set<string>();

    constructor(
        private readonly transport: ProcessTransport,
        private readonly pollIntervalMs: number = 10000,
    ) {}

    start(session: BrowserSession) {
        this.stop(session.sessionId);

        const interval = setInterval(async () => {
            await this.syncCookies(session);
        }, this.pollIntervalMs);

        this.intervals.set(session.sessionId, interval);
    }

    stop(sessionId: string) {
        const interval = this.intervals.get(sessionId);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(sessionId);
        }
        this.previousHashes.delete(sessionId);
        this.activeSyncs.delete(sessionId);
    }

    async syncCookies(session: BrowserSession): Promise<void> {
        if (this.activeSyncs.has(session.sessionId)) {
            return; // Skip if a sync is already running for this session
        }

        this.activeSyncs.add(session.sessionId);
        try {
            const cookies = await session.browserHandle.getCookies();
            const serialized = this.normalizeAndSerialize(cookies);
            const hash = this.computeHash(serialized);

            const lastHash = this.previousHashes.get(session.sessionId);
            if (hash !== lastHash) {
                this.previousHashes.set(session.sessionId, hash);
                this.transport.send({
                    type: 'session:cookies-sync',
                    payload: {
                        profileId: session.profileId,
                        sessionId: session.sessionId,
                        cookies: serialized,
                    },
                });
            }
        } catch {
            // Ignore errors (context could be closing)
        } finally {
            this.activeSyncs.delete(session.sessionId);
        }
    }

    async finalFlush(session: BrowserSession): Promise<void> {
        this.stop(session.sessionId);
        try {
            const cookies = await session.browserHandle.getCookies();
            const serialized = this.normalizeAndSerialize(cookies);

            this.transport.send({
                type: 'session:cookies-sync',
                payload: {
                    profileId: session.profileId,
                    sessionId: session.sessionId,
                    cookies: serialized,
                },
            });
        } catch {
            // Silent catch on final shutdown
        }
    }

    private normalizeAndSerialize(cookies: any[]): string {
        if (!Array.isArray(cookies)) return '[]';

        // Sort cookies alphabetically by domain, path, and name to get a consistent signature
        const sorted = [...cookies].sort((a, b) => {
            const domainCompare = String(a.domain || '').localeCompare(
                b.domain || '',
            );
            if (domainCompare !== 0) return domainCompare;

            const pathCompare = String(a.path || '').localeCompare(
                b.path || '',
            );
            if (pathCompare !== 0) return pathCompare;

            return String(a.name || '').localeCompare(b.name || '');
        });

        // Strip volatile fields (like session identifier markers or expiry calculations if they jitter, but standard fields are safe)
        return JSON.stringify(sorted);
    }

    private computeHash(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
}
