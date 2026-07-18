import type {
  Brand,
  BrowserFingerprintWithHeaders,
  ExtraProperties,
  Fingerprint,
  NavigatorFingerprint,
  ScreenFingerprint,
  UserAgentData,
  VideoCard,
} from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import type { FingerprintEnvelope } from 'shared';
import { FingerprintPipelineError } from '../services/fingerprint-envelope-validator.js';
import type {
  BrowserRuntimeContextSeed,
  FingerprintReadinessExpectation,
} from './playwright-runtime-adapter.js';

export interface PreparedFingerprintInjection {
  readonly headers: Record<string, string>;
  readonly initScript: string;
  readonly contextSeed: BrowserRuntimeContextSeed;
  readonly readiness: FingerprintReadinessExpectation;
}

function invalid(message: string): never {
  throw new FingerprintPipelineError('FINGERPRINT_SCHEMA_UNSUPPORTED', message);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(`Fingerprint field ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') return invalid(`Fingerprint field ${field} must be a string.`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return stringValue(value, field);
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid(`Fingerprint field ${field} must be a finite number.`);
  }
  return value;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') return invalid(`Fingerprint field ${field} must be a boolean.`);
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return invalid(`Fingerprint field ${field} must be a string array.`);
  }
  return [...value];
}

function stringMap(value: unknown, field: string): Record<string, string> {
  const source = record(value, field);
  const entries: Array<[string, string]> = [];
  for (const [key, item] of Object.entries(source)) {
    entries.push([key, stringValue(item, `${field}.${key}`)]);
  }
  return Object.fromEntries(entries);
}

function brands(value: unknown, field: string): Brand[] {
  if (!Array.isArray(value)) return invalid(`Fingerprint field ${field} must be an array.`);
  return value.map((item, index) => {
    const source = record(item, `${field}[${index}]`);
    return {
      brand: stringValue(source['brand'], `${field}[${index}].brand`),
      version: stringValue(source['version'], `${field}[${index}].version`),
    };
  });
}

function userAgentData(value: unknown): UserAgentData {
  const source = record(value, 'navigator.userAgentData');
  return {
    brands: brands(source['brands'], 'navigator.userAgentData.brands'),
    mobile: booleanValue(source['mobile'], 'navigator.userAgentData.mobile'),
    platform: stringValue(source['platform'], 'navigator.userAgentData.platform'),
    architecture: stringValue(source['architecture'], 'navigator.userAgentData.architecture'),
    bitness: stringValue(source['bitness'], 'navigator.userAgentData.bitness'),
    fullVersionList: brands(source['fullVersionList'], 'navigator.userAgentData.fullVersionList'),
    model: stringValue(source['model'], 'navigator.userAgentData.model'),
    platformVersion: stringValue(source['platformVersion'], 'navigator.userAgentData.platformVersion'),
    uaFullVersion: stringValue(source['uaFullVersion'], 'navigator.userAgentData.uaFullVersion'),
  };
}

function extraProperties(value: unknown): ExtraProperties {
  const source = record(value, 'navigator.extraProperties');
  const installedApps = source['installedApps'];
  if (!Array.isArray(installedApps)) {
    return invalid('Fingerprint field navigator.extraProperties.installedApps must be an array.');
  }
  const globalPrivacyControl = source['globalPrivacyControl'];
  if (globalPrivacyControl !== null && typeof globalPrivacyControl !== 'boolean') {
    return invalid('Fingerprint field navigator.extraProperties.globalPrivacyControl is invalid.');
  }
  const bluetooth = source['isBluetoothSupported'];
  if (bluetooth !== undefined && typeof bluetooth !== 'boolean') {
    return invalid('Fingerprint field navigator.extraProperties.isBluetoothSupported is invalid.');
  }
  return {
    vendorFlavors: stringArray(source['vendorFlavors'], 'navigator.extraProperties.vendorFlavors'),
    globalPrivacyControl,
    pdfViewerEnabled: booleanValue(
      source['pdfViewerEnabled'],
      'navigator.extraProperties.pdfViewerEnabled',
    ),
    installedApps: [...installedApps],
    ...(typeof bluetooth === 'boolean' ? { isBluetoothSupported: bluetooth } : {}),
  };
}

function navigatorFingerprint(value: unknown): NavigatorFingerprint {
  const source = record(value, 'navigator');
  const deviceMemory = source['deviceMemory'];
  const maxTouchPoints = source['maxTouchPoints'];
  const webdriver = source['webdriver'];
  if (webdriver !== undefined && typeof webdriver !== 'boolean' && typeof webdriver !== 'string') {
    return invalid('Fingerprint field navigator.webdriver is invalid.');
  }
  return {
    userAgent: stringValue(source['userAgent'], 'navigator.userAgent'),
    userAgentData: userAgentData(source['userAgentData']),
    doNotTrack: nullableString(source['doNotTrack'], 'navigator.doNotTrack'),
    appCodeName: stringValue(source['appCodeName'], 'navigator.appCodeName'),
    appName: stringValue(source['appName'], 'navigator.appName'),
    appVersion: stringValue(source['appVersion'], 'navigator.appVersion'),
    oscpu: nullableString(source['oscpu'], 'navigator.oscpu'),
    webdriver: webdriver ?? false,
    language: stringValue(source['language'], 'navigator.language'),
    languages: stringArray(source['languages'], 'navigator.languages'),
    platform: stringValue(source['platform'], 'navigator.platform'),
    hardwareConcurrency: numberValue(source['hardwareConcurrency'], 'navigator.hardwareConcurrency'),
    product: stringValue(source['product'], 'navigator.product'),
    productSub: stringValue(source['productSub'], 'navigator.productSub'),
    vendor: stringValue(source['vendor'], 'navigator.vendor'),
    vendorSub: nullableString(source['vendorSub'], 'navigator.vendorSub'),
    extraProperties: extraProperties(source['extraProperties']),
    ...(deviceMemory === null || deviceMemory === undefined
      ? {}
      : { deviceMemory: numberValue(deviceMemory, 'navigator.deviceMemory') }),
    ...(maxTouchPoints === undefined
      ? {}
      : { maxTouchPoints: numberValue(maxTouchPoints, 'navigator.maxTouchPoints') }),
  };
}

function screenFingerprint(value: unknown): ScreenFingerprint {
  const source = record(value, 'screen');
  return {
    availHeight: numberValue(source['availHeight'], 'screen.availHeight'),
    availWidth: numberValue(source['availWidth'], 'screen.availWidth'),
    availTop: numberValue(source['availTop'], 'screen.availTop'),
    availLeft: numberValue(source['availLeft'], 'screen.availLeft'),
    colorDepth: numberValue(source['colorDepth'], 'screen.colorDepth'),
    height: numberValue(source['height'], 'screen.height'),
    pixelDepth: numberValue(source['pixelDepth'], 'screen.pixelDepth'),
    width: numberValue(source['width'], 'screen.width'),
    devicePixelRatio: numberValue(source['devicePixelRatio'], 'screen.devicePixelRatio'),
    pageXOffset: numberValue(source['pageXOffset'], 'screen.pageXOffset'),
    pageYOffset: numberValue(source['pageYOffset'], 'screen.pageYOffset'),
    innerHeight: numberValue(source['innerHeight'], 'screen.innerHeight'),
    outerHeight: numberValue(source['outerHeight'], 'screen.outerHeight'),
    outerWidth: numberValue(source['outerWidth'], 'screen.outerWidth'),
    innerWidth: numberValue(source['innerWidth'], 'screen.innerWidth'),
    screenX: numberValue(source['screenX'], 'screen.screenX'),
    clientWidth: numberValue(source['clientWidth'], 'screen.clientWidth'),
    clientHeight: numberValue(source['clientHeight'], 'screen.clientHeight'),
    hasHDR: booleanValue(source['hasHDR'], 'screen.hasHDR'),
  };
}

function videoCard(value: unknown): VideoCard {
  const source = record(value, 'videoCard');
  return {
    renderer: stringValue(source['renderer'], 'videoCard.renderer'),
    vendor: stringValue(source['vendor'], 'videoCard.vendor'),
  };
}

function battery(value: unknown): Record<string, string | number | boolean | null> | undefined {
  if (value === null || value === undefined) return undefined;
  const source = record(value, 'battery');
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(source)) {
    if (item !== null && typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') {
      return invalid(`Fingerprint field battery.${key} is invalid.`);
    }
    result[key] = item;
  }
  return result;
}

export function mapFingerprintEnvelope(
  envelope: FingerprintEnvelope,
  injector: FingerprintInjector = new FingerprintInjector(),
): PreparedFingerprintInjection {
  const source = record(envelope.payload.fingerprint, 'fingerprint');
  const mappedBattery = battery(source['battery']);
  const slim = source['slim'];
  if (slim !== undefined && typeof slim !== 'boolean') {
    return invalid('Fingerprint field slim must be a boolean.');
  }
  const fingerprint: Fingerprint = {
    screen: screenFingerprint(source['screen']),
    navigator: navigatorFingerprint(source['navigator']),
    videoCodecs: stringMap(source['videoCodecs'], 'videoCodecs'),
    audioCodecs: stringMap(source['audioCodecs'], 'audioCodecs'),
    pluginsData: record(source['pluginsData'], 'pluginsData'),
    videoCard: videoCard(source['videoCard']),
    multimediaDevices: record(source['multimediaDevices'], 'multimediaDevices'),
    fonts: stringArray(source['fonts'], 'fonts'),
    mockWebRTC: booleanValue(source['mockWebRTC'], 'mockWebRTC'),
    ...(mappedBattery ? { battery: mappedBattery } : {}),
    ...(typeof slim === 'boolean' ? { slim } : {}),
  };
  const mapped: BrowserFingerprintWithHeaders = {
    fingerprint,
    headers: { ...envelope.payload.headers },
  };
  const markerScript = `Object.defineProperty(window, "__fingerprintVersion", { value: ${JSON.stringify(envelope.generatorVersion)}, configurable: false, enumerable: false, writable: false });`;
  return {
    headers: injector.getInjectableHeaders(mapped.headers, 'chromium'),
    initScript: `${injector.getInjectableScript(mapped)};${markerScript}`,
    contextSeed: {
      userAgent: fingerprint.navigator.userAgent,
      viewport: {
        width: fingerprint.screen.width,
        height: fingerprint.screen.height,
      },
      deviceScaleFactor: fingerprint.screen.devicePixelRatio,
    },
    readiness: {
      userAgent: fingerprint.navigator.userAgent,
      platform: fingerprint.navigator.platform,
      language: fingerprint.navigator.language,
      screenWidth: fingerprint.screen.width,
      screenHeight: fingerprint.screen.height,
      injectedMarker: envelope.generatorVersion,
    },
  };
}
