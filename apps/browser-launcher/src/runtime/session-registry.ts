import type {
    AutomationProtocol,
    BrowserArchitecture,
    BrowserChannel,
    BrowserDistribution,
    BrowserEngine,
    ProfileRuntimeSnapshot,
    ProfileRuntimeState,
} from 'shared';

import { LauncherError } from '../errors/launcher-error.js';
import { PlaywrightRuntimeAdapter } from './playwright-runtime-adapter.js';

export interface BrowserSession {
    readonly sessionId: string;
    readonly profileId: string;
    /**
     * Chromium OS process ID, if available.
     * launchPersistentContext does not expose the OS PID through public APIs,
     * so this is undefined for persistent-context sessions.
     */
    readonly browserPid?: number | undefined;
    state: ProfileRuntimeState;
    readonly startedAt: string;
    readonly engine: BrowserEngine;
    readonly distribution: BrowserDistribution;
    readonly channel: BrowserChannel;
    readonly browserVersion: string;
    readonly architecture: BrowserArchitecture;
    /**
     * External automation endpoint, if applicable.
     * Undefined for persistent-context sessions (internal Playwright control
     * does not create a public external CDP endpoint).
     */
    readonly automation?:
        | { readonly protocol: AutomationProtocol; readonly endpoint?: string }
        | undefined;
    readonly browserHandle: PlaywrightRuntimeAdapter;
}

export class SessionRegistry {
    private readonly sessionsBySessionId = new Map<string, BrowserSession>();
    private readonly sessionIdByProfileId = new Map<string, string>();
    private snapshotSequence = 1;

    getByProfileId(profileId: string): BrowserSession | undefined {
        const sessionId = this.sessionIdByProfileId.get(profileId);
        return sessionId ? this.sessionsBySessionId.get(sessionId) : undefined;
    }

    getBySessionId(sessionId: string): BrowserSession | undefined {
        return this.sessionsBySessionId.get(sessionId);
    }

    add(session: BrowserSession): void {
        if (this.getByProfileId(session.profileId)) {
            throw LauncherError.profileAlreadyRunning(session.profileId);
        }
        if (this.getBySessionId(session.sessionId)) {
            throw new LauncherError(
                'PROFILE_ALREADY_RUNNING',
                `Session ${session.sessionId} is already registered.`,
            );
        }
        this.sessionsBySessionId.set(session.sessionId, session);
        this.sessionIdByProfileId.set(session.profileId, session.sessionId);
    }

    updateState(sessionId: string, state: ProfileRuntimeState): void {
        const session = this.getBySessionId(sessionId);
        if (!session) {
            throw LauncherError.sessionNotFound(sessionId);
        }
        session.state = state;
    }

    remove(sessionId: string): BrowserSession | undefined {
        const session = this.sessionsBySessionId.get(sessionId);
        if (session) {
            this.sessionsBySessionId.delete(sessionId);
            this.sessionIdByProfileId.delete(session.profileId);
        }
        return session;
    }

    list(): BrowserSession[] {
        return [...this.sessionsBySessionId.values()];
    }

    createSnapshot(): {
        readonly sequence: number;
        readonly sessions: readonly ProfileRuntimeSnapshot[];
    } {
        const seq = this.snapshotSequence++;
        const sessions = [...this.sessionsBySessionId.values()].map((s) => ({
            profileId: s.profileId,
            browserSessionId: s.sessionId,
            sequence: seq,
            state: s.state,
            occurredAt: new Date().toISOString(),
            startedAt: s.startedAt,
            // processId omitted when not available — callers that map to DB
            // persist NULL for unavailable PID per truthfulness contract.
            ...(s.browserPid !== undefined ? { processId: s.browserPid } : {}),
            engine: s.engine,
            distribution: s.distribution,
            channel: s.channel,
            browserVersion: s.browserVersion,
            architecture: s.architecture,
        }));
        return { sequence: seq, sessions };
    }

    snapshot(): ProfileRuntimeSnapshot[] {
        return [...this.createSnapshot().sessions];
    }
}
