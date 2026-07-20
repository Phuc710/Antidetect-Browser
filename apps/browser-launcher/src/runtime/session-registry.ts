import type { ProfileRuntimeState, ProfileRuntimeSnapshot } from 'shared';

export interface BrowserSession {
  sessionId: string;
  profileId: string;
  pid?: number;
  state: ProfileRuntimeState;
  startedAt: string;
  engine: 'chromium' | 'firefox' | 'webkit';
  distribution: 'chromium' | 'chrome' | 'edge' | 'brave' | 'firefox' | 'webkit' | 'custom';
  channel: 'stable' | 'beta' | 'dev' | 'canary' | 'custom';
  browserVersion: string;
  architecture: 'x64' | 'arm64';
  automation: {
    protocol: 'cdp' | 'webdriver' | 'marionette';
    endpoint: string;
  };
  browserHandle: any;
  cookieSyncInterval?: NodeJS.Timeout;
}

export type SessionPatch = Partial<Omit<BrowserSession, 'profileId' | 'sessionId' | 'browserHandle'>>;

export class SessionRegistry {
  private readonly sessions = new Map<string, BrowserSession>();

  getByProfileId(profileId: string): BrowserSession | undefined {
    return [...this.sessions.values()].find((s) => s.profileId === profileId);
  }

  getBySessionId(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  add(session: BrowserSession): void {
    if (this.getByProfileId(session.profileId)) {
      throw new Error(`Profile ${session.profileId} is already running.`);
    }
    this.sessions.set(session.sessionId, session);
  }

  update(profileId: string, patch: SessionPatch): void {
    const session = this.getByProfileId(profileId);
    if (!session) {
      throw new Error(`Session for profile ${profileId} not found.`);
    }
    Object.assign(session, patch);
  }

  remove(sessionId: string): BrowserSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.cookieSyncInterval) {
        clearInterval(session.cookieSyncInterval);
      }
      this.sessions.delete(sessionId);
    }
    return session;
  }

  list(): BrowserSession[] {
    return [...this.sessions.values()];
  }

  snapshot(): ProfileRuntimeSnapshot[] {
    return [...this.sessions.values()].map((s) => ({
      profileId: s.profileId,
      browserSessionId: s.sessionId,
      sequence: 1,
      state: s.state,
      occurredAt: new Date().toISOString(),
      startedAt: s.startedAt,
      processId: s.pid,
      engine: s.engine,
      distribution: s.distribution,
      channel: s.channel,
      browserVersion: s.browserVersion,
      architecture: s.architecture,
    }));
  }
}
