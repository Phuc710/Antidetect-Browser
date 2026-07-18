import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../migration-runner.js';
import { MIGRATIONS, type Migration } from '../migrations.js';
import { FingerprintEnvelopeCacheRepository } from '../repositories/fingerprint-envelope-cache-repository.js';
import { ProfileRepository } from '../repositories/profile-repository.js';
import { signedFingerprintFixture } from '../../../../test/fixtures/fingerprint/signed-fingerprint-fixture.js';

const openDatabases: Database.Database[] = [];

function database(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  openDatabases.push(db);
  return db;
}

afterEach(() => {
  for (const db of openDatabases.splice(0)) db.close();
});

describe('migration v3 upgrade', () => {
  it('preserves populated v2 profiles, proxy references, and assignments', () => {
    const db = database();
    runMigrations(db, MIGRATIONS.filter((migration) => migration.version <= 2));

    db.prepare(`
      INSERT INTO proxies (
        id, name, protocol, host, port, auth_mode, status, created_at, updated_at
      ) VALUES ('proxy-1', 'Primary', 'http', '203.0.113.1', 8080, 'none', 'online', '2026-01-01', '2026-01-02')
    `).run();
    db.prepare(`
      INSERT INTO profiles (
        id, name, os, browser, proxy_id, fingerprint, status, user_data_dir, notes, created_at, updated_at
      ) VALUES ('profile-1', 'Preserved', 'windows', 'chrome', 'proxy-1', '{"ua":"legacy"}', 'stopped', 'profile_profile-1', 'keep', '2026-01-01', '2026-01-02')
    `).run();
    db.prepare(`
      INSERT INTO profile_proxy_assignments (profile_id, proxy_id, assigned_at)
      VALUES ('profile-1', 'proxy-1', '2026-01-03')
    `).run();

    runMigrations(db);

    const profile = db.prepare(`
      SELECT id, name, engine, distribution, channel, browser_version, architecture, proxy_id,
             fingerprint_payload, storage_key, notes, created_at, updated_at
      FROM profiles_cache WHERE id = 'profile-1'
    `).get() as Record<string, unknown>;
    expect(profile).toMatchObject({
      id: 'profile-1',
      name: 'Preserved',
      engine: 'chromium',
      distribution: 'chrome',
      channel: 'stable',
      browser_version: 'latest',
      architecture: 'x64',
      proxy_id: 'proxy-1',
      fingerprint_payload: '{"ua":"legacy"}',
      storage_key: 'profile_profile-1',
      notes: 'keep',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });
    expect(db.prepare('SELECT * FROM profile_proxy_assignments').get()).toMatchObject({
      profile_id: 'profile-1',
      proxy_id: 'proxy-1',
      assigned_at: '2026-01-03',
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('upgrades the originally shipped v2 proxy shape without losing assignments', () => {
    const db = database();
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations VALUES (1, 'initial', '2026-01-01');
      INSERT INTO schema_migrations VALUES (2, 'create_proxies', '2026-01-02');

      CREATE TABLE proxies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        protocol TEXT NOT NULL CHECK (protocol IN ('http', 'https', 'socks4', 'socks5')),
        country_code TEXT,
        city TEXT,
        status TEXT NOT NULL CHECK (status IN ('untested', 'active', 'error', 'pending_delete')),
        latency_ms INTEGER,
        last_tested_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        os TEXT NOT NULL,
        browser TEXT NOT NULL,
        proxy_id TEXT,
        fingerprint TEXT,
        user_data_dir TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE profile_proxy_assignments (
        profile_id TEXT PRIMARY KEY,
        proxy_id TEXT REFERENCES proxies(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL
      );

      INSERT INTO proxies VALUES (
        'legacy-proxy', 'Legacy', '198.51.100.20', 1080, 'socks4', 'vn', 'Hanoi',
        'active', 42, '2026-01-03', 'preserve', '2026-01-01', '2026-01-03'
      );
      INSERT INTO profiles VALUES (
        'legacy-profile', 'Legacy profile', 'windows', 'firefox', 'legacy-proxy', '{}',
        'profile_legacy-profile', 'preserve', '2026-01-01', '2026-01-03'
      );
      INSERT INTO profile_proxy_assignments VALUES (
        'legacy-profile', 'legacy-proxy', '2026-01-03'
      );
    `);

    runMigrations(db);

    expect(db.prepare("SELECT * FROM proxies WHERE id = 'legacy-proxy'").get()).toMatchObject({
      protocol: 'socks4',
      status: 'online',
      auth_mode: 'none',
      country_code: 'vn',
      city: 'Hanoi',
      latency_ms: 42,
      last_checked_at: '2026-01-03',
    });
    expect(db.prepare("SELECT proxy_id FROM profiles_cache WHERE id = 'legacy-profile'").get()).toEqual({
      proxy_id: 'legacy-proxy',
    });
    expect(db.prepare('SELECT * FROM profile_proxy_assignments').get()).toMatchObject({
      profile_id: 'legacy-profile',
      proxy_id: 'legacy-proxy',
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('restores foreign_keys and rolls back a failed non-nested migration', () => {
    const db = database();
    const failing: Migration = {
      version: 99,
      name: 'failure_probe',
      requiresForeignKeysDisabled: true,
      up: (connection) => {
        connection.exec('CREATE TABLE should_rollback (id TEXT PRIMARY KEY);');
        throw new Error('expected failure');
      },
    };

    expect(() => runMigrations(db, [failing])).toThrow('expected failure');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'should_rollback'").get()).toBeUndefined();
    expect(db.prepare('SELECT * FROM schema_migrations WHERE version = 99').get()).toBeUndefined();
  });

  it('refuses to start from inside an existing transaction', () => {
    const db = database();
    expect(() => db.transaction(() => runMigrations(db))()).toThrow(
      'Migrations cannot start inside an existing transaction.',
    );
  });
});

describe('migration v4 fingerprint envelope cache', () => {
  it('upgrades v3 without mutating profile metadata and cascades cache deletion', () => {
    const db = database();
    runMigrations(db, MIGRATIONS.filter((migration) => migration.version <= 3));
    db.prepare(`
      INSERT INTO profiles_cache (
        id, workspace_id, name, os, engine, distribution, channel, browser_version,
        architecture, storage_key, sync_status, deletion_state, version,
        local_updated_at, created_at, updated_at
      ) VALUES (
        'profile-cache', 'default_ws', 'Cache owner', 'windows', 'chromium',
        'chromium', 'stable', '126.0.0', 'x64', 'profile_profile-cache', 'synced',
        'active', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      )
    `).run();
    const before = db.prepare(`
      SELECT id, name, os, engine, distribution, channel, browser_version,
             architecture, storage_key, created_at, updated_at
      FROM profiles_cache WHERE id = 'profile-cache'
    `).get();

    runMigrations(db);

    expect(db.prepare(`
      SELECT id, name, os, engine, distribution, channel, browser_version,
             architecture, storage_key, created_at, updated_at
      FROM profiles_cache WHERE id = 'profile-cache'
    `).get()).toEqual(before);
    const repository = new FingerprintEnvelopeCacheRepository(db);
    const envelope = signedFingerprintFixture();
    repository.store('profile-cache', envelope, '2026-01-01T00:30:00.000Z');
    expect(repository.find('profile-cache')).toEqual(envelope);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    db.prepare("DELETE FROM profiles_cache WHERE id = 'profile-cache'").run();
    expect(repository.find('profile-cache')).toBeUndefined();
  });
});

describe('migration v5 profile editor metadata', () => {
  it('adds editor fields without changing existing profile or proxy assignments', () => {
    const db = database();
    runMigrations(db, MIGRATIONS.filter((migration) => migration.version <= 4));
    db.prepare(`
      INSERT INTO proxies (id, name, protocol, host, port, auth_mode, status, created_at, updated_at)
      VALUES ('proxy-v5', 'V5 proxy', 'http', '203.0.113.9', 8080, 'none', 'unchecked', '2026-01-01', '2026-01-01')
    `).run();
    db.prepare(`
      INSERT INTO profiles_cache (
        id, workspace_id, name, os, engine, distribution, channel, browser_version,
        architecture, proxy_id, storage_key, sync_status, deletion_state, version,
        local_updated_at, created_at, updated_at
      ) VALUES (
        'profile-v5', 'default_ws', 'Before v5', 'windows', 'chromium', 'chromium',
        'stable', '126.0.0', 'x64', 'proxy-v5', 'profile_profile-v5', 'synced',
        'active', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      )
    `).run();

    runMigrations(db);

    const columns = db.prepare('PRAGMA table_info(profiles_cache)').all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'project_id', 'tags', 'startup_urls', 'cookies', 'network_safety_policy',
    ]));
    expect(db.prepare("SELECT name, proxy_id FROM profiles_cache WHERE id = 'profile-v5'").get()).toEqual({
      name: 'Before v5',
      proxy_id: 'proxy-v5',
    });
    const repository = new ProfileRepository(db);
    repository.update('profile-v5', {
      projectId: 'project-a',
      tags: ['ads', 'client-a'],
      startupUrls: ['https://example.com'],
      cookies: '[{"name":"session","value":"redacted","domain":"example.com"}]',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const updated = repository.findById('profile-v5');
    if (!updated) throw new Error('Expected migrated profile.');
    const view = repository.toView(updated);
    expect(view).toMatchObject({
      projectId: 'project-a',
      tags: ['ads', 'client-a'],
      startupUrls: ['https://example.com'],
      cookieCount: 1,
    });
    expect(view).not.toHaveProperty('cookies');
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
