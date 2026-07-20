import type { LaunchProfilePayload } from 'shared';

import { CookieValidator, type ValidatedCookie } from '../cookies/cookie-validator.js';
import { LauncherError } from '../errors/launcher-error.js';

export interface ResolvedRuntime {
  engine: 'chromium' | 'firefox' | 'webkit';
  distribution: 'chromium' | 'chrome' | 'edge' | 'brave' | 'firefox' | 'webkit' | 'custom';
  channel: 'stable' | 'beta' | 'dev' | 'canary' | 'custom';
  browserVersion: string;
  architecture: 'x64' | 'arm64';
  userDataDir: string;
  headless: boolean;
}

export interface ResolvedProxy {
  server: string;
  username?: string;
  password?: string;
}

export interface PreparedFingerprint {
  fingerprintWithHeaders: any;
  markerScript: string;
  readiness: any;
}

export interface BrowserLaunchPlan {
  readonly identity: {
    readonly profileId: string;
    readonly sessionId: string;
  };
  readonly runtime: ResolvedRuntime;
  readonly nativeArgs: string[];
  readonly fingerprint: PreparedFingerprint;
  readonly proxy?: ResolvedProxy | undefined;
  readonly cookies: ValidatedCookie[];
}

export class LaunchPlanBuilder {
  private readonly cookieValidator = new CookieValidator();

  build(payload: LaunchProfilePayload): BrowserLaunchPlan {
    // 1. Validate payload basics (in addition to transport validator)
    if (!payload.profileId || !payload.sessionId) {
      throw LauncherError.invalidCommand('Launch payload missing identity fields.');
    }

    // 2. Parse and validate cookies
    const cookieValidation = this.cookieValidator.parse(payload.cookies);
    if (!cookieValidation.success) {
      throw LauncherError.invalidCommand(
        'Invalid cookie payload.',
        { issues: cookieValidation.issues } as any
      );
    }

    // 3. Extract and compile native CLI arguments
    const userAgent = payload.preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.navigator?.userAgent;
    const language = payload.preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.navigator?.language;
    const screenWidth = payload.preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.screen?.width;
    const screenHeight = payload.preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.screen?.height;

    const nativeArgs: string[] = [
      `--user-data-dir=${payload.userDataDir}`,
      '--disable-blink-features=AutomationControlled',
    ];

    if (userAgent) {
      nativeArgs.push(`--user-agent=${userAgent}`);
    }
    if (language) {
      nativeArgs.push(`--lang=${language}`);
    }
    if (screenWidth && screenHeight) {
      nativeArgs.push(`--window-size=${screenWidth},${screenHeight}`);
    }

    return {
      identity: {
        profileId: payload.profileId,
        sessionId: payload.sessionId,
      },
      runtime: {
        engine: payload.engine as any,
        distribution: payload.distribution,
        channel: payload.channel as any,
        browserVersion: payload.browserVersion,
        architecture: payload.architecture as any,
        userDataDir: payload.userDataDir,
        headless: payload.headless,
      },
      nativeArgs,
      fingerprint: {
        fingerprintWithHeaders: payload.preparedFingerprint.fingerprintWithHeaders,
        markerScript: payload.preparedFingerprint.markerScript,
        readiness: payload.preparedFingerprint.readiness,
      },
      proxy: payload.proxy ? {
        server: payload.proxy.server,
        ...(payload.proxy.username !== undefined ? { username: payload.proxy.username } : {}),
        ...(payload.proxy.password !== undefined ? { password: payload.proxy.password } : {}),
      } : undefined,
      cookies: cookieValidation.cookies,
    };
  }
}
