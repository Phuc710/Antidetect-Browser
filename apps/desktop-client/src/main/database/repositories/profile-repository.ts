import type Database from 'better-sqlite3';
import type {
  ProfileView,
  BrowserEngine,
  BrowserDistribution,
  BrowserChannel,
  BrowserArchitecture,
  ProfileDeletionState,
  ProfileSyncStatus,
  NetworkSafetyPolicy,
} from '../../../shared/profile-contracts.js';

export interface ProfileCacheRow {
  id: string;
  workspace_id: string | null;
  name: string;
  os: string;
  engine: string;
  distribution: string;
  channel: string;
  browser_version: string;
  architecture: string;
  proxy_id: string | null;
  fingerprint_payload: string | null;
  fingerprint_schema_version: number | null;
  fingerprint_generator_version: string | null;
  storage_key: string;
  notes: string | null;
  sync_status: string;
  deletion_state: string;
  version: number;
  server_updated_at: string | null;
  local_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  tags: string | null;
  startup_urls: string | null;
  cookies: string | null;
  network_safety_policy: string | null;
}

export interface ListProfilesOptions {
  search?: string | undefined;
  os?: 'windows' | 'mac' | 'linux' | undefined;
  status?: string | undefined;
  limit: number;
  offset: number;
}

export class ProfileRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(options: ListProfilesOptions): { rows: ProfileCacheRow[]; total: number } {
    const conditions: string[] = ["deletion_state != 'purged'", 'deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (options.search) {
      conditions.push('(name LIKE ? OR notes LIKE ?)');
      const pattern = `%${options.search}%`;
      params.push(pattern, pattern);
    }

    if (options.os) {
      conditions.push('os = ?');
      params.push(options.os);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db
      .prepare<(string | number)[], { total: number }>(`SELECT COUNT(*) as total FROM profiles_cache ${where}`)
      .get(...params);
    const total = countRow?.total ?? 0;

    const rows = this.db
      .prepare<(string | number)[], ProfileCacheRow>(`
        SELECT * FROM profiles_cache ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, options.limit, options.offset);

    return { rows, total };
  }

  findById(id: string): ProfileCacheRow | null {
    const row = this.db
      .prepare<[string], ProfileCacheRow>("SELECT * FROM profiles_cache WHERE id = ? AND deletion_state != 'purged' AND deleted_at IS NULL")
      .get(id);
    return row || null;
  }

  insert(data: {
    id: string;
    workspaceId?: string | undefined;
    name: string;
    os: 'windows' | 'mac' | 'linux';
    engine: BrowserEngine;
    distribution: BrowserDistribution;
    channel: BrowserChannel;
    browserVersion?: string | undefined;
    architecture: BrowserArchitecture;
    proxyId?: string | undefined;
    fingerprintPayload?: string | undefined;
    fingerprintSchemaVersion?: number | undefined;
    fingerprintGeneratorVersion?: string | undefined;
    storageKey: string;
    notes?: string | undefined;
    projectId?: string | undefined;
    tags?: string[] | undefined;
    startupUrls?: string[] | undefined;
    cookies?: string | undefined;
    networkSafetyPolicy?: NetworkSafetyPolicy | undefined;
    createdAt: string;
    updatedAt: string;
  }): void {
    this.db.prepare(`
      INSERT INTO profiles_cache (
        id, workspace_id, name, os, engine, distribution, channel, browser_version, architecture, proxy_id,
        fingerprint_payload, fingerprint_schema_version, fingerprint_generator_version,
        storage_key, notes, project_id, tags, startup_urls, cookies, network_safety_policy,
        sync_status, deletion_state, version, local_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 'active', 1, ?, ?, ?)
    `).run(
      data.id,
      data.workspaceId ?? 'default_ws',
      data.name,
      data.os,
      data.engine,
      data.distribution,
      data.channel,
      data.browserVersion ?? 'latest',
      data.architecture,
      data.proxyId ?? null,
      data.fingerprintPayload ?? null,
      data.fingerprintSchemaVersion ?? null,
      data.fingerprintGeneratorVersion ?? null,
      data.storageKey,
      data.notes ?? null,
      data.projectId ?? null,
      data.tags ? JSON.stringify(data.tags) : null,
      data.startupUrls ? JSON.stringify(data.startupUrls) : null,
      data.cookies ?? null,
      data.networkSafetyPolicy ? JSON.stringify(data.networkSafetyPolicy) : null,
      data.createdAt,
      data.createdAt,
      data.updatedAt
    );
  }

  update(
    id: string,
    data: {
      name?: string | undefined;
      proxyId?: string | null | undefined;
      notes?: string | undefined;
      projectId?: string | null | undefined;
      tags?: string[] | null | undefined;
      startupUrls?: string[] | null | undefined;
      cookies?: string | null | undefined;
      networkSafetyPolicy?: NetworkSafetyPolicy | null | undefined;
      updatedAt: string;
    }
  ): boolean {
    const sets: string[] = [];
    const params: (string | null | number)[] = [];

    if (data.name !== undefined) {
      sets.push('name = ?');
      params.push(data.name);
    }

    if (data.proxyId !== undefined) {
      sets.push('proxy_id = ?');
      params.push(data.proxyId);
    }

    if (data.notes !== undefined) {
      sets.push('notes = ?');
      params.push(data.notes);
    }

    if (data.projectId !== undefined) {
      sets.push('project_id = ?');
      params.push(data.projectId);
    }

    if (data.tags !== undefined) {
      sets.push('tags = ?');
      params.push(data.tags ? JSON.stringify(data.tags) : null);
    }

    if (data.startupUrls !== undefined) {
      sets.push('startup_urls = ?');
      params.push(data.startupUrls ? JSON.stringify(data.startupUrls) : null);
    }

    if (data.cookies !== undefined) {
      sets.push('cookies = ?');
      params.push(data.cookies);
    }

    if (data.networkSafetyPolicy !== undefined) {
      sets.push('network_safety_policy = ?');
      params.push(data.networkSafetyPolicy ? JSON.stringify(data.networkSafetyPolicy) : null);
    }

    sets.push('local_updated_at = ?');
    params.push(data.updatedAt);

    sets.push('updated_at = ?');
    params.push(data.updatedAt);

    sets.push('version = version + 1');

    const result = this.db
      .prepare(`UPDATE profiles_cache SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params, id);

    return result.changes > 0;
  }

  softDelete(id: string, deletedAt: string): boolean {
    const result = this.db
      .prepare("UPDATE profiles_cache SET deleted_at = ?, sync_status = 'pending_delete', deletion_state = 'trashed' WHERE id = ?")
      .run(deletedAt, id);
    return result.changes > 0;
  }

  hardDelete(id: string): boolean {
    const result = this.db
      .prepare("UPDATE profiles_cache SET deletion_state = 'purged' WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  toView(row: ProfileCacheRow): ProfileView {
    return {
      id: row.id,
      workspaceId: row.workspace_id ?? 'default_ws',
      name: row.name,
      os: row.os as 'windows' | 'mac' | 'linux',
      engine: (row.engine as BrowserEngine) ?? 'chromium',
      distribution: (row.distribution as BrowserDistribution) ?? 'chromium',
      channel: (row.channel as BrowserChannel) ?? 'stable',
      browserVersion: row.browser_version ?? 'latest',
      architecture: row.architecture as BrowserArchitecture,
      ...(row.proxy_id ? { proxyId: row.proxy_id } : {}),
      storageKey: row.storage_key,
      syncStatus: (row.sync_status as ProfileSyncStatus) ?? 'synced',
      deletionState: (row.deletion_state as ProfileDeletionState) ?? 'active',
      version: row.version ?? 1,
      status: 'stopped',
      ...(row.notes ? { notes: row.notes } : {}),
      ...(row.project_id ? { projectId: row.project_id } : {}),
      ...(row.tags ? { tags: JSON.parse(row.tags) } : {}),
      ...(row.startup_urls ? { startupUrls: JSON.parse(row.startup_urls) } : {}),
      ...(row.cookies ? { cookieCount: countCookies(row.cookies) } : {}),
      ...(row.network_safety_policy ? { networkSafetyPolicy: parseNetworkSafetyPolicy(row.network_safety_policy) } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function countCookies(value: string): number {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length;
  } catch {
    // Netscape and Name=Value formats are line-oriented.
  }
  return value.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).length;
}

function parseNetworkSafetyPolicy(value: string): NetworkSafetyPolicy {
  const fallback: NetworkSafetyPolicy = {
    stopIfNetworkUnavailable: false,
    stopIfIpChanges: false,
    stopIfCountryChanges: false,
  };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const policy = parsed as Record<string, unknown>;
    return {
      stopIfNetworkUnavailable: policy['stopIfNetworkUnavailable'] === true,
      stopIfIpChanges: policy['stopIfIpChanges'] === true,
      stopIfCountryChanges: policy['stopIfCountryChanges'] === true,
    };
  } catch {
    return fallback;
  }
}
