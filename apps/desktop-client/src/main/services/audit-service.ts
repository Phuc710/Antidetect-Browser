import { randomUUID } from 'crypto';
import type { DatabaseConnectionProvider } from './database-service.js';
import { Logger } from './logger.js';
import { redactSecrets } from './redaction.js';

const logger = new Logger('AuditService');

export interface AuditRecord {
  action: string;
  resourceType: string;
  resourceId: string;
  actorId?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly db: DatabaseConnectionProvider) {
    db.getConnection().exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id            TEXT PRIMARY KEY,
        action        TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id   TEXT NOT NULL,
        actor_id      TEXT,
        workspace_id  TEXT,
        metadata      TEXT,
        created_at    TEXT NOT NULL
      );
    `);
  }

  async record(record: AuditRecord): Promise<void> {
    try {
      const metadata = redactSecrets(record.metadata) as Record<string, unknown> | undefined;
      this.db.getConnection().prepare(`
        INSERT INTO audit_logs (
          id, action, resource_type, resource_id, actor_id, workspace_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        record.action,
        record.resourceType,
        record.resourceId,
        record.actorId ?? null,
        record.workspaceId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString(),
      );
      logger.info(`[AUDIT] ${record.action} ${record.resourceType}/${record.resourceId}`);
    } catch (error: unknown) {
      logger.error('Failed to write audit log entry.', error);
    }
  }
}
