import { ipcMain } from 'electron';
import { IPC_CHANNELS, type CreateProxyInput, type ListProxiesInput, type ProxyAuthMode, type ProxyProtocol, type ProxyStatus, type TestDraftProxyInput, type UpdateProxyInput } from 'shared';
import type { ProxyService } from '../../services/proxy-service.js';
import { Logger } from '../../services/logger.js';

const logger = new Logger('ProxyIpcHandler');
const PROTOCOLS = ['http', 'https', 'socks5'] as const satisfies readonly ProxyProtocol[];
const AUTH_MODES = ['none', 'username_password'] as const satisfies readonly ProxyAuthMode[];
const STATUSES = ['unchecked', 'checking', 'online', 'offline', 'timeout', 'authentication_error', 'configuration_error', 'pending_delete'] as const satisfies readonly ProxyStatus[];
type UnknownRecord = Record<string, unknown>;

export function registerProxyHandlers(proxyService: ProxyService): void {
  ipcMain.handle(IPC_CHANNELS.PROXY.LIST, (_event, input: unknown) => handle(
    () => isListProxiesInput(input) ? proxyService.list(input) : invalid('Invalid proxy filters.'),
    'proxy:list',
  ));
  ipcMain.handle(IPC_CHANNELS.PROXY.CREATE, (_event, input: unknown) => handle(
    () => isCreateProxyInput(input) ? proxyService.create(input) : invalid('Invalid proxy configuration.'),
    'proxy:create',
  ));
  ipcMain.handle(IPC_CHANNELS.PROXY.UPDATE, (_event, input: unknown) => handle(
    () => isUpdateProxyInput(input) ? proxyService.update(input) : invalid('Invalid proxy update.'),
    'proxy:update',
  ));
  ipcMain.handle(IPC_CHANNELS.PROXY.REMOVE, (_event, input: unknown) => handle(async () => {
    if (!isIdInput(input, 'proxyId')) return invalid('Invalid proxy ID.');
    await proxyService.remove(input.proxyId);
    return null;
  }, 'proxy:remove'));
  ipcMain.handle(IPC_CHANNELS.PROXY.TEST_DRAFT, (_event, input: unknown) => handle(
    () => isTestDraftInput(input) ? proxyService.testDraft(input) : invalid('Invalid proxy test configuration.'),
    'proxy:test-draft',
  ));
  ipcMain.handle(IPC_CHANNELS.PROXY.TEST_STORED, (_event, input: unknown) => handle(
    () => isStoredTestInput(input) ? proxyService.testStored(input.proxyId, input.testId) : invalid('Invalid stored proxy test.'),
    'proxy:test-stored',
  ));
  ipcMain.handle(IPC_CHANNELS.PROXY.CANCEL_TEST, (_event, input: unknown) => handle(() => {
    if (!isIdInput(input, 'testId')) return invalid('Invalid proxy test ID.');
    proxyService.cancelTest(input.testId);
    return null;
  }, 'proxy:cancel-test'));
}

function isCreateProxyInput(value: unknown): value is CreateProxyInput {
  if (!recordWithKeys(value, ['name', 'protocol', 'host', 'port', 'authMode', 'username', 'password'])) return false;
  return bounded(value.name, 1, 100)
    && oneOf(value.protocol, PROTOCOLS)
    && validHost(value.host)
    && validPort(value.port)
    && oneOf(value.authMode, AUTH_MODES)
    && validCredentials(value, true);
}

function isUpdateProxyInput(value: unknown): value is UpdateProxyInput {
  if (!recordWithKeys(value, ['proxyId', 'name', 'protocol', 'host', 'port', 'authMode', 'username', 'password'])) return false;
  if (!bounded(value.proxyId, 1, 128)) return false;
  if (value.name !== undefined && !bounded(value.name, 1, 100)) return false;
  if (value.protocol !== undefined && !oneOf(value.protocol, PROTOCOLS)) return false;
  if (value.host !== undefined && !validHost(value.host)) return false;
  if (value.port !== undefined && !validPort(value.port)) return false;
  if (value.authMode !== undefined && !oneOf(value.authMode, AUTH_MODES)) return false;
  if (value.username !== undefined && !bounded(value.username, 1, 512)) return false;
  if (value.password !== undefined && !bounded(value.password, 1, 4_096)) return false;
  if (value.authMode === 'username_password' && value.username === undefined && value.password !== undefined) return false;
  return true;
}

function isTestDraftInput(value: unknown): value is TestDraftProxyInput {
  if (!recordWithKeys(value, ['testId', 'protocol', 'host', 'port', 'authMode', 'username', 'password'])) return false;
  return bounded(value.testId, 1, 128)
    && oneOf(value.protocol, PROTOCOLS)
    && validHost(value.host)
    && validPort(value.port)
    && oneOf(value.authMode, AUTH_MODES)
    && validCredentials(value, true);
}

function isListProxiesInput(value: unknown): value is ListProxiesInput {
  if (!recordWithKeys(value, ['search', 'status', 'limit', 'offset'])) return false;
  return (value.search === undefined || typeof value.search === 'string' && value.search.length <= 200)
    && (value.status === undefined || oneOf(value.status, STATUSES))
    && (value.limit === undefined || Number.isSafeInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 200)
    && (value.offset === undefined || Number.isSafeInteger(value.offset) && Number(value.offset) >= 0);
}

function validCredentials(value: UnknownRecord, requirePassword: boolean): boolean {
  if (value.authMode === 'none') return value.username === undefined && value.password === undefined;
  return bounded(value.username, 1, 512)
    && (!requirePassword || bounded(value.password, 1, 4_096));
}

function validHost(value: unknown): value is string {
  return bounded(value, 1, 253) && !/[\s/@]/.test(value) && !value.includes('://');
}

function validPort(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 65_535;
}

function isStoredTestInput(value: unknown): value is { proxyId: string; testId: string } {
  return recordWithKeys(value, ['proxyId', 'testId'])
    && bounded(value.proxyId, 1, 128)
    && bounded(value.testId, 1, 128);
}

function isIdInput<K extends 'proxyId' | 'testId'>(value: unknown, key: K): value is Record<K, string> {
  return recordWithKeys(value, [key]) && bounded(value[key], 1, 128);
}

function recordWithKeys(value: unknown, keys: readonly string[]): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key));
}

function bounded(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length >= minimum && value.length <= maximum;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

class ProxyValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

function invalid(message: string): never {
  throw new ProxyValidationError(message);
}

async function handle<T>(operation: () => T | Promise<T>, name: string): Promise<
  { ok: true; data: T } | { ok: false; code: string; message: string }
> {
  try {
    return { ok: true, data: await operation() };
  } catch (error: unknown) {
    const code = error instanceof Error && 'code' in error
      ? String((error as Error & { code: unknown }).code)
      : 'PROXY_OPERATION_FAILED';
    logger.warn(`${name} failed with ${code}.`);
    return { ok: false, code, message: safeMessage(code) };
  }
}

function safeMessage(code: string): string {
  const messages: Record<string, string> = {
    VALIDATION_ERROR: 'The proxy request is invalid.',
    NOT_FOUND: 'The proxy was not found.',
    PROXY_LOCKED: 'The proxy is already being tested.',
    SECURE_STORAGE_UNAVAILABLE: 'Secure credential storage is unavailable.',
    SECURE_STORAGE_FAIL: 'The proxy credential could not be saved securely.',
    CANCELLED: 'The proxy test was cancelled.',
  };
  return messages[code] ?? 'The proxy operation failed.';
}
