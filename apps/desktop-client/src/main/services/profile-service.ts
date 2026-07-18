import { randomUUID } from 'crypto';
import fs from 'fs';
import type {
  CreateProfileInput,
  ListProfilesInput,
  ProfileListResult,
  ProfileView,
  UpdateProfileInput,
} from '../../shared/profile-contracts.js';
import { getHostArchitecture } from '../../shared/profile-contracts.js';
import { ProfileRepository } from '../database/repositories/profile-repository.js';
import { AuditService } from './audit-service.js';
import type { BrowserApplicationService } from './browser-application-service.js';
import type { DatabaseConnectionProvider } from './database-service.js';
import { Logger } from './logger.js';
import { ProfileStorageResolver } from './profile-storage-resolver.js';

const logger = new Logger('ProfileService');

export class ProfileService {
  private readonly repository: ProfileRepository;
  private readonly storageResolver = new ProfileStorageResolver();
  private readonly audit: AuditService;

  constructor(
    db: DatabaseConnectionProvider,
    private readonly browserService: BrowserApplicationService,
  ) {
    this.repository = new ProfileRepository(db.getConnection());
    this.audit = new AuditService(db);
  }

  list(input: ListProfilesInput): ProfileListResult {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const { rows, total } = this.repository.findAll({
      search: input.search,
      os: input.os,
      status: input.status,
      limit,
      offset,
    });
    const activeByProfile = new Map(
      this.browserService.listActive().map((session) => [session.profileId, session]),
    );
    return {
      total,
      items: rows.map((row) => {
        const view = this.repository.toView(row);
        const session = activeByProfile.get(row.id);
        if (session) {
          view.status = session.state === 'starting' ? 'starting' : 'running';
        }
        return view;
      }),
    };
  }

  async create(input: CreateProfileInput): Promise<ProfileView> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const storageKey = `profile_${id}`;
    fs.mkdirSync(this.storageResolver.resolvePath(storageKey), { recursive: true });

    this.repository.insert({
      id,
      workspaceId: input.workspaceId ?? 'default_ws',
      name: input.name.trim(),
      os: input.os,
      engine: input.engine,
      distribution: input.distribution,
      channel: input.channel,
      browserVersion: input.browserVersion ?? 'latest',
      architecture: input.architecture ?? getHostArchitecture(),
      proxyId: input.proxyId || undefined,
      storageKey,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    await this.audit.record({
      action: 'profile.create',
      resourceType: 'profile',
      resourceId: id,
      metadata: {
        name: input.name,
        engine: input.engine,
        distribution: input.distribution,
        architecture: input.architecture ?? getHostArchitecture(),
      },
    });
    const record = this.repository.findById(id);
    if (!record) throw new Error('Created profile could not be loaded.');
    return this.repository.toView(record);
  }

  async update(input: UpdateProfileInput): Promise<ProfileView> {
    const existing = this.repository.findById(input.profileId);
    if (!existing) throw Object.assign(new Error('Profile not found.'), { code: 'NOT_FOUND' });
    if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
      throw Object.assign(new Error('Profile was updated by another operation.'), { code: 'VERSION_CONFLICT' });
    }

    const updatedAt = new Date().toISOString();
    this.repository.update(input.profileId, {
      name: input.name,
      proxyId: input.proxyId,
      notes: input.notes,
      updatedAt,
    });
    await this.audit.record({
      action: 'profile.update',
      resourceType: 'profile',
      resourceId: input.profileId,
      metadata: { name: input.name ?? existing.name },
    });
    const updated = this.repository.findById(input.profileId);
    if (!updated) throw new Error('Updated profile could not be loaded.');
    return this.repository.toView(updated);
  }

  async remove(profileId: string): Promise<void> {
    const existing = this.repository.findById(profileId);
    if (!existing) throw Object.assign(new Error('Profile not found.'), { code: 'NOT_FOUND' });
    if (this.browserService.getActiveForProfile(profileId)) {
      throw Object.assign(new Error('A running profile cannot be deleted.'), { code: 'PROFILE_RUNNING' });
    }

    this.repository.softDelete(profileId, new Date().toISOString());
    try {
      fs.rmSync(this.storageResolver.resolvePath(existing.storage_key), { recursive: true, force: true });
    } catch (error: unknown) {
      logger.error('Failed to delete profile storage.', error);
    }
    await this.audit.record({
      action: 'profile.delete',
      resourceType: 'profile',
      resourceId: profileId,
      metadata: { name: existing.name },
    });
  }
}
