import type Database from 'better-sqlite3';
import type {
  BrowserArchitecture,
  BrowserChannel,
  BrowserDistribution,
  BrowserEngine,
} from '../../shared/profile-contracts.js';
import { PROFILE_RUNTIME_STATES } from '../../shared/profile-contracts.js';

const PROFILE_RUNTIME_STATES_SQL = PROFILE_RUNTIME_STATES.map((state) => `'${state}'`).join(', ');

export interface Migration {
  version: number;
  name: string;
  requiresForeignKeysDisabled?: boolean;
  up: (db: Database.Database) => void;
}

export interface ForeignKeyViolation {
  table: string;
  rowid: number | null;
  parent: string;
  fkid: number;
}

export class MigrationIntegrityError extends Error {
  constructor(public readonly violations: ForeignKeyViolation[]) {
    super(`Foreign key violations detected during migration (${violations.length})`);
    this.name = 'MigrationIntegrityError';
  }
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function columnsFor(db: Database.Database, table: string): Set<string> {
  if (!tableExists(db, table)) return new Set();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function text(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function timestamp(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 10_000_000_000 ? value * 1_000 : value).toISOString();
  }
  return fallback;
}

function storageKey(row: Record<string, unknown>, profileId: string): string {
  const candidate = text(row, 'storage_key') ?? text(row, 'user_data_dir');
  if (candidate && !candidate.includes('/') && !candidate.includes('\\')) return candidate;
  return `profile_${profileId}`;
}

function browserEngine(row: Record<string, unknown>): BrowserEngine {
  const value = text(row, 'engine') ?? text(row, 'browser');
  if (value === 'firefox') return 'firefox';
  if (value === 'webkit') return 'webkit';
  return 'chromium';
}

function browserDistribution(row: Record<string, unknown>, engine: BrowserEngine): BrowserDistribution {
  const value = text(row, 'distribution') ?? text(row, 'browser');
  if (
    value === 'chromium' || value === 'chrome' || value === 'edge' ||
    value === 'brave' || value === 'firefox' || value === 'webkit' || value === 'custom'
  ) return value;
  return engine;
}

function browserChannel(row: Record<string, unknown>): BrowserChannel {
  const value = text(row, 'channel');
  return value === 'beta' || value === 'dev' || value === 'canary' || value === 'custom'
    ? value
    : 'stable';
}

function browserArchitecture(row: Record<string, unknown>): BrowserArchitecture {
  return text(row, 'architecture') === 'arm64' ? 'arm64' : 'x64';
}

function createProxies(db: Database.Database): void {
  db.exec(`
    CREATE TABLE proxies (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      protocol        TEXT NOT NULL CHECK (protocol IN ('http', 'https', 'socks4', 'socks5')),
      host            TEXT NOT NULL,
      port            INTEGER NOT NULL,
      auth_mode       TEXT NOT NULL DEFAULT 'none' CHECK (auth_mode IN ('none', 'username_password')),
      username        TEXT,
      credential_key  TEXT,
      status          TEXT NOT NULL DEFAULT 'unchecked',
      country_code    TEXT,
      city            TEXT,
      timezone        TEXT,
      latency_ms      INTEGER,
      last_checked_at TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
  `);
}

function migrateProxies(db: Database.Database): boolean {
  if (!tableExists(db, 'proxies')) {
    createProxies(db);
    return false;
  }

  db.exec('ALTER TABLE proxies RENAME TO proxies_v2_migration;');
  createProxies(db);
  const now = new Date().toISOString();
  const rows = db.prepare('SELECT * FROM proxies_v2_migration').all() as Array<Record<string, unknown>>;
  const insert = db.prepare(`
    INSERT INTO proxies (
      id, name, protocol, host, port, auth_mode, username, credential_key, status,
      country_code, city, timezone, latency_ms, last_checked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of rows) {
    const id = text(row, 'id');
    const host = text(row, 'host');
    const port = row['port'];
    if (!id || !host || typeof port !== 'number') continue;
    const protocol = text(row, 'protocol');
    const legacyStatus = text(row, 'status');
    const status = legacyStatus === 'active' ? 'online'
      : legacyStatus === 'error' ? 'offline'
      : legacyStatus === 'untested' ? 'unchecked'
      : legacyStatus ?? 'unchecked';
    insert.run(
      id,
      text(row, 'name') ?? id,
      protocol === 'https' || protocol === 'socks4' || protocol === 'socks5' ? protocol : 'http',
      host,
      port,
      text(row, 'auth_mode') === 'username_password' ? 'username_password' : 'none',
      text(row, 'username') ?? null,
      text(row, 'credential_key') ?? null,
      status,
      text(row, 'country_code') ?? null,
      text(row, 'city') ?? null,
      text(row, 'timezone') ?? null,
      typeof row['latency_ms'] === 'number' ? row['latency_ms'] : null,
      text(row, 'last_checked_at') ?? text(row, 'last_tested_at') ?? null,
      timestamp(row['created_at'], now),
      timestamp(row['updated_at'], now),
    );
  }
  return true;
}

function createProfilesCache(db: Database.Database): void {
  db.exec(`
    CREATE TABLE profiles_cache (
      id                            TEXT PRIMARY KEY,
      workspace_id                  TEXT NOT NULL DEFAULT 'default_ws',
      name                          TEXT NOT NULL,
      os                            TEXT NOT NULL CHECK (os IN ('windows', 'mac', 'linux')),
      engine                        TEXT NOT NULL CHECK (engine IN ('chromium', 'firefox', 'webkit')),
      distribution                  TEXT NOT NULL CHECK (distribution IN ('chromium', 'chrome', 'edge', 'brave', 'firefox', 'webkit', 'custom')),
      channel                       TEXT NOT NULL CHECK (channel IN ('stable', 'beta', 'dev', 'canary', 'custom')),
      browser_version               TEXT NOT NULL,
      architecture                  TEXT NOT NULL CHECK (architecture IN ('x64', 'arm64')),
      proxy_id                      TEXT REFERENCES proxies(id) ON DELETE SET NULL,
      fingerprint_payload           TEXT,
      fingerprint_schema_version    INTEGER,
      fingerprint_generator_version TEXT,
      storage_key                   TEXT NOT NULL,
      notes                         TEXT,
      sync_status                   TEXT NOT NULL DEFAULT 'synced' CHECK (
        sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'syncing', 'conflict', 'error')
      ),
      deletion_state                TEXT NOT NULL DEFAULT 'active' CHECK (
        deletion_state IN ('active', 'pending_delete', 'trashed', 'purge_pending', 'purged')
      ),
      version                       INTEGER NOT NULL DEFAULT 1,
      last_synced_version           INTEGER NOT NULL DEFAULT 0,
      sync_error_code               TEXT,
      sync_retry_at                 TEXT,
      server_updated_at             TEXT,
      local_updated_at              TEXT NOT NULL,
      deleted_at                    TEXT,
      created_at                    TEXT NOT NULL,
      updated_at                    TEXT NOT NULL
    );

    CREATE INDEX idx_profiles_cache_sync_status ON profiles_cache(sync_status);
    CREATE INDEX idx_profiles_cache_deletion_state ON profiles_cache(deletion_state);
    CREATE INDEX idx_profiles_cache_workspace_id ON profiles_cache(workspace_id);
  `);
}

function copyLegacyProfiles(db: Database.Database, sourceTable: string): void {
  if (!tableExists(db, sourceTable)) return;

  const now = new Date().toISOString();
  const validProxyIds = tableExists(db, 'proxies')
    ? new Set((db.prepare('SELECT id FROM proxies').all() as Array<{ id: string }>).map((row) => row.id))
    : new Set<string>();
  const rows = db.prepare(`SELECT * FROM ${sourceTable}`).all() as Array<Record<string, unknown>>;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO profiles_cache (
      id, workspace_id, name, os, engine, distribution, channel, browser_version,
      architecture, proxy_id, fingerprint_payload, fingerprint_schema_version,
      fingerprint_generator_version, storage_key, notes, sync_status, deletion_state,
      version, last_synced_version, local_updated_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    const id = text(row, 'id');
    if (!id) continue;
    const engine = browserEngine(row);
    const createdAt = timestamp(row['created_at'], now);
    const updatedAt = timestamp(row['updated_at'], createdAt);
    const proxyId = text(row, 'proxy_id');
    const os = text(row, 'os');
    insert.run(
      id,
      text(row, 'workspace_id') ?? 'default_ws',
      text(row, 'name') ?? `Profile ${id}`,
      os === 'mac' || os === 'linux' ? os : 'windows',
      engine,
      browserDistribution(row, engine),
      browserChannel(row),
      text(row, 'browser_version') ?? 'latest',
      browserArchitecture(row),
      proxyId && validProxyIds.has(proxyId) ? proxyId : null,
      text(row, 'fingerprint_payload') ?? text(row, 'fingerprint') ?? null,
      typeof row['fingerprint_schema_version'] === 'number' ? row['fingerprint_schema_version'] : null,
      text(row, 'fingerprint_generator_version') ?? null,
      storageKey(row, id),
      text(row, 'notes') ?? null,
      text(row, 'sync_status') ?? 'synced',
      text(row, 'deletion_state') ?? 'active',
      typeof row['version'] === 'number' ? row['version'] : 1,
      typeof row['last_synced_version'] === 'number' ? row['last_synced_version'] : 0,
      timestamp(row['local_updated_at'], updatedAt),
      createdAt,
      updatedAt,
    );
  }
}

function migrateProfilesAndSessions(db: Database.Database): void {
  const hadLegacyProxies = migrateProxies(db);
  const hadProfilesCache = tableExists(db, 'profiles_cache');
  if (hadProfilesCache) db.exec('ALTER TABLE profiles_cache RENAME TO profiles_cache_v2;');

  createProfilesCache(db);
  copyLegacyProfiles(db, hadProfilesCache ? 'profiles_cache_v2' : 'profiles');

  if (tableExists(db, 'profile_proxy_assignments_v2')) db.exec('DROP TABLE profile_proxy_assignments_v2;');
  if (tableExists(db, 'profile_proxy_assignments')) {
    db.exec('ALTER TABLE profile_proxy_assignments RENAME TO profile_proxy_assignments_v2;');
  }

  db.exec(`
    CREATE TABLE profile_proxy_assignments (
      profile_id  TEXT NOT NULL PRIMARY KEY REFERENCES profiles_cache(id) ON DELETE CASCADE,
      proxy_id    TEXT REFERENCES proxies(id) ON DELETE SET NULL,
      assigned_at TEXT NOT NULL
    );
  `);

  if (tableExists(db, 'profile_proxy_assignments_v2')) {
    const assignmentColumns = columnsFor(db, 'profile_proxy_assignments_v2');
    if (assignmentColumns.has('profile_id') && assignmentColumns.has('proxy_id')) {
      const assignedAt = assignmentColumns.has('assigned_at')
        ? 'COALESCE(assignment.assigned_at, CURRENT_TIMESTAMP)'
        : 'CURRENT_TIMESTAMP';
      db.exec(`
        INSERT OR IGNORE INTO profile_proxy_assignments (profile_id, proxy_id, assigned_at)
        SELECT assignment.profile_id, assignment.proxy_id, ${assignedAt}
        FROM profile_proxy_assignments_v2 AS assignment
        JOIN profiles_cache AS profile ON profile.id = assignment.profile_id
        LEFT JOIN proxies AS proxy ON proxy.id = assignment.proxy_id
        WHERE assignment.proxy_id IS NULL OR proxy.id IS NOT NULL;
      `);
    }
    db.exec('DROP TABLE profile_proxy_assignments_v2;');
  }

  db.exec(`
    CREATE TABLE browser_sessions (
      id                    TEXT PRIMARY KEY,
      profile_id            TEXT NOT NULL REFERENCES profiles_cache(id) ON DELETE CASCADE,
      device_id             TEXT NOT NULL,
      engine                TEXT NOT NULL CHECK (engine IN ('chromium', 'firefox', 'webkit')),
      distribution          TEXT NOT NULL,
      channel               TEXT NOT NULL,
      browser_version       TEXT NOT NULL,
      architecture          TEXT NOT NULL CHECK (architecture IN ('x64', 'arm64')),
      state                 TEXT NOT NULL CHECK (state IN (${PROFILE_RUNTIME_STATES_SQL})),
      process_id            INTEGER,
      automation_protocol   TEXT CHECK (automation_protocol IN ('cdp', 'webdriver', 'marionette')),
      created_at            TEXT NOT NULL,
      started_at            TEXT,
      ready_at              TEXT,
      stopped_at            TEXT,
      last_heartbeat_at     TEXT,
      exit_code             INTEGER,
      termination_reason    TEXT,
      error_code            TEXT,
      last_event_sequence   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE profile_runtime_events (
      sequence           INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id         TEXT NOT NULL REFERENCES profiles_cache(id) ON DELETE CASCADE,
      browser_session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
      state              TEXT NOT NULL CHECK (state IN (${PROFILE_RUNTIME_STATES_SQL})),
      error_code         TEXT,
      occurred_at        TEXT NOT NULL
    );

    CREATE INDEX idx_browser_sessions_profile_id ON browser_sessions(profile_id);
    CREATE INDEX idx_browser_sessions_state ON browser_sessions(state);
    CREATE INDEX idx_profile_runtime_events_session ON profile_runtime_events(browser_session_id, sequence);
  `);

  if (hadProfilesCache) db.exec('DROP TABLE profiles_cache_v2;');
  if (tableExists(db, 'profiles')) db.exec('DROP TABLE profiles;');
  if (hadLegacyProxies) db.exec('DROP TABLE proxies_v2_migration;');

  const violations = db.prepare('PRAGMA foreign_key_check').all() as ForeignKeyViolation[];
  if (violations.length > 0) throw new MigrationIntegrityError(violations);
}

function createFingerprintEnvelopeCache(db: Database.Database): void {
  db.exec(`
    CREATE TABLE fingerprint_envelopes_cache (
      profile_id               TEXT NOT NULL PRIMARY KEY
                               REFERENCES profiles_cache(id) ON DELETE CASCADE,
      fingerprint_id           TEXT NOT NULL,
      schema_version           INTEGER NOT NULL DEFAULT 2 CHECK (schema_version = 2),
      generator_version        TEXT NOT NULL,
      dataset_version          TEXT NOT NULL,
      target_engine            TEXT NOT NULL CHECK (target_engine IN ('chromium', 'firefox')),
      target_os                TEXT NOT NULL CHECK (target_os IN ('windows', 'mac', 'linux')),
      compatible_runtime_range TEXT NOT NULL,
      generated_at             TEXT NOT NULL,
      expires_at               TEXT NOT NULL,
      signature_key_id         TEXT NOT NULL,
      cloud_revision           TEXT,
      signed_envelope_json     TEXT NOT NULL,
      cached_at                TEXT NOT NULL
    );

    CREATE INDEX idx_fec_expires_at ON fingerprint_envelopes_cache(expires_at);
    CREATE INDEX idx_fec_fingerprint_id ON fingerprint_envelopes_cache(fingerprint_id);
  `);

  const violations = db.prepare('PRAGMA foreign_key_check').all() as ForeignKeyViolation[];
  if (violations.length > 0) throw new MigrationIntegrityError(violations);
}

function addProfileExtendedMetadata(db: Database.Database): void {
  const existing = new Set(
    (db.prepare('PRAGMA table_info(profiles_cache)').all() as Array<{ name: string }>).map((column) => column.name),
  );
  const columns = [
    ['project_id', 'TEXT'],
    ['tags', 'TEXT'],
    ['startup_urls', 'TEXT'],
    ['cookies', 'TEXT'],
    ['network_safety_policy', 'TEXT'],
  ] as const;

  for (const [name, type] of columns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE profiles_cache ADD COLUMN ${name} ${type}`);
  }
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: (db) => {
      db.exec(`
        CREATE TABLE auth_state (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          user_id TEXT,
          email TEXT,
          display_name TEXT,
          last_authenticated_at TEXT
        );

        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    name: 'profiles_and_proxies_v2',
    up: (db) => {
      if (!tableExists(db, 'proxies')) createProxies(db);
      db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL,
          os            TEXT NOT NULL DEFAULT 'windows',
          browser       TEXT NOT NULL DEFAULT 'chrome',
          proxy_id      TEXT,
          fingerprint   TEXT,
          status        TEXT NOT NULL DEFAULT 'stopped',
          user_data_dir TEXT NOT NULL,
          notes         TEXT,
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profile_proxy_assignments (
          profile_id  TEXT NOT NULL PRIMARY KEY,
          proxy_id    TEXT REFERENCES proxies(id) ON DELETE SET NULL,
          assigned_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 3,
    name: 'profiles_cache_and_browser_lifecycle',
    requiresForeignKeysDisabled: true,
    up: migrateProfilesAndSessions,
  },
  {
    version: 4,
    name: 'fingerprint_envelopes_cache',
    up: createFingerprintEnvelopeCache,
  },
  {
    version: 5,
    name: 'profiles_extended_metadata',
    up: addProfileExtendedMetadata,
  },
];
