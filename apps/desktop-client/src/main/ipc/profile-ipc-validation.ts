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

export function isCreateProfileInput(value: unknown): value is CreateProfileInput {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'workspaceId', 'name', 'os', 'engine', 'distribution', 'channel',
    'browserVersion', 'architecture', 'proxyId', 'notes',
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
    (value['notes'] === undefined || typeof value['notes'] === 'string' && value['notes'].length <= 2_000)
  );
}

export function isUpdateProfileInput(value: unknown): value is UpdateProfileInput {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'profileId', 'name', 'proxyId', 'notes', 'expectedVersion',
  ])) return false;
  return (
    isBoundedString(value['profileId'], 1, 128) &&
    (value['name'] === undefined || isBoundedString(value['name'], 1, 120)) &&
    (value['proxyId'] === undefined || value['proxyId'] === null || isBoundedString(value['proxyId'], 1, 128)) &&
    (value['notes'] === undefined || typeof value['notes'] === 'string' && value['notes'].length <= 2_000) &&
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
