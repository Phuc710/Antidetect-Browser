import type { LauncherCommand } from 'shared';

export interface CommandValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface CommandValidationResult {
  readonly success: boolean;
  readonly command?: LauncherCommand;
  readonly issues: CommandValidationIssue[];
}

export class CommandValidator {
  validate(message: unknown): CommandValidationResult {
    const issues: CommandValidationIssue[] = [];

    if (!message || typeof message !== 'object') {
      issues.push({ path: '', message: 'Message must be a non-null object.' });
      return { success: false, issues };
    }

    const raw = message as Record<string, unknown>;
    const type = raw['type'];
    const requestId = raw['requestId'];

    if (typeof type !== 'string') {
      issues.push({ path: 'type', message: 'Command type must be a string.' });
    }

    if (typeof requestId !== 'string') {
      issues.push({ path: 'requestId', message: 'Command requestId must be a string.' });
    }

    if (issues.length > 0) {
      return { success: false, issues };
    }

    const commandType = type as string;

    switch (commandType) {
      case 'launcher:initialize': {
        const payload = raw['payload'] as Record<string, unknown> | undefined;
        if (!payload || typeof payload !== 'object') {
          issues.push({ path: 'payload', message: 'Initialize payload must be an object.' });
        } else {
          const mode = payload['applicationMode'];
          const deviceId = payload['deviceId'];
          if (typeof mode !== 'string' || !['production', 'development', 'test', 'integration_test'].includes(mode)) {
            issues.push({ path: 'payload.applicationMode', message: 'Invalid or missing applicationMode.' });
          }
          if (typeof deviceId !== 'string' || !deviceId) {
            issues.push({ path: 'payload.deviceId', message: 'Invalid or missing deviceId.' });
          }
          const runtimesRoot = payload['runtimesRoot'];
          if (runtimesRoot !== undefined && typeof runtimesRoot !== 'string') {
            issues.push({ path: 'payload.runtimesRoot', message: 'runtimesRoot must be a string.' });
          }
          const runtimesManifest = payload['runtimesManifest'];
          if (runtimesManifest !== undefined && typeof runtimesManifest !== 'string') {
            issues.push({ path: 'payload.runtimesManifest', message: 'runtimesManifest must be a string.' });
          }
        }
        break;
      }

      case 'profile:launch': {
        const payload = raw['payload'] as Record<string, unknown> | undefined;
        if (!payload || typeof payload !== 'object') {
          issues.push({ path: 'payload', message: 'Launch payload must be an object.' });
        } else {
          const requiredStrings = [
            'sessionId',
            'profileId',
            'userDataDir',
            'engine',
            'distribution',
            'channel',
            'browserVersion',
            'architecture',
            'automationProtocol',
          ];
          for (const field of requiredStrings) {
            if (typeof payload[field] !== 'string' || !payload[field]) {
              issues.push({ path: `payload.${field}`, message: `Field ${field} is required and must be a non-empty string.` });
            }
          }
          if (typeof payload['headless'] !== 'boolean') {
            issues.push({ path: 'payload.headless', message: 'headless must be a boolean.' });
          }
          
          const prepared = payload['preparedFingerprint'] as Record<string, unknown> | undefined;
          if (!prepared || typeof prepared !== 'object') {
            issues.push({ path: 'payload.preparedFingerprint', message: 'preparedFingerprint must be an object.' });
          } else {
            if (!prepared['fingerprintWithHeaders'] || typeof prepared['fingerprintWithHeaders'] !== 'object') {
              issues.push({ path: 'payload.preparedFingerprint.fingerprintWithHeaders', message: 'fingerprintWithHeaders is required and must be an object.' });
            }
            if (typeof prepared['markerScript'] !== 'string') {
              issues.push({ path: 'payload.preparedFingerprint.markerScript', message: 'markerScript is required and must be a string.' });
            }
            if (!prepared['readiness'] || typeof prepared['readiness'] !== 'object') {
              issues.push({ path: 'payload.preparedFingerprint.readiness', message: 'readiness expectation is required and must be an object.' });
            }
          }

          // Optional fields
          const proxy = payload['proxy'] as Record<string, unknown> | undefined;
          if (proxy !== undefined && (proxy === null || typeof proxy !== 'object')) {
            issues.push({ path: 'payload.proxy', message: 'proxy must be an object if specified.' });
          } else if (proxy) {
            if (typeof proxy['server'] !== 'string' || !proxy['server']) {
              issues.push({ path: 'payload.proxy.server', message: 'proxy server endpoint must be a non-empty string.' });
            }
            if (proxy['username'] !== undefined && typeof proxy['username'] !== 'string') {
              issues.push({ path: 'payload.proxy.username', message: 'proxy username must be a string.' });
            }
            if (proxy['password'] !== undefined && typeof proxy['password'] !== 'string') {
              issues.push({ path: 'payload.proxy.password', message: 'proxy password must be a string.' });
            }
          }

          const cookies = payload['cookies'];
          if (cookies !== undefined && cookies !== null && typeof cookies !== 'string') {
            issues.push({ path: 'payload.cookies', message: 'cookies must be a JSON string if specified.' });
          }
        }
        break;
      }

      case 'profile:stop': {
        const payload = raw['payload'] as Record<string, unknown> | undefined;
        if (!payload || typeof payload !== 'object') {
          issues.push({ path: 'payload', message: 'Stop payload must be an object.' });
        } else {
          if (typeof payload['sessionId'] !== 'string' || !payload['sessionId']) {
            issues.push({ path: 'payload.sessionId', message: 'sessionId must be a non-empty string.' });
          }
        }
        break;
      }

      case 'runtime:snapshot':
      case 'launcher:shutdown':
        // No payload checks needed
        break;

      default:
        issues.push({ path: 'type', message: `Unknown command type: ${commandType}` });
    }

    return {
      success: issues.length === 0,
      command: issues.length === 0 ? (message as LauncherCommand) : undefined,
      issues,
    };
  }
}
