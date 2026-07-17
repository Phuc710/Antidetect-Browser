import { ipcMain } from 'electron';
import { IPC_CHANNELS } from 'shared';
import type { AuthService } from '../../services/auth-service.js';
import type { LoginInput, RegisterInput, ResetPasswordInput } from 'shared';
import { Logger } from '../../services/logger.js';

const logger = new Logger('AuthIpcHandler');

export function registerAuthHandlers(authService: AuthService): void {
  ipcMain.handle(IPC_CHANNELS.AUTH.LOGIN, async (_event, input: unknown) => {
    // Validate input trước khi xử lý
    if (!isLoginInput(input)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Dữ liệu đầu vào không hợp lệ.' };
    }
    try {
      const result = await authService.login(input);
      return { ok: true, data: result };
    } catch (err: unknown) {
      const code = getErrorCode(err);
      const message = getErrorMessage(err, 'Đăng nhập thất bại. Vui lòng thử lại.');
      logger.warn(`Login failed: ${code}`);
      return { ok: false, code, message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.LOGOUT, async () => {
    try {
      await authService.logout();
      return { ok: true, data: null };
    } catch (err: unknown) {
      logger.error('Logout failed', err);
      return { ok: false, code: 'LOGOUT_ERROR', message: 'Đăng xuất thất bại.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.LOGOUT_ALL, async () => {
    try {
      await authService.logoutAll();
      return { ok: true, data: null };
    } catch (err: unknown) {
      logger.error('LogoutAll failed', err);
      return { ok: false, code: 'LOGOUT_ERROR', message: 'Đăng xuất thất bại.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.GET_ME, () => {
    return { ok: true, data: authService.getMe() };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.IS_AUTHENTICATED, () => {
    return { ok: true, data: authService.isAuthenticated() };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.FORGOT_PASSWORD, async (_event, email: unknown) => {
    if (typeof email !== 'string' || !email.includes('@')) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Email không hợp lệ.' };
    }
    try {
      await authService.forgotPassword(email);
      return { ok: true, data: null };
    } catch (err: unknown) {
      logger.warn('ForgotPassword failed');
      return { ok: false, code: 'REQUEST_FAILED', message: 'Không thể gửi email. Vui lòng thử lại.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.REGISTER, async (_event, input: unknown) => {
    if (!isRegisterInput(input)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Dữ liệu đăng ký không hợp lệ.' };
    }
    try {
      const user = await authService.register(input);
      return { ok: true, data: user };
    } catch (err: unknown) {
      const code = getErrorCode(err);
      const message = getErrorMessage(err, 'Đăng ký tài khoản thất bại.');
      logger.warn(`Register failed: ${code}`);
      return { ok: false, code, message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH.RESET_PASSWORD, async (_event, input: unknown) => {
    if (!isResetPasswordInput(input)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Dữ liệu khôi phục mật khẩu không hợp lệ.' };
    }
    try {
      await authService.resetPassword(input);
      return { ok: true, data: null };
    } catch (err: unknown) {
      const code = getErrorCode(err);
      const message = getErrorMessage(err, 'Đặt lại mật khẩu thất bại.');
      logger.warn(`ResetPassword failed: ${code}`);
      return { ok: false, code, message };
    }
  });
}

function isLoginInput(value: unknown): value is LoginInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['email'] === 'string' &&
    typeof (value as Record<string, unknown>)['password'] === 'string'
  );
}

function isRegisterInput(value: unknown): value is RegisterInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['name'] === 'string' &&
    typeof (value as Record<string, unknown>)['email'] === 'string' &&
    typeof (value as Record<string, unknown>)['password'] === 'string'
  );
}

function isResetPasswordInput(value: unknown): value is ResetPasswordInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['token'] === 'string' &&
    typeof (value as Record<string, unknown>)['password'] === 'string'
  );
}

function getErrorCode(err: unknown): string {
  if (err instanceof Error && 'code' in err) {
    return String((err as Error & { code?: string }).code ?? 'UNKNOWN_ERROR');
  }
  return 'UNKNOWN_ERROR';
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
