import type { LoginInput, LoginResult } from 'shared';

export type LoginScenario =
  | 'success'
  | 'invalid_credentials'
  | 'offline'
  | 'account_locked'
  | 'license_expired'
  | 'maintenance';

export interface LoginOptions {
  readonly rememberDevice: boolean;
  readonly scenario?: LoginScenario;
}

export interface AuthRepository {
  login(input: LoginInput, options: LoginOptions): Promise<LoginResult>;
}

export class AuthRepositoryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthRepositoryError';
  }
}

class MockAuthRepository implements AuthRepository {
  async login(input: LoginInput, options: LoginOptions): Promise<LoginResult> {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 700);
    });

    const scenario = options.scenario ?? 'success';
    const errors: Partial<Record<LoginScenario, AuthRepositoryError>> = {
      invalid_credentials: new AuthRepositoryError(
        'INVALID_CREDENTIALS',
        'Email hoặc mật khẩu không chính xác.',
      ),
      offline: new AuthRepositoryError(
        'NETWORK_ERROR',
        'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng.',
      ),
      account_locked: new AuthRepositoryError(
        'ACCOUNT_LOCKED',
        'Tài khoản đã tạm khóa vì có quá nhiều lần đăng nhập thất bại.',
      ),
      license_expired: new AuthRepositoryError(
        'LICENSE_EXPIRED',
        'Gói sử dụng đã hết hạn. Bạn có thể gia hạn sau khi đăng nhập.',
      ),
      maintenance: new AuthRepositoryError(
        'SERVER_MAINTENANCE',
        'Dịch vụ đang bảo trì. Vui lòng thử lại sau ít phút.',
      ),
    };

    const scenarioError = errors[scenario];
    if (scenarioError) {
      throw scenarioError;
    }

    return {
      user: {
        id: 'prototype-user',
        email: input.email,
        name: 'Prototype User',
        createdAt: new Date().toISOString(),
      },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }
}

class DesktopAuthRepository implements AuthRepository {
  login(input: LoginInput): Promise<LoginResult> {
    return window.desktop.auth.login(input);
  }
}

export const mockAuthRepository: AuthRepository = new MockAuthRepository();
export const desktopAuthRepository: AuthRepository = new DesktopAuthRepository();

// UI prototype binding. Replace this export with desktopAuthRepository when
// authentication is ready to be connected to Electron IPC.
export const authRepository: AuthRepository = mockAuthRepository;
