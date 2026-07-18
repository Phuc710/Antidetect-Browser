import type Database from 'better-sqlite3';
import { MIGRATIONS, type Migration } from './migrations.js';

interface MigrationRow {
  version: number;
}

function foreignKeysEnabled(db: Database.Database): boolean {
  return Number(db.pragma('foreign_keys', { simple: true })) === 1;
}

export function runMigrations(
  db: Database.Database,
  migrations: readonly Migration[] = MIGRATIONS,
  now: () => string = () => new Date().toISOString(),
): void {
  if (db.inTransaction) throw new Error('Migrations cannot start inside an existing transaction.');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as MigrationRow[])
      .map((row) => row.version),
  );
  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;

    const wasForeignKeysEnabled = foreignKeysEnabled(db);
    if (migration.requiresForeignKeysDisabled) db.pragma('foreign_keys = OFF');

    try {
      db.transaction(() => {
        migration.up(db);
        insertMigration.run(migration.version, migration.name, now());
      })();
    } finally {
      if (migration.requiresForeignKeysDisabled) {
        db.pragma(`foreign_keys = ${wasForeignKeysEnabled ? 'ON' : 'OFF'}`);
      }
    }

    if (foreignKeysEnabled(db) !== wasForeignKeysEnabled) {
      throw new Error(`Migration ${migration.version} did not restore PRAGMA foreign_keys.`);
    }
  }
}
