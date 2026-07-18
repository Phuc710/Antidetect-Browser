import type Database from 'better-sqlite3';
import type { ProxyView, ProxyStatus, ProxyProtocol, ProxyAuthMode } from 'shared';

// Row shape trả về từ better-sqlite3
interface ProxyRow {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  auth_mode: string;
  username: string | null;
  credential_key: string | null;
  status: string;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
  latency_ms: number | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProxyRecord {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  authMode: ProxyAuthMode;
  username: string | undefined;
  credentialKey: string | undefined;  // keytar lookup key
  status: ProxyStatus;
  countryCode: string | undefined;
  city: string | undefined;
  timezone: string | undefined;
  latencyMs: number | undefined;
  lastCheckedAt: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProxyRecord {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  authMode: ProxyAuthMode;
  username?: string | undefined;
  credentialKey?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProxyRecord {
  name?: string | undefined;
  protocol?: ProxyProtocol | undefined;
  host?: string | undefined;
  port?: number | undefined;
  authMode?: ProxyAuthMode | undefined;
  username?: string | null | undefined;
  credentialKey?: string | null | undefined;
  updatedAt: string;
}

export interface UpdateProxyTestResult {
  status: ProxyStatus;
  countryCode?: string | undefined;
  city?: string | undefined;
  timezone?: string | undefined;
  latencyMs?: number | undefined;
  lastCheckedAt: string;
  updatedAt: string;
}

export interface ListProxiesOptions {
  search?: string | undefined;
  status?: ProxyStatus | undefined;
  limit: number;
  offset: number;
}

export class ProxyRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(options: ListProxiesOptions): { rows: ProxyRecord[]; total: number } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.search) {
      conditions.push('(name LIKE ? OR host LIKE ?)');
      const pattern = `%${options.search}%`;
      params.push(pattern, pattern);
    }

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db
      .prepare<(string | number)[], { total: number }>(`SELECT COUNT(*) as total FROM proxies ${where}`)
      .get(...params);
    const total = countRow?.total ?? 0;

    const rows = this.db
      .prepare<(string | number)[], ProxyRow>(`
        SELECT * FROM proxies ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, options.limit, options.offset);

    return { rows: rows.map(this.toRecord), total };
  }

  findById(id: string): ProxyRecord | null {
    const row = this.db
      .prepare<[string], ProxyRow>('SELECT * FROM proxies WHERE id = ?')
      .get(id);
    return row ? this.toRecord(row) : null;
  }

  insert(data: CreateProxyRecord): void {
    this.db.prepare(`
      INSERT INTO proxies (
        id, name, protocol, host, port, auth_mode, username,
        credential_key, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unchecked', ?, ?)
    `).run(
      data.id,
      data.name,
      data.protocol,
      data.host,
      data.port,
      data.authMode,
      data.username ?? null,
      data.credentialKey ?? null,
      data.createdAt,
      data.updatedAt,
    );
  }

  update(id: string, data: UpdateProxyRecord): boolean {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.name !== undefined)          { sets.push('name = ?');           params.push(data.name); }
    if (data.protocol !== undefined)      { sets.push('protocol = ?');       params.push(data.protocol); }
    if (data.host !== undefined)          { sets.push('host = ?');           params.push(data.host); }
    if (data.port !== undefined)          { sets.push('port = ?');           params.push(data.port); }
    if (data.authMode !== undefined)      { sets.push('auth_mode = ?');      params.push(data.authMode); }
    if (data.username !== undefined)      { sets.push('username = ?');       params.push(data.username); }
    if (data.credentialKey !== undefined) { sets.push('credential_key = ?'); params.push(data.credentialKey); }

    sets.push('updated_at = ?');
    params.push(data.updatedAt);

    if (sets.length === 1) return false; // Chỉ có updated_at, không có gì thay đổi

    const result = this.db
      .prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params, id);

    return result.changes > 0;
  }

  updateTestResult(id: string, data: UpdateProxyTestResult): void {
    this.db.prepare(`
      UPDATE proxies
      SET status = ?, country_code = ?, city = ?, timezone = ?,
          latency_ms = ?, last_checked_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.status,
      data.countryCode ?? null,
      data.city ?? null,
      data.timezone ?? null,
      data.latencyMs ?? null,
      data.lastCheckedAt,
      data.updatedAt,
      id,
    );
  }

  setStatus(id: string, status: ProxyStatus, updatedAt: string): void {
    this.db.prepare('UPDATE proxies SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, updatedAt, id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM proxies WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  // Mask username: "username" → "us****"
  static maskUsername(username: string | undefined): string | undefined {
    if (!username) return undefined;
    if (username.length <= 2) return '****';
    return username.slice(0, 2) + '****';
  }

  toView(record: ProxyRecord): ProxyView {
    return {
      id: record.id,
      name: record.name,
      protocol: record.protocol,
      host: record.host,
      port: record.port,
      authMode: record.authMode,
      usernameMasked: ProxyRepository.maskUsername(record.username),
      status: record.status,
      countryCode: record.countryCode,
      city: record.city,
      timezone: record.timezone,
      latencyMs: record.latencyMs,
      lastCheckedAt: record.lastCheckedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toRecord(row: ProxyRow): ProxyRecord {
    return {
      id: row.id,
      name: row.name,
      protocol: row.protocol as ProxyProtocol,
      host: row.host,
      port: row.port,
      authMode: row.auth_mode as ProxyAuthMode,
      username: row.username ?? undefined,
      credentialKey: row.credential_key ?? undefined,
      status: row.status as ProxyStatus,
      countryCode: row.country_code ?? undefined,
      city: row.city ?? undefined,
      timezone: row.timezone ?? undefined,
      latencyMs: row.latency_ms ?? undefined,
      lastCheckedAt: row.last_checked_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
