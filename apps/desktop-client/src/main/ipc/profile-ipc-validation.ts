import type {
  CreateProfileInput,
  ListProfilesInput,
  UpdateProfileInput,
} from '../../shared/profile-contracts.js';
import {
  BROWSER_ARCHITECTURES,
  BROWSER_CHANNELS,
  BROWSER_DISTRIBUTIONS,
  BROWSER_ENGINES,
  PROFILE_RUNTIME_STATES,
} from '../../shared/profile-contracts.js';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length >= minimum && value.length <= maximum;
}

function hasOnlyKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function isStringArray(value: unknown, maximumItems: number, maximumLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems
    && value.every((item) => typeof item === 'string' && item.length <= maximumLength);
}

function isStartupUrls(value: unknown): value is string[] {
  if (!isStringArray(value, 50, 2_048)) return false;
  return value.every((item) => {
    try {
      const url = new URL(item);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function isNetworkSafetyPolicy(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['stopIfNetworkUnavailable', 'stopIfIpChanges', 'stopIfCountryChanges'])
    && typeof value['stopIfNetworkUnavailable'] === 'boolean'
    && typeof value['stopIfIpChanges'] === 'boolean'
    && typeof value['stopIfCountryChanges'] === 'boolean';
}

export function isCreateProfileInput(value: unknown): value is CreateProfileInput {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'workspaceId', 'name', 'os', 'engine', 'distribution', 'channel',
    'browserVersion', 'architecture', 'proxyId', 'notes', 'projectId', 'tags',
    'startupUrls', 'cookies', 'networkSafetyPolicy',
  ])) return false;
  return (
    (value['name'] === undefined || typeof value['name'] === 'string' && value['name'].length <= 120) &&
    isOneOf(value['os'], ['windows', 'mac', 'linux'] as const) &&
    isOneOf(value['engine'], BROWSER_ENGINES) &&
    isOneOf(value['distribution'], BROWSER_DISTRIBUTIONS) &&
    isOneOf(value['channel'], BROWSER_CHANNELS) &&
    (value['workspaceId'] === undefined || isBoundedString(value['workspaceId'], 1, 128)) &&
    (value['browserVersion'] === undefined || isBoundedString(value['browserVersion'], 1, 64)) &&
    (value['architecture'] === undefined || isOneOf(value['architecture'], BROWSER_ARCHITECTURES)) &&
    (value['proxyId'] === undefined || isBoundedString(value['proxyId'], 1, 128)) &&
    (value['notes'] === undefined || typeof value['notes'] === 'string' && value['notes'].length <= 2_000) &&
    (value['projectId'] === undefined || isBoundedString(value['projectId'], 1, 128)) &&
    (value['tags'] === undefined || isStringArray(value['tags'], 50, 64)) &&
    (value['startupUrls'] === undefined || isStartupUrls(value['startupUrls'])) &&
    (value['cookies'] === undefined || typeof value['cookies'] === 'string' && value['cookies'].length <= 1_048_576) &&
    (value['networkSafetyPolicy'] === undefined || isNetworkSafetyPolicy(value['networkSafetyPolicy']))
  );
}

export function isUpdateProfileInput(value: unknown): value is UpdateProfileInput {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'profileId', 'name', 'proxyId', 'notes', 'projectId', 'tags', 'startupUrls',
    'cookies', 'networkSafetyPolicy', 'expectedVersion',
  ])) return false;
  return (
    isBoundedString(value['profileId'], 1, 128) &&
    (value['name'] === undefined || typeof value['name'] === 'string' && value['name'].length <= 120) &&
    (value['proxyId'] === undefined || value['proxyId'] === null || isBoundedString(value['proxyId'], 1, 128)) &&
    (value['notes'] === undefined || typeof value['notes'] === 'string' && value['notes'].length <= 2_000) &&
    (value['projectId'] === undefined || value['projectId'] === null || isBoundedString(value['projectId'], 1, 128)) &&
    (value['tags'] === undefined || value['tags'] === null || isStringArray(value['tags'], 50, 64)) &&
    (value['startupUrls'] === undefined || value['startupUrls'] === null || isStartupUrls(value['startupUrls'])) &&
    (value['cookies'] === undefined || value['cookies'] === null || typeof value['cookies'] === 'string' && value['cookies'].length <= 1_048_576) &&
    (value['networkSafetyPolicy'] === undefined || value['networkSafetyPolicy'] === null || isNetworkSafetyPolicy(value['networkSafetyPolicy'])) &&
    (value['expectedVersion'] === undefined || Number.isSafeInteger(value['expectedVersion']) && Number(value['expectedVersion']) >= 1)
  );
}

export function isListProfilesInput(value: unknown): value is ListProfilesInput {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'workspaceId', 'search', 'os', 'status', 'limit', 'offset',
  ])) return false;
  return (
    (value['workspaceId'] === undefined || isBoundedString(value['workspaceId'], 1, 128)) &&
    (value['search'] === undefined || typeof value['search'] === 'string' && value['search'].length <= 200) &&
    (value['os'] === undefined || isOneOf(value['os'], ['windows', 'mac', 'linux'] as const)) &&
    (value['status'] === undefined || isOneOf(value['status'], PROFILE_RUNTIME_STATES)) &&
    (value['limit'] === undefined || Number.isSafeInteger(value['limit']) && Number(value['limit']) >= 1 && Number(value['limit']) <= 100) &&
    (value['offset'] === undefined || Number.isSafeInteger(value['offset']) && Number(value['offset']) >= 0)
  );
}

export function isProfileIdInput(value: unknown): value is { profileId: string } {
  return isRecord(value) && hasOnlyKeys(value, ['profileId']) && isBoundedString(value['profileId'], 1, 128);
}

export function isLaunchProfileInput(value: unknown): value is { profileId: string; headless?: boolean } {
  return isRecord(value) && hasOnlyKeys(value, ['profileId', 'headless']) &&
    isBoundedString(value['profileId'], 1, 128) &&
    (value['headless'] === undefined || typeof value['headless'] === 'boolean');
}

export function isSessionIdInput(value: unknown): value is { sessionId: string } {
  return isRecord(value) && hasOnlyKeys(value, ['sessionId']) && isBoundedString(value['sessionId'], 1, 128);
}
