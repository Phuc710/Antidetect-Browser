import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { Logger } from './logger.js';
import { MIGRATIONS, type Migration } from '../database/migrations.js';

const logger = new Logger('DatabaseService');

export class DatabaseService {
  private db: Database.Database | null = null;

  initialize(): void {
    const userDataPath = app.getPath('userData');
    const dbDir = join(userDataPath, 'data');
    mkdirSync(dbDir, { recursive: true });

    const dbPath = join(dbDir, 'app.db');
    this.db = new Database(dbPath);

    // Cấu hình SQLite Pragmas tối ưu theo RFC
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');

    this.runMigrations();
    logger.info(`Database initialized at ${dbPath}`);
  }

  getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database chưa được khởi tạo. Gọi initialize() trước.');
    }
    return this.db;
  }

  private runMigrations(): void {
    const db = this.getConnection();

    // Tạo bảng bootstrap migration nếu chưa có
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);

    const getApplied = db.prepare<[], { version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const applied = new Set(getApplied.all().map((r) => r.version));

    const insertMigration = db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    );

    // Chạy từng migration trong một transaction toàn vẹn
    const applyMigration = db.transaction((migration: Migration) => {
      migration.up(db);
      insertMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    });

    const pendingMigrations = MIGRATIONS.filter((m) => !applied.has(m.version))
      .sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      logger.info(`Running migration: ${migration.version}_${migration.name}`);
      try {
        applyMigration(migration);
        logger.info(`Migration applied successfully: ${migration.version}_${migration.name}`);
      } catch (err: unknown) {
        logger.error(`Migration failed at version ${migration.version}:`, err);
        throw err;
      }
    }
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
