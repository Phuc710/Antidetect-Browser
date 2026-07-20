import http from 'http';
import { createHash, randomBytes } from 'crypto';
import type { DatabaseConnectionProvider } from './database-service.js';
import type { BrowserRuntimePort } from './browser-runtime-port.js';
import { Logger } from './logger.js';
import { safeBrowserFailure } from './browser-error-mapper.js';

const logger = new Logger('LocalApiService');

interface RateLimiter {
    tokens: number;
    lastRefill: number;
}

export interface RequestLog {
    id: string;
    method: string;
    path: string;
    status: number;
    timestamp: string;
    error?: string;
}

export class LocalApiService {
    private server: http.Server | null = null;
    private isEnabled = false;
    private port = 50325;
    private apiKeyHash = '';
    private scopes = { launch: true, read: true, write: false };
    private logs: RequestLog[] = [];

    // Simple Token Bucket Rate Limiter per endpoint category
    private limiters = new Map<string, RateLimiter>();
    private readonly rateLimits: Record<
        string,
        { max: number; intervalMs: number }
    > = {
        status: { max: 10, intervalMs: 1000 },
        launch: { max: 2, intervalMs: 1000 },
        stop: { max: 5, intervalMs: 1000 },
        sessions: { max: 5, intervalMs: 1000 },
    };

    constructor(
        private readonly db: DatabaseConnectionProvider,
        private readonly browserService: BrowserRuntimePort,
    ) {
        this.loadConfiguration();
    }

    private loadConfiguration() {
        try {
            const connection = this.db.getConnection();

            // Load enabled state
            const enabledRow = connection
                .prepare(
                    "SELECT value FROM settings WHERE key = 'local_api_enabled'",
                )
                .get() as { value: string } | undefined;
            this.isEnabled = enabledRow?.value === 'true';

            // Load port
            const portRow = connection
                .prepare(
                    "SELECT value FROM settings WHERE key = 'local_api_port'",
                )
                .get() as { value: string } | undefined;
            this.port = portRow ? parseInt(portRow.value, 10) : 50325;

            // Load API Key hash
            const hashRow = connection
                .prepare(
                    "SELECT value FROM settings WHERE key = 'local_api_key_hash'",
                )
                .get() as { value: string } | undefined;
            this.apiKeyHash = hashRow?.value || '';

            // Load scopes
            const launchScope = connection.prepare("SELECT value FROM settings WHERE key = 'local_api_scope_launch'").get() as { value: string } | undefined;
            const readScope = connection.prepare("SELECT value FROM settings WHERE key = 'local_api_scope_read'").get() as { value: string } | undefined;
            const writeScope = connection.prepare("SELECT value FROM settings WHERE key = 'local_api_scope_write'").get() as { value: string } | undefined;

            this.scopes = {
                launch: launchScope ? launchScope.value === 'true' : true,
                read: readScope ? readScope.value === 'true' : true,
                write: writeScope ? writeScope.value === 'true' : false,
            };

            // Sinh API key mặc định nếu chưa có
            if (!this.apiKeyHash) {
                this.rotateApiKey();
            }
        } catch (err) {
            logger.error('Failed to load local API settings', err);
        }
    }

    /**
     * Sinh khóa ngẫu nhiên, lưu hash SHA-256 vào database và trả về plaintext key duy nhất một lần.
     */
    rotateApiKey(): string {
        const rawKey = `fs_${randomBytes(24).toString('hex')}`;
        const hash = createHash('sha256').update(rawKey).digest('hex');

        const connection = this.db.getConnection();
        connection
            .prepare(
                `
      INSERT INTO settings (key, value) VALUES ('local_api_key_hash', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
            )
            .run(hash);

        this.apiKeyHash = hash;
        logger.info('Rotated Local API authentication key.');
        return rawKey;
    }

    setScopes(scopes: { launch: boolean; read: boolean; write: boolean }) {
        const connection = this.db.getConnection();
        connection.prepare("INSERT INTO settings (key, value) VALUES ('local_api_scope_launch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(scopes.launch ? 'true' : 'false');
        connection.prepare("INSERT INTO settings (key, value) VALUES ('local_api_scope_read', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(scopes.read ? 'true' : 'false');
        connection.prepare("INSERT INTO settings (key, value) VALUES ('local_api_scope_write', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(scopes.write ? 'true' : 'false');
        this.scopes = { ...scopes };
        logger.info('Updated Local API security scopes configuration.');
    }

    getLogs(): RequestLog[] {
        return [...this.logs];
    }

    private addLog(log: RequestLog) {
        this.logs.unshift(log);
        if (this.logs.length > 50) {
            this.logs.pop();
        }
    }

    start(): void {
        if (!this.isEnabled) {
            logger.info('Local API is disabled by configuration.');
            return;
        }

        if (this.server) return;
        this.server = http.createServer((req, res) =>
            this.handleRequest(req, res),
        );
        this.server.listen(this.port, '127.0.0.1', () => {
            logger.info(
                `Local API Server listening on http://127.0.0.1:${this.port}`,
            );
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            logger.info('Local API Server stopped.');
        }
    }

    setEnabled(enabled: boolean): void {
        this.db
            .getConnection()
            .prepare(
                `
      INSERT INTO settings (key, value) VALUES ('local_api_enabled', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
            )
            .run(enabled ? 'true' : 'false');
        this.isEnabled = enabled;
        if (enabled) this.start();
        else this.stop();
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const path = url.pathname;
        const method = req.method;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1');
        res.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, DELETE, OPTIONS',
        );
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization',
        );

        if (method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        const logEntry: RequestLog = {
            id: randomBytes(8).toString('hex'),
            method: method || 'UNKNOWN',
            path: path || '/',
            status: 200,
            timestamp: new Date().toISOString(),
        };

        const originalWriteHead = res.writeHead;
        const originalEnd = res.end;

        res.writeHead = ((statusCode: number, ...args: any[]) => {
            logEntry.status = statusCode;
            return originalWriteHead.apply(res, [statusCode, ...args] as any);
        }) as any;

        res.end = ((...args: any[]) => {
            const errorReason = (res as any).errorReason;
            if (errorReason) {
                logEntry.error = errorReason;
            }
            this.addLog(logEntry);
            return originalEnd.apply(res, args as any);
        }) as any;

        // 1. Health check route không cần auth
        if (path === '/local/v1/status' && method === 'GET') {
            if (!this.checkRateLimit('status')) {
                return this.sendError(
                    res,
                    429,
                    'RATE_LIMIT_EXCEEDED',
                    'Quá số lượng request cho phép.',
                );
            }
            return this.handleStatus(res);
        }

        // 2. Authenticate Bearer token
        if (!this.authenticate(req)) {
            return this.sendError(
                res,
                401,
                'UNAUTHORIZED',
                'API key không hợp lệ hoặc thiếu.',
            );
        }

        // 3. Enforce API Scopes
        const isReadRequest = (path === '/local/v1/browser-sessions' && method === 'GET') ||
            (path.match(/^\/local\/v1\/browser-sessions\/([a-zA-Z0-9-]+)$/) && method === 'GET');

        const isWriteLaunchRequest = (path === '/local/v1/browser-sessions' && method === 'POST') ||
            (path.match(/^\/local\/v1\/browser-sessions\/([a-zA-Z0-9-]+)$/) && method === 'DELETE');

        if (isReadRequest && !this.scopes.read) {
            return this.sendError(
                res,
                403,
                'FORBIDDEN',
                'Quyền truy cập dữ liệu bị vô hiệu hóa (Scope: Read).',
            );
        }

        if (isWriteLaunchRequest && !this.scopes.launch) {
            return this.sendError(
                res,
                403,
                'FORBIDDEN',
                'Quyền khởi chạy/dừng trình duyệt bị vô hiệu hóa (Scope: Launch).',
            );
        }

        // 4. API Routing
        if (path === '/local/v1/browser-sessions' && method === 'GET') {
            if (!this.checkRateLimit('sessions'))
                return this.sendError(
                    res,
                    429,
                    'RATE_LIMIT_EXCEEDED',
                    'Too many requests',
                );
            return this.handleListSessions(res);
        }

        if (path === '/local/v1/browser-sessions' && method === 'POST') {
            if (!this.checkRateLimit('launch'))
                return this.sendError(
                    res,
                    429,
                    'RATE_LIMIT_EXCEEDED',
                    'Too many requests',
                );
            return this.readBody(req, res, (body) =>
                this.handleLaunch(body, res),
            );
        }

        const sessionMatch = path.match(
            /^\/local\/v1\/browser-sessions\/([a-zA-Z0-9-]+)$/,
        );
        if (sessionMatch && sessionMatch[1]) {
            const sessionId = sessionMatch[1];
            if (method === 'GET') {
                if (!this.checkRateLimit('sessions'))
                    return this.sendError(
                        res,
                        429,
                        'RATE_LIMIT_EXCEEDED',
                        'Too many requests',
                    );
                return this.handleGetSession(sessionId, res);
            }
            if (method === 'DELETE') {
                if (!this.checkRateLimit('stop'))
                    return this.sendError(
                        res,
                        429,
                        'RATE_LIMIT_EXCEEDED',
                        'Too many requests',
                    );
                return this.handleStopSession(sessionId, res);
            }
        }

        return this.sendError(res, 404, 'NOT_FOUND', 'Endpoint không tồn tại.');
    }

    private authenticate(req: http.IncomingMessage): boolean {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false;
        }
        const token = authHeader.substring(7).trim();
        const tokenHash = createHash('sha256').update(token).digest('hex');
        return tokenHash === this.apiKeyHash;
    }

    private checkRateLimit(category: string): boolean {
        const limit = this.rateLimits[category];
        if (!limit) return true;

        const now = Date.now();
        let limiter = this.limiters.get(category);

        if (!limiter) {
            limiter = { tokens: limit.max, lastRefill: now };
            this.limiters.set(category, limiter);
        }

        const elapsed = now - limiter.lastRefill;
        const refillTokens = Math.floor(elapsed / limit.intervalMs) * limit.max;

        if (refillTokens > 0) {
            limiter.tokens = Math.min(limit.max, limiter.tokens + refillTokens);
            limiter.lastRefill = now;
        }

        if (limiter.tokens > 0) {
            limiter.tokens--;
            return true;
        }

        return false;
    }

    // ────────────────────────────────────────────────────────────
    // Route Handlers
    // ────────────────────────────────────────────────────────────

    private handleStatus(res: http.ServerResponse) {
        const runningCount = this.browserService.listActive().length;

        // Bảo mật: deviceId được làm nhiễu/masked theo RFC-0026
        const responseData = {
            status: 'ready',
            version: '0.1.0',
            protocolVersion: '1.0',
            deviceId: 'device_masked_xxxxxxxx',
            services: {
                database: 'ready',
                launcher: 'ready',
                cloud: 'not_configured',
                cloudLease: 'stub_not_configured',
            },
            runningBrowserCount: runningCount,
            timestamp: new Date().toISOString(),
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
    }

    private handleListSessions(res: http.ServerResponse) {
        const sessions = this.browserService.listActive().map((s) => ({
            sessionId: s.sessionId,
            profileId: s.profileId,
            engine: s.engine,
            status: s.state,
            automation: {
                protocol: s.automation.protocol,
                endpoint:
                    s.automation.protocol === 'cdp'
                        ? s.automation.endpoint
                        : undefined,
                port:
                    s.automation.protocol === 'marionette'
                        ? (s.automation as any).port
                        : undefined,
            },
            startedAt: s.startedAt,
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: sessions }));
    }

    private handleGetSession(sessionId: string, res: http.ServerResponse) {
        const s = this.browserService.getSession(sessionId);
        if (!s) {
            return this.sendError(
                res,
                404,
                'SESSION_NOT_FOUND',
                'Session không tồn tại hoặc đã đóng.',
            );
        }

        const data = {
            sessionId: s.sessionId,
            profileId: s.profileId,
            engine: s.engine,
            status: s.state,
            automation: {
                protocol: s.automation.protocol,
                endpoint:
                    s.automation.protocol === 'cdp'
                        ? s.automation.endpoint
                        : undefined,
                port:
                    s.automation.protocol === 'marionette'
                        ? (s.automation as any).port
                        : undefined,
            },
            startedAt: s.startedAt,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data }));
    }

    private async handleLaunch(body: string, res: http.ServerResponse) {
        try {
            const payload = JSON.parse(body);
            const {
                profileId,
                automationProtocol = 'cdp',
                headless = false,
            } = payload;

            if (!profileId) {
                return this.sendError(
                    res,
                    400,
                    'BAD_REQUEST',
                    'Trường profileId là bắt buộc.',
                );
            }

            const session = await this.browserService.launch({
                profileId,
                automationProtocol,
                headless,
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    data: {
                        sessionId: session.sessionId,
                        profileId: session.profileId,
                        engine: session.engine,
                        status: session.state,
                        automation: {
                            protocol: session.automation.protocol,
                            endpoint:
                                session.automation.protocol === 'cdp'
                                    ? session.automation.endpoint
                                    : undefined,
                            port:
                                session.automation.protocol === 'marionette'
                                    ? (session.automation as any).port
                                    : undefined,
                        },
                        startedAt: session.startedAt,
                    },
                }),
            );
        } catch (err: unknown) {
            const failure = safeBrowserFailure(err);
            return this.sendError(
                res,
                failure.httpStatus,
                failure.code,
                failure.message,
            );
        }
    }

    private async handleStopSession(
        sessionId: string,
        res: http.ServerResponse,
    ) {
        const s = this.browserService.getSession(sessionId);
        if (!s) {
            return this.sendError(
                res,
                404,
                'SESSION_NOT_FOUND',
                'Session không tồn tại.',
            );
        }

        await this.browserService.stop(sessionId);
        res.writeHead(204);
        res.end();
    }

    // ────────────────────────────────────────────────────────────
    // Utility Helpers
    // ────────────────────────────────────────────────────────────

    private readBody(
        req: http.IncomingMessage,
        _res: http.ServerResponse,
        callback: (body: string) => void,
    ) {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            callback(body);
        });
    }

    private sendError(
        res: http.ServerResponse,
        status: number,
        code: string,
        message: string,
    ) {
        (res as any).errorReason = message;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code, message } }));
    }
}
