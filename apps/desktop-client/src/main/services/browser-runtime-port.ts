import type {
  AutomationProtocol,
  BrowserRuntimeDescriptor,
  ProfileRuntimeEvent,
  ProfileRuntimeSnapshotEnvelope,
  ProfileRuntimeState,
} from '../../shared/profile-contracts.js';

export type AutomationConnection =
  | { protocol: 'cdp'; endpoint: string }
  | { protocol: 'webdriver'; driverPath: string; endpoint: string }
  | { protocol: 'marionette'; driverPath: string; port: number };

export interface BrowserSession extends BrowserRuntimeDescriptor {
  sessionId: string;
  profileId: string;
  state: ProfileRuntimeState;
  /** OS process ID of the Chromium process, if available. */
  pid?: number | undefined;
  /** External automation connection details, if available. */
  automation?: AutomationConnection | undefined;
  startedAt: string;
}

export interface LaunchOptions {
  profileId: string;
  automationProtocol?: AutomationProtocol;
  headless?: boolean;
}

export interface BrowserRuntimePort {
  initialize(): Promise<void>;
  launch(options: LaunchOptions): Promise<BrowserSession>;
  stop(sessionId: string): Promise<void>;
  getRuntimeSnapshot(): ProfileRuntimeSnapshotEnvelope;
  listActive(): BrowserSession[];
  getSession(sessionId: string): BrowserSession | undefined;
  getActiveForProfile(profileId: string): BrowserSession | undefined;
  subscribe(listener: (event: ProfileRuntimeEvent) => void): () => void;
  shutdown(): Promise<void>;
}
