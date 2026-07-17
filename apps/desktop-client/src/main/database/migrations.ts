import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up(db: Database.Database): void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: (db) => {
      // Khởi tạo bảng auth_state thay cho bảng users và sessions cũ
      db.exec(`
        CREATE TABLE auth_state (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          user_id TEXT,
          email TEXT,
          display_name TEXT,
          last_authenticated_at TEXT
        );
      `);

      // Khởi tạo bảng settings
      db.exec(`
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
];
