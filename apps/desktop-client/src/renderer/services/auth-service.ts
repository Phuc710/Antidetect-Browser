import type { LoginInput, LoginResult, RegisterInput, User } from 'shared';
import { authRepository, type LoginOptions } from '../features/auth/auth-repository.js';
import { toastService } from './toast-service.js';

export interface RegisterResult {
  readonly success: boolean;
  readonly message: string;
  readonly user?: User;
}

/**
 * Singleton Service quản lý logic Xác thực (Authentication).
 * Đóng gói toàn bộ lệnh gọi API/IPC và thông báo Toast chuẩn OOP.
 */
export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(input: LoginInput, options?: LoginOptions): Promise<LoginResult> {
    try {
      const result = await authRepository.login(input, options ?? { rememberDevice: true });
      toastService.success(`Chào mừng trở lại, ${result.user.name || result.user.email}!`, 'Đăng nhập thành công');
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin.';
      toastService.error(message, 'Đăng nhập thất bại');
      throw error;
    }
  }

  public async register(input: RegisterInput): Promise<User> {
    try {
      // Thực thi IPC đăng ký tài khoản
      const user = await window.desktop.auth.register(input);
      toastService.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.', 'Thành công');
      return user;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đăng ký thất bại. Email có thể đã được sử dụng.';
      toastService.error(message, 'Đăng ký không thành công');
      throw error;
    }
  }

  public async forgotPassword(email: string): Promise<void> {
    try {
      await window.desktop.auth.forgotPassword(email);
      toastService.info(`Đã gửi hướng dẫn khôi phục tới ${email}`, 'Kiểm tra hòm thư');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể gửi email lúc này.';
      toastService.error(message, 'Yêu cầu thất bại');
      throw error;
    }
  }

  public async getMe(): Promise<User | null> {
    try {
      return await window.desktop.auth.getMe();
    } catch {
      return null;
    }
  }

  public async logout(): Promise<void> {
    try {
      await window.desktop.auth.logout();
      toastService.info('Đã đăng xuất khỏi workspace', 'Đã đăng xuất');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi đăng xuất.';
      toastService.error(message);
    }
  }
}

export const authService = AuthService.getInstance();
