import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { runMigrations } from '../database/migration-runner.js';
import { Logger } from './logger.js';

const logger = new Logger('DatabaseService');

export class DatabaseService {
  private db: Database.Database | null = null;

  initialize(): void {
    const dbDir = join(app.getPath('userData'), 'data');
    mkdirSync(dbDir, { recursive: true });

    const dbPath = join(dbDir, 'app.db');
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');

    runMigrations(this.db);
    logger.info(`Database initialized at ${dbPath}`);
  }

  getConnection(): Database.Database {
    if (!this.db) throw new Error('Database has not been initialized.');
    return this.db;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
