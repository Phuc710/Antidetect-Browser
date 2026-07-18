export const PROFILE_RUNTIME_STATES = [
  'validating',
  'waiting',
  'acquiring_lock',
  'preparing',
  'starting',
  'running',
  'stopping',
  'stopped',
  'locked',
  'crashed',
  'error',
] as const;

export type ProfileRuntimeState = (typeof PROFILE_RUNTIME_STATES)[number];

export const BROWSER_ENGINES = ['chromium', 'firefox', 'webkit'] as const;
export type BrowserEngine = (typeof BROWSER_ENGINES)[number];

export const BROWSER_DISTRIBUTIONS = [
  'chromium',
  'chrome',
  'edge',
  'brave',
  'firefox',
  'webkit',
  'custom',
] as const;
export type BrowserDistribution = (typeof BROWSER_DISTRIBUTIONS)[number];

export const BROWSER_CHANNELS = ['stable', 'beta', 'dev', 'canary', 'custom'] as const;
export type BrowserChannel = (typeof BROWSER_CHANNELS)[number];

export const BROWSER_ARCHITECTURES = ['x64', 'arm64'] as const;
export type BrowserArchitecture = (typeof BROWSER_ARCHITECTURES)[number];

export type AutomationProtocol = 'cdp' | 'webdriver' | 'marionette';

export type ProfileSyncStatus =
  | 'synced'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'syncing'
  | 'conflict'
  | 'error';

export type ProfileDeletionState =
  | 'active'
  | 'pending_delete'
  | 'trashed'
  | 'purge_pending'
  | 'purged';

export interface BrowserRuntimeDescriptor {
  engine: BrowserEngine;
  distribution: BrowserDistribution;
  channel: BrowserChannel;
  browserVersion: string;
  architecture: BrowserArchitecture;
}

export interface ProfileRuntimeEvent {
  profileId: string;
  browserSessionId: string;
  sequence: number;
  state: ProfileRuntimeState;
  occurredAt: string;
  errorCode?: string;
}

export interface ProfileRuntimeSessionSnapshot extends BrowserRuntimeDescriptor {
  profileId: string;
  browserSessionId: string;
  sequence: number;
  state: ProfileRuntimeState;
  occurredAt: string;
  startedAt?: string;
  readyAt?: string;
  processId?: number;
  errorCode?: string;
}

/**
 * Atomic runtime snapshot. `snapshotSequence` is the event watermark captured
 * with `sessions`; consumers must only apply buffered events with a larger
 * sequence after hydrating the snapshot.
 */
export interface ProfileRuntimeSnapshotEnvelope {
  snapshotSequence: number;
  capturedAt: string;
  sessions: ProfileRuntimeSessionSnapshot[];
}

/** Renderer-compatible snapshot item exposed by the preload adapter. */
export type ProfileRuntimeSnapshot = ProfileRuntimeSessionSnapshot;

export interface FingerprintEnvelope {
  schemaVersion: number;
  generatorVersion: string;
  browserEngine: BrowserEngine;
  minimumKernelVersion: string;
  generatedAt: string;
  payload: Record<string, unknown>;
}

export interface ProfileView extends BrowserRuntimeDescriptor {
  id: string;
  workspaceId: string;
  name: string;
  os: 'windows' | 'mac' | 'linux';
  proxyId?: string;
  fingerprint?: string;
  storageKey: string;
  syncStatus: ProfileSyncStatus;
  deletionState: ProfileDeletionState;
  version: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  workspaceId?: string;
  name: string;
  os: 'windows' | 'mac' | 'linux';
  engine: BrowserEngine;
  distribution: BrowserDistribution;
  channel: BrowserChannel;
  browserVersion?: string;
  architecture?: BrowserArchitecture;
  proxyId?: string;
  notes?: string;
}

export interface UpdateProfileInput {
  profileId: string;
  name?: string;
  proxyId?: string | null;
  notes?: string;
  expectedVersion?: number;
}

export interface ListProfilesInput {
  workspaceId?: string;
  search?: string;
  os?: 'windows' | 'mac' | 'linux';
  status?: ProfileRuntimeState;
  limit?: number;
  offset?: number;
}

export interface ProfileListResult {
  items: ProfileView[];
  total: number;
}

export interface ProfilesAPI {
  list(input: ListProfilesInput): Promise<ProfileListResult>;
  create(input: CreateProfileInput): Promise<ProfileView>;
  update(input: UpdateProfileInput): Promise<ProfileView>;
  remove(input: { profileId: string }): Promise<void>;
  launch(input: { profileId: string; headless?: boolean }): Promise<{ sessionId: string }>;
  stop(input: { sessionId: string }): Promise<void>;
  getRuntimeSnapshot(): Promise<ProfileRuntimeSnapshot[]>;
  subscribeRuntime(listener: (event: ProfileRuntimeEvent) => void): () => void;
}

export function getHostArchitecture(): BrowserArchitecture {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}
