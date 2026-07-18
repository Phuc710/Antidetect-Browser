import keytar from 'keytar';
import type { User, LoginInput, LoginResult, RegisterInput, ResetPasswordInput } from 'shared';
import type { DatabaseService } from './database-service.js';
import { Logger } from './logger.js';
import { getConfig } from '../bootstrap/config.js';
import { AuthRepository } from '../database/repositories/auth-repository.js';

const logger = new Logger('AuthService');

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ApiLoginResponse extends TokenPair {
  user: User;
}

export class AuthService {
  // Access token chỉ sống trong memory — không bao giờ ghi ra disk
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private currentUser: User | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  private get config() {
    return getConfig();
  }

  private readonly authRepo: AuthRepository;

  constructor(private readonly db: DatabaseService) {
    this.authRepo = new AuthRepository(this.db.getConnection());
  }

  // --- Login ---
  async login(input: LoginInput): Promise<LoginResult> {
    const response = await this.request<ApiLoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    await this.storeSession(response);

    logger.info(`User logged in: ${response.user.email}`);

    return {
      user: response.user,
      expiresAt: this.tokenExpiresAt!.toISOString(),
    };
  }

  // --- Logout ---
  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.request('/v1/auth/logout', {
          method: 'POST',
        }).catch(() => {
          // Kể cả khi server lỗi, vẫn xóa local
        });
      }
    } finally {
      await this.clearSession();
      logger.info('User logged out');
    }
  }

  // --- Logout all ---
  async logoutAll(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.request('/v1/auth/logout-all', { method: 'POST' }).catch(() => {});
      }
    } finally {
      await this.clearSession();
      logger.info('User logged out from all sessions');
    }
  }

  // --- Get current user ---
  getMe(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && this.tokenExpiresAt !== null
      && this.tokenExpiresAt > new Date();
  }

  // --- Register ---
  async register(input: RegisterInput): Promise<User> {
    return this.request<User>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // --- Forgot password ---
  async forgotPassword(email: string): Promise<void> {
    await this.request('/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // --- Reset password ---
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await this.request('/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // --- Khôi phục session khi app khởi động ---
  async restoreSession(): Promise<boolean> {
    const refreshToken = await keytar.getPassword(
      this.config.keychain.service,
      this.config.keychain.account
    );
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await this.refreshTokenRequest(refreshToken);
      await this.storeSession(response);
      logger.info('Session restored successfully');
      return true;
    } catch {
      logger.warn('Session restore failed, clearing credentials');
      await this.clearSession();
      return false;
    }
  }

  // --- Lấy access token (tự động refresh nếu sắp hết hạn) ---
  async getAccessToken(): Promise<string> {
    if (!this.accessToken || !this.tokenExpiresAt) {
      throw new Error('Không có phiên đăng nhập.');
    }

    const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
    if (this.tokenExpiresAt <= twoMinutesFromNow) {
      await this.refreshAccessToken();
    }

    return this.accessToken!;
  }

  // --- Private helpers ---

  private async storeSession(response: ApiLoginResponse | (TokenPair & { user: User })): Promise<void> {
    this.accessToken = response.accessToken;
    this.currentUser = response.user;
    this.tokenExpiresAt = new Date(Date.now() + response.expiresIn * 1000);

    // Lưu refresh token vào OS Credential Store
    await keytar.setPassword(
      this.config.keychain.service,
      this.config.keychain.account,
      response.refreshToken
    );

    // Cache user trong SQLite auth_state
    this.authRepo.saveAuthState({
      id: response.user.id,
      email: response.user.email,
      name: response.user.name,
    });

    // Set auto-refresh timer (refresh khi còn 2 phút)
    this.scheduleRefresh(response.expiresIn);
  }

  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.currentUser = null;
    this.tokenExpiresAt = null;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    await keytar.deletePassword(
      this.config.keychain.service,
      this.config.keychain.account
    );

    // Xóa cache auth trong SQLite
    this.authRepo.clearAuthState();
  }

  private scheduleRefresh(expiresIn: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh khi còn 2 phút
    const delay = Math.max((expiresIn - 120) * 1000, 0);
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch((err: unknown) => {
        logger.error('Auto-refresh failed', err);
      });
    }, delay);
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = await keytar.getPassword(
      this.config.keychain.service,
      this.config.keychain.account
    );
    if (!refreshToken) {
      throw new Error('Không tìm thấy refresh token.');
    }

    const response = await this.refreshTokenRequest(refreshToken);
    await this.storeSession({ ...response, user: this.currentUser! });
  }

  private async refreshTokenRequest(refreshToken: string): Promise<TokenPair & { user: User }> {
    return this.request<TokenPair & { user: User }>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.config.cloudApiUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { code?: string; message?: string };
      const err = new Error(body.message ?? 'Lỗi không xác định');
      (err as Error & { code?: string | undefined }).code = body.code;
      throw err;
    }

    return response.json() as Promise<T>;
  }
}
