import type { DatabaseConnectionProvider } from './services/database-service.js';
import { LocalApiService } from './services/local-api-service.js';
import { ProfileService } from './services/profile-service.js';
import { ProxyService } from './services/proxy-service.js';
import {
  FingerprintEnvelopeValidator,
  type ApplicationMode,
  type FingerprintPublicKeyBundle,
} from './services/fingerprint-envelope-validator.js';
import {
  createEphemeralDevelopmentSigningMaterial,
  createFingerprintProvider,
  type AuthenticatedTransportClient,
} from './services/fingerprint-provider.js';
import { PRODUCTION_FINGERPRINT_PUBLIC_KEYS } from './services/fingerprint-public-keys.js';
import type { BrowserRuntimePort } from './services/browser-runtime-port.js';
import { LauncherClient, type LauncherClientOptions } from './services/launcher-client.js';

export interface CoreDesktopRuntime {
  browserRuntime: BrowserRuntimePort;
  localApiService: LocalApiService;
  profileService: ProfileService;
  proxyService: ProxyService;
}

export interface CoreDesktopRuntimeOptions {
  applicationMode?: ApplicationMode;
  cloudFingerprintTransport?: AuthenticatedTransportClient;
  productionFingerprintPublicKeys?: FingerprintPublicKeyBundle;
  browserOptions?: Omit<
    LauncherClientOptions,
    'fingerprintProvider' | 'fingerprintValidator'
  >;
}

export function resolveApplicationMode(
  isPackaged: boolean,
  nodeEnv: string | undefined,
): ApplicationMode {
  if (isPackaged || nodeEnv === 'production') return 'production';
  if (nodeEnv === 'test') return 'test';
  return 'development';
}

/**
 * The only composition root for browser lifecycle consumers. Both Electron IPC
 * (through ProfileService/handlers) and the Local Automation API receive this
 * exact BrowserRuntimePort object.
 */
export function createCoreDesktopRuntime(
  databaseService: DatabaseConnectionProvider,
  options: CoreDesktopRuntimeOptions = {},
): CoreDesktopRuntime {
  const applicationMode = options.applicationMode
    ?? resolveApplicationMode(false, process.env['NODE_ENV']);
  const developmentSigningMaterial = applicationMode === 'production'
    ? undefined
    : createEphemeralDevelopmentSigningMaterial();
  const publicKeys = applicationMode === 'production'
    ? (options.productionFingerprintPublicKeys ?? PRODUCTION_FINGERPRINT_PUBLIC_KEYS)
    : { [developmentSigningMaterial!.keyId]: developmentSigningMaterial!.publicKey };
  const fingerprintValidator = new FingerprintEnvelopeValidator(publicKeys, applicationMode);
  const fingerprintProvider = createFingerprintProvider({
    mode: applicationMode,
    validator: fingerprintValidator,
    ...(options.cloudFingerprintTransport
      ? { cloudTransport: options.cloudFingerprintTransport }
      : {}),
    ...(developmentSigningMaterial ? { developmentSigningMaterial } : {}),
  });
  const proxyService = new ProxyService(databaseService);

  const browserRuntime = new LauncherClient(databaseService, {
    applicationMode,
    deviceId: 'local_device',
    fingerprintProvider,
    fingerprintValidator,
    resolveProxy: options.browserOptions?.resolveProxy
      ?? ((proxyId) => proxyService.resolveForLaunch(proxyId)),
    canUseOfflineFingerprintCache: options.browserOptions?.canUseOfflineFingerprintCache,
    storageResolver: options.browserOptions?.storageResolver,
    fingerprintMapper: options.browserOptions?.fingerprintMapper,
  });

  return {
    browserRuntime,
    localApiService: new LocalApiService(databaseService, browserRuntime),
    profileService: new ProfileService(databaseService, browserRuntime),
    proxyService,
  };
}
