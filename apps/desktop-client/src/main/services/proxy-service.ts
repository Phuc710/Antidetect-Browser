import { randomUUID } from 'crypto';
import { createConnection, type Socket } from 'net';
import dns from 'dns';
import keytar from 'keytar';
import type {
  ProxyView,
  ProxyTestResult,
  CreateProxyInput,
  UpdateProxyInput,
  TestDraftProxyInput,
  ListProxiesInput,
  ProxyListResult,
  ProxyStatus,
} from 'shared';
import type { DatabaseConnectionProvider } from './database-service.js';
import { ProxyRepository } from '../database/repositories/proxy-repository.js';
import { AuditService } from './audit-service.js';
import { Logger } from './logger.js';
import type { BrowserLaunchProxy } from './browser-application-service.js';

const logger = new Logger('ProxyService');

const KEYTAR_SERVICE = 'antidetect-browser-proxy';
const TEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 64 * 1024; // 64KB

// AbortControllers map for cancelable tests
const activeAbortControllers = new Map<string, AbortController>();
const activeProxyTestLocks = new Set<string>();

/**
 * Phân loại IP để ngăn chặn SSRF triệt để theo RFC-0025.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback, Link-Local, Private, Multicast, Unspecified
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    ip === '0.0.0.0'
  ) {
    return true;
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    const firstStr = parts[0];
    const secondStr = parts[1];
    if (firstStr && secondStr) {
      const first = parseInt(firstStr, 10);
      const second = parseInt(secondStr, 10);
      if (first === 172 && second >= 16 && second <= 31) {
        return true;
      }
    }
  }

  // IPv6 checks
  const cleanIp = ip.toLowerCase().trim();
  if (
    cleanIp === '::1' ||
    cleanIp === '::' ||
    cleanIp.startsWith('fe80:') ||
    cleanIp.startsWith('fc00:') ||
    cleanIp.startsWith('fd00:')
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves host using DNS and validates for SSRF.
 */
async function resolveAndValidateIp(host: string): Promise<string> {
  const cleanHost = host.trim().toLowerCase();

  // Validate literal IP addresses before performing any network request.
  const isIp = /^[0-9a-f.:]+$/i.test(cleanHost);
  if (isIp) {
    if (isPrivateIp(cleanHost)) {
      throw new Error('SSRF_BLOCKED');
    }
    return cleanHost;
  }

  // Resolve host names and reject every private address returned by DNS.
  try {
    const addresses = await dns.promises.resolve(cleanHost, 'A').catch(() =>
      dns.promises.resolve(cleanHost, 'AAAA').catch(() =>
        dns.promises.lookup(cleanHost).then((res) => [res.address])
      )
    );

    for (const address of addresses) {
      if (isPrivateIp(address)) {
        throw new Error('SSRF_BLOCKED');
      }
    }
    const resolved = addresses[0];
    if (!resolved) {
      throw new Error('DNS_RESOLUTION_FAILED');
    }
    return resolved;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'SSRF_BLOCKED') {
      throw err;
    }
    throw new Error('DNS_RESOLUTION_FAILED');
  }
}

/**
 * Geolocation connectivity audit handler.
 */
async function runProxyTest(
  protocol: string,
  host: string,
  port: number,
  username?: string,
  password?: string,
  abortSignal?: AbortSignal,
): Promise<ProxyTestResult> {
  const checkedAt = new Date().toISOString();

  try {
    // 1. Phân giải DNS và kiểm tra SSRF trước khi connect
    const resolvedIp = await resolveAndValidateIp(host);

    // 2. TCP Reachability Test
    await new Promise<void>((resolve, reject) => {
      if (abortSignal?.aborted) return reject(new Error('CANCELLED'));

      const socket: Socket = createConnection({ host: resolvedIp, port, timeout: TEST_TIMEOUT_MS }, () => {
        socket.destroy();
        resolve();
      });

      const onAbort = () => {
        socket.destroy();
        reject(new Error('CANCELLED'));
      };

      abortSignal?.addEventListener('abort', onAbort);

      socket.on('error', (err) => {
        abortSignal?.removeEventListener('abort', onAbort);
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        abortSignal?.removeEventListener('abort', onAbort);
        reject(new Error('TIMEOUT'));
      });
    });

    // A first-party identity endpoint must be configured by deployment. Do not
    // silently send profile network data to an invented or third-party host.
    const identityUrl = process.env['FINGERPRINT_SUITE_PROXY_IDENTITY_URL'];
    if (!identityUrl) {
      return { status: 'configuration_error', checkedAt };
    }
    let target: URL;
    try {
      target = new URL(identityUrl);
      if (target.protocol !== 'https:') return { status: 'configuration_error', checkedAt };
    } catch {
      return { status: 'configuration_error', checkedAt };
    }

    // 3. HTTP Client request through the proxy agent.
    const { default: https } = await import('https');
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const { SocksProxyAgent } = await import('socks-proxy-agent');

    const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
    const proxyUrl = `${protocol === 'socks5' ? 'socks5' : 'http'}://${auth}${resolvedIp}:${port}`;

    let agent: InstanceType<typeof HttpsProxyAgent> | InstanceType<typeof SocksProxyAgent>;
    if (protocol === 'socks5') {
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      agent = new HttpsProxyAgent(proxyUrl);
    }

    const geoData = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT')), TEST_TIMEOUT_MS);

      const req = https.get(target, { agent }, (res) => {
        let body = '';
        let bytesRead = 0;

        res.on('data', (chunk: Buffer) => {
          bytesRead += chunk.length;
          if (bytesRead > MAX_RESPONSE_BYTES) {
            req.destroy();
            reject(new Error('RESPONSE_TOO_LARGE'));
            return;
          }
          body += chunk.toString();
        });

        res.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(body) as Record<string, unknown>);
          } catch {
            reject(new Error('INVALID_RESPONSE'));
          }
        });
      });

      const onAbort = () => {
        req.destroy();
        clearTimeout(timer);
        reject(new Error('CANCELLED'));
      };

      abortSignal?.addEventListener('abort', onAbort);

      req.on('error', (err) => {
        clearTimeout(timer);
        abortSignal?.removeEventListener('abort', onAbort);
        reject(err);
      });
    });

    return {
      status: 'online',
      publicIp: typeof geoData['ip'] === 'string' ? geoData['ip'] : undefined,
      countryCode: typeof geoData['countryCode'] === 'string' ? geoData['countryCode'].toLowerCase() : undefined,
      city: typeof geoData['city'] === 'string' ? geoData['city'] : undefined,
      timezone: typeof geoData['timezone'] === 'string' ? geoData['timezone'] : undefined,
      latencyMs: Date.now() - new Date(checkedAt).getTime(),
      checkedAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'CANCELLED') {
      throw err;
    }
    if (message === 'SSRF_BLOCKED') {
      return { status: 'configuration_error', publicIp: undefined, countryCode: undefined, city: undefined, timezone: undefined, latencyMs: undefined, checkedAt };
    }
    if (message === 'TIMEOUT') {
      return { status: 'timeout', publicIp: undefined, countryCode: undefined, city: undefined, timezone: undefined, latencyMs: undefined, checkedAt };
    }
    if (message.includes('407') || message.includes('authentication')) {
      return { status: 'authentication_error', publicIp: undefined, countryCode: undefined, city: undefined, timezone: undefined, latencyMs: undefined, checkedAt };
    }
    return { status: 'offline', publicIp: undefined, countryCode: undefined, city: undefined, timezone: undefined, latencyMs: undefined, checkedAt };
  }
}

export class ProxyService {
  private readonly repo: ProxyRepository;
  private readonly audit: AuditService;
  private secureStorageAvailable = true;

  constructor(private readonly db: DatabaseConnectionProvider) {
    this.repo = new ProxyRepository(this.db.getConnection());
    this.audit = new AuditService(this.db);
  }

  async initialize(): Promise<void> {
    await this.checkSecureStorage();
    this.runReconciliation();
  }

  private async checkSecureStorage(): Promise<void> {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, 'test-storage-probe', 'probe');
      await keytar.deletePassword(KEYTAR_SERVICE, 'test-storage-probe');
      this.secureStorageAvailable = true;
    } catch {
      this.secureStorageAvailable = false;
      logger.error('OS Secure storage is unavailable. Proxy credentials persistence disabled.');
    }
  }

  /**
   * Reconciliation job: cleans up pending deletes (compensation mechanism)
   */
  private runReconciliation(): void {
    const connection = this.db.getConnection();
    try {
      // Reconcile interrupted deletes across keychain and SQLite.
      const pendingDeletes = connection.prepare("SELECT id, credential_key FROM proxies WHERE status = 'pending_delete'").all() as { id: string; credential_key: string | null }[];
      for (const item of pendingDeletes) {
        if (item.credential_key && this.secureStorageAvailable) {
          keytar.deletePassword(KEYTAR_SERVICE, item.credential_key).catch(() => {});
        }
        connection.prepare('DELETE FROM proxies WHERE id = ?').run(item.id);
        logger.info(`Reconciliation cleaned up pending_delete proxy: ${item.id}`);
      }
    } catch (err) {
      logger.error('Reconciliation job failed', err);
    }
  }

  list(input: ListProxiesInput): ProxyListResult {
    const limit = Math.min(input.limit ?? 50, 200);
    const offset = input.offset ?? 0;
    const { rows, total } = this.repo.findAll({
      search: input.search,
      status: input.status,
      limit,
      offset,
    });

    return {
      items: rows.map((r) => this.repo.toView(r)),
      total,
    };
  }

  async resolveForLaunch(proxyId: string): Promise<BrowserLaunchProxy> {
    const record = this.repo.findById(proxyId);
    if (!record || record.status === 'pending_delete') {
      throw Object.assign(new Error('Configured proxy was not found.'), { code: 'PROXY_NOT_FOUND' });
    }
    const password = record.credentialKey
      ? await keytar.getPassword(KEYTAR_SERVICE, record.credentialKey)
      : null;
    if (record.authMode === 'username_password' && (!record.username || !password)) {
      throw Object.assign(new Error('Configured proxy credentials are unavailable.'), {
        code: 'PROXY_CREDENTIALS_UNAVAILABLE',
      });
    }
    return {
      server: `${record.protocol}://${record.host}:${record.port}`,
      ...(record.username ? { username: record.username } : {}),
      ...(password ? { password } : {}),
    };
  }

  async create(input: CreateProxyInput): Promise<ProxyView> {
    if (input.authMode === 'username_password' && !this.secureStorageAvailable) {
      throw Object.assign(
        new Error('OS Secure Storage không khả dụng. Không thể lưu credential bảo mật.'),
        { code: 'SECURE_STORAGE_UNAVAILABLE' }
      );
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const credentialKey = input.authMode === 'username_password' && input.password ? `proxy-${id}` : undefined;

    // SQLite First (Tombstone)
    this.repo.insert({
      id,
      name: input.name.trim(),
      protocol: input.protocol,
      host: input.host.trim().toLowerCase(),
      port: input.port,
      authMode: input.authMode,
      username: input.authMode === 'username_password' ? input.username : undefined,
      credentialKey,
      createdAt: now,
      updatedAt: now,
    });

    // Write to Keytar
    if (credentialKey && input.password) {
      try {
        await keytar.setPassword(KEYTAR_SERVICE, credentialKey, input.password);
      } catch {
        // Rollback DB insert if keychain save fails
        this.repo.delete(id);
        throw Object.assign(new Error('Lưu mật khẩu vào keychain thất bại.'), { code: 'SECURE_STORAGE_FAIL' });
      }
    }

    await this.audit.record({
      action: 'proxy.create',
      resourceType: 'proxy',
      resourceId: id,
      metadata: { name: input.name, protocol: input.protocol },
    });

    const record = this.repo.findById(id);
    if (!record) throw new Error('Không tìm thấy proxy vừa tạo.');
    return this.repo.toView(record);
  }

  async update(input: UpdateProxyInput): Promise<ProxyView> {
    const existing = this.repo.findById(input.proxyId);
    if (!existing) throw Object.assign(new Error('Proxy không tồn tại.'), { code: 'NOT_FOUND' });

    if (input.authMode === 'username_password' && !this.secureStorageAvailable) {
      throw Object.assign(
        new Error('OS Secure Storage không khả dụng. Không thể lưu credential bảo mật.'),
        { code: 'SECURE_STORAGE_UNAVAILABLE' }
      );
    }

    const now = new Date().toISOString();
    let credentialKey = existing.credentialKey;

    if (input.authMode === 'none') {
      if (existing.credentialKey) {
        await keytar.deletePassword(KEYTAR_SERVICE, existing.credentialKey).catch(() => {});
      }
      credentialKey = undefined;
    } else if (input.authMode === 'username_password' && input.password !== undefined) {
      credentialKey = existing.credentialKey ?? `proxy-${input.proxyId}`;
      try {
        await keytar.setPassword(KEYTAR_SERVICE, credentialKey, input.password);
      } catch {
        throw Object.assign(new Error('Cập nhật mật khẩu vào keychain thất bại.'), { code: 'SECURE_STORAGE_FAIL' });
      }
    }

    this.repo.update(input.proxyId, {
      name: input.name,
      protocol: input.protocol,
      host: input.host?.trim().toLowerCase(),
      port: input.port,
      authMode: input.authMode,
      username: input.authMode === 'none' ? null : input.username ?? existing.username,
      credentialKey: input.authMode === 'none' ? null : credentialKey,
      updatedAt: now,
    });

    await this.audit.record({
      action: 'proxy.update',
      resourceType: 'proxy',
      resourceId: input.proxyId,
      metadata: { name: input.name ?? existing.name },
    });

    const updated = this.repo.findById(input.proxyId);
    if (!updated) throw new Error('Không tìm thấy proxy vừa cập nhật.');
    return this.repo.toView(updated);
  }

  async remove(proxyId: string): Promise<void> {
    const existing = this.repo.findById(proxyId);
    if (!existing) throw Object.assign(new Error('Proxy không tồn tại.'), { code: 'NOT_FOUND' });

    // Đánh dấu pending_delete trước để bảo đảm không bị mồ côi
    this.repo.setStatus(proxyId, 'pending_delete' as ProxyStatus, new Date().toISOString());

    if (existing.credentialKey && this.secureStorageAvailable) {
      await keytar.deletePassword(KEYTAR_SERVICE, existing.credentialKey).catch(() => {});
    }

    this.repo.delete(proxyId);

    await this.audit.record({
      action: 'proxy.delete',
      resourceType: 'proxy',
      resourceId: proxyId,
      metadata: { name: existing.name },
    });
  }

  async testStored(proxyId: string, testId: string): Promise<ProxyTestResult> {
    if (activeProxyTestLocks.has(proxyId)) {
      throw Object.assign(new Error('Proxy này đang được kiểm tra kết nối.'), { code: 'PROXY_LOCKED' });
    }

    const record = this.repo.findById(proxyId);
    if (!record) throw Object.assign(new Error('Proxy không tồn tại.'), { code: 'NOT_FOUND' });

    activeProxyTestLocks.add(proxyId);
    const controller = new AbortController();
    activeAbortControllers.set(testId, controller);

    try {
      this.repo.setStatus(proxyId, 'checking', new Date().toISOString());

      const password = record.credentialKey
        ? await keytar.getPassword(KEYTAR_SERVICE, record.credentialKey) ?? undefined
        : undefined;

      const result = await runProxyTest(
        record.protocol,
        record.host,
        record.port,
        record.username,
        password,
        controller.signal
      );

      this.repo.updateTestResult(proxyId, {
        status: result.status,
        countryCode: result.countryCode,
        city: result.city,
        timezone: result.timezone,
        latencyMs: result.latencyMs,
        lastCheckedAt: result.checkedAt,
        updatedAt: result.checkedAt,
      });

      return result;
    } finally {
      activeProxyTestLocks.delete(proxyId);
      activeAbortControllers.delete(testId);
    }
  }

  async testDraft(input: TestDraftProxyInput): Promise<ProxyTestResult> {
    const controller = new AbortController();
    activeAbortControllers.set(input.testId, controller);
    try {
      return await runProxyTest(
        input.protocol,
        input.host,
        input.port,
        input.authMode === 'username_password' ? input.username : undefined,
        input.authMode === 'username_password' ? input.password : undefined,
        controller.signal
      );
    } finally {
      activeAbortControllers.delete(input.testId);
    }
  }

  cancelTest(testId: string): void {
    const controller = activeAbortControllers.get(testId);
    if (controller) {
      controller.abort();
      activeAbortControllers.delete(testId);
    }
  }
}
