import type Database from 'better-sqlite3';
import type {
  AutomationProtocol,
  BrowserRuntimeDescriptor,
  ProfileRuntimeEvent,
  ProfileRuntimeSnapshotEnvelope,
  ProfileRuntimeState,
} from '../../../shared/profile-contracts.js';

export interface BrowserSessionRow {
  id: string;
  profile_id: string;
  device_id: string;
  engine: BrowserRuntimeDescriptor['engine'];
  distribution: BrowserRuntimeDescriptor['distribution'];
  channel: BrowserRuntimeDescriptor['channel'];
  browser_version: string;
  architecture: BrowserRuntimeDescriptor['architecture'];
  state: ProfileRuntimeState;
  process_id: number | null;
  automation_protocol: AutomationProtocol | null;
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  stopped_at: string | null;
  last_heartbeat_at: string | null;
  exit_code: number | null;
  termination_reason: string | null;
  error_code: string | null;
  last_event_sequence: number;
}

interface SnapshotRow extends BrowserSessionRow {
  occurred_at: string;
}

export interface CreateBrowserSession extends BrowserRuntimeDescriptor {
  id: string;
  profileId: string;
  deviceId: string;
  state: ProfileRuntimeState;
  automationProtocol: AutomationProtocol;
  occurredAt: string;
}

export interface SessionTransitionUpdates {
  processId?: number;
  automationProtocol?: AutomationProtocol;
  startedAt?: string;
  readyAt?: string;
  stoppedAt?: string;
  heartbeatAt?: string;
  exitCode?: number;
  terminationReason?: string;
  errorCode?: string;
}

const TERMINAL_STATES: readonly ProfileRuntimeState[] = ['stopped', 'crashed', 'error', 'locked'];

export class BrowserSessionRepository {
  constructor(private readonly db: Database.Database) {}

  create(session: CreateBrowserSession): ProfileRuntimeEvent {
    return this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO browser_sessions (
          id, profile_id, device_id, engine, distribution, channel, browser_version,
          architecture, state, automation_protocol, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.id,
        session.profileId,
        session.deviceId,
        session.engine,
        session.distribution,
        session.channel,
        session.browserVersion,
        session.architecture,
        session.state,
        session.automationProtocol,
        session.occurredAt,
      );
      return this.appendEvent(session.id, session.profileId, session.state, session.occurredAt);
    })();
  }

  transition(
    id: string,
    state: ProfileRuntimeState,
    occurredAt: string,
    updates: SessionTransitionUpdates = {},
  ): ProfileRuntimeEvent {
    return this.db.transaction(() => {
      const current = this.findById(id);
      if (!current) throw Object.assign(new Error('Browser session not found.'), { code: 'SESSION_NOT_FOUND' });

      const event = this.appendEvent(id, current.profile_id, state, occurredAt, updates.errorCode);
      const sets = ['state = ?', 'last_event_sequence = ?'];
      const values: Array<string | number | null> = [state, event.sequence];
      const columns: Array<[keyof SessionTransitionUpdates, string]> = [
        ['processId', 'process_id'],
        ['automationProtocol', 'automation_protocol'],
        ['startedAt', 'started_at'],
        ['readyAt', 'ready_at'],
        ['stoppedAt', 'stopped_at'],
        ['heartbeatAt', 'last_heartbeat_at'],
        ['exitCode', 'exit_code'],
        ['terminationReason', 'termination_reason'],
        ['errorCode', 'error_code'],
      ];
      for (const [key, column] of columns) {
        const value = updates[key];
        if (value !== undefined) {
          sets.push(`${column} = ?`);
          values.push(value);
        }
      }
      this.db.prepare(`UPDATE browser_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
      return event;
    })();
  }

  findById(id: string): BrowserSessionRow | null {
    return this.db.prepare<[string], BrowserSessionRow>('SELECT * FROM browser_sessions WHERE id = ?').get(id) ?? null;
  }

  listActive(): BrowserSessionRow[] {
    const placeholders = TERMINAL_STATES.map(() => '?').join(', ');
    return this.db.prepare<ProfileRuntimeState[], BrowserSessionRow>(`
      SELECT * FROM browser_sessions
      WHERE state NOT IN (${placeholders})
      ORDER BY created_at ASC
    `).all(...TERMINAL_STATES);
  }

  getActiveForProfile(profileId: string): BrowserSessionRow | null {
    const placeholders = TERMINAL_STATES.map(() => '?').join(', ');
    return this.db.prepare<Array<string | ProfileRuntimeState>, BrowserSessionRow>(`
      SELECT * FROM browser_sessions
      WHERE profile_id = ? AND state NOT IN (${placeholders})
      ORDER BY created_at DESC LIMIT 1
    `).get(profileId, ...TERMINAL_STATES) ?? null;
  }

  getRuntimeSnapshot(capturedAt: string): ProfileRuntimeSnapshotEnvelope {
    return this.db.transaction(() => {
      const watermark = this.db.prepare<[], { sequence: number }>(
        'SELECT COALESCE(MAX(sequence), 0) AS sequence FROM profile_runtime_events',
      ).get()?.sequence ?? 0;
      const placeholders = TERMINAL_STATES.map(() => '?').join(', ');
      const rows = this.db.prepare<Array<ProfileRuntimeState | number>, SnapshotRow>(`
        SELECT session.*, event.occurred_at
        FROM browser_sessions AS session
        JOIN profile_runtime_events AS event ON event.sequence = session.last_event_sequence
        WHERE session.state NOT IN (${placeholders})
          AND session.last_event_sequence <= ?
        ORDER BY session.last_event_sequence ASC
      `).all(...TERMINAL_STATES, watermark);

      return {
        snapshotSequence: watermark,
        capturedAt,
        sessions: rows.map((row) => ({
          profileId: row.profile_id,
          browserSessionId: row.id,
          sequence: row.last_event_sequence,
          state: row.state,
          occurredAt: row.occurred_at,
          engine: row.engine,
          distribution: row.distribution,
          channel: row.channel,
          browserVersion: row.browser_version,
          architecture: row.architecture,
          ...(row.started_at ? { startedAt: row.started_at } : {}),
          ...(row.ready_at ? { readyAt: row.ready_at } : {}),
          ...(row.process_id !== null ? { processId: row.process_id } : {}),
          ...(row.error_code ? { errorCode: row.error_code } : {}),
        })),
      };
    })();
  }

  private appendEvent(
    sessionId: string,
    profileId: string,
    state: ProfileRuntimeState,
    occurredAt: string,
    errorCode?: string,
  ): ProfileRuntimeEvent {
    const result = this.db.prepare(`
      INSERT INTO profile_runtime_events (
        profile_id, browser_session_id, state, error_code, occurred_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(profileId, sessionId, state, errorCode ?? null, occurredAt);
    const sequence = Number(result.lastInsertRowid);
    this.db.prepare('UPDATE browser_sessions SET last_event_sequence = ? WHERE id = ?').run(sequence, sessionId);
    return {
      profileId,
      browserSessionId: sessionId,
      sequence,
      state,
      occurredAt,
      ...(errorCode ? { errorCode } : {}),
    };
  }
}
