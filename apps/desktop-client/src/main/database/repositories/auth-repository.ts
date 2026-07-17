import type Database from 'better-sqlite3';

export interface LocalUserCache {
  userId: string;
  email: string;
  displayName: string;
  lastAuthenticatedAt: string;
}

export class AuthRepository {
  constructor(private readonly db: Database.Database) {}

  saveAuthState(user: { id: string; email: string; name: string }): void {
    this.db.prepare(`
      INSERT INTO auth_state (singleton_id, user_id, email, display_name, last_authenticated_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(singleton_id) DO UPDATE SET
        user_id = excluded.user_id,
        email = excluded.email,
        display_name = excluded.display_name,
        last_authenticated_at = excluded.last_authenticated_at
    `).run(
      user.id,
      user.email,
      user.name,
      new Date().toISOString()
    );
  }

  clearAuthState(): void {
    this.db.prepare('DELETE FROM auth_state').run();
  }

  getAuthState(): LocalUserCache | null {
    try {
      const row = this.db.prepare<[], { user_id: string; email: string; display_name: string; last_authenticated_at: string }>(
        'SELECT user_id, email, display_name, last_authenticated_at FROM auth_state WHERE singleton_id = 1'
      ).get();

      if (!row) {
        return null;
      }

      return {
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        lastAuthenticatedAt: row.last_authenticated_at,
      };
    } catch {
      return null;
    }
  }
}
