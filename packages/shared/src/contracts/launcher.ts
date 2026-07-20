import type { ProfileRuntimeEvent } from './profile.js';

export type LauncherErrorCode =
  | 'PROFILE_ALREADY_RUNNING'
  | 'PROFILE_LOCKED'
  | 'PROFILE_NOT_FOUND'
  | 'PROXY_RESOLUTION_FAILED'
  | 'FINGERPRINT_INVALID'
  | 'RUNTIME_NOT_FOUND'
  | 'BROWSER_LAUNCH_FAILED'
  | 'BROWSER_STOP_FAILED'
  | 'LAUNCHER_NOT_READY'
  | 'LAUNCHER_TIMEOUT'
  | 'LAUNCHER_CRASHED'
  | 'UNKNOWN_ERROR';

export interface SerializedLauncherError {
  code: LauncherErrorCode;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export type LauncherInitializePayload = {
  applicationMode: 'production' | 'development' | 'test' | 'integration_test';
  deviceId: string;
};

export interface LaunchProfilePayload {
  sessionId: string;
  profileId: string;
  userDataDir: string;
  headless: boolean;
  engine: 'chromium' | 'firefox' | 'webkit';
  distribution: 'chromium' | 'chrome' | 'edge' | 'brave' | 'firefox' | 'webkit' | 'custom';
  channel: 'stable' | 'beta' | 'dev' | 'canary' | 'custom';
  browserVersion: string;
  architecture: 'x64' | 'arm64';
  automationProtocol: 'cdp' | 'webdriver' | 'marionette';
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  } | undefined;
  cookies?: string | null | undefined;
  preparedFingerprint: {
    fingerprintWithHeaders: any;
    markerScript: string;
    readiness: any;
  };
}

export type LauncherCommand =
  | {
      type: 'launcher:initialize';
      requestId: string;
      payload: LauncherInitializePayload;
    }
  | {
      type: 'profile:launch';
      requestId: string;
      payload: LaunchProfilePayload;
    }
  | {
      type: 'profile:stop';
      requestId: string;
      payload: {
        sessionId: string;
      };
    }
  | {
      type: 'runtime:snapshot';
      requestId: string;
    }
  | {
      type: 'launcher:shutdown';
      requestId: string;
    };

export type LauncherResponse =
  | {
      type: 'command:success';
      requestId: string;
      payload?: any;
    }
  | {
      type: 'command:error';
      requestId: string;
      error: SerializedLauncherError;
    };

export type LauncherEvent =
  | {
      type: 'runtime:changed';
      payload: ProfileRuntimeEvent;
    }
  | {
      type: 'launcher:ready';
    }
  | {
      type: 'launcher:fatal';
      error: SerializedLauncherError;
    }
  | {
      type: 'session:cookies-sync';
      payload: {
        profileId: string;
        sessionId: string;
        cookies: string;
      };
    };
