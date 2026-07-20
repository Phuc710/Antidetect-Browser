import type {
  LoginInput,
  LoginResult,
  RegisterInput,
  ResetPasswordInput,
  User,
} from './auth.js';
import type { ProfilesAPI } from './profile.js';
import type { ProxiesAPI } from './proxy.js';

export interface AuthAPI {
  login(input: LoginInput): Promise<LoginResult>;
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  getMe(): Promise<User | null>;
  isAuthenticated(): Promise<boolean>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
}

export interface WindowAPI {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
}

export interface LocalApiAPI {
  getConfig(): Promise<{
    enabled: boolean;
    port: number;
    scopes: {
      launch: boolean;
      read: boolean;
      write: boolean;
    };
  }>;
  setEnabled(enabled: boolean): Promise<{ enabled: boolean }>;
  rotateKey(): Promise<string>;
  setScopes(scopes: {
    launch: boolean;
    read: boolean;
    write: boolean;
  }): Promise<{
    scopes: {
      launch: boolean;
      read: boolean;
      write: boolean;
    };
  }>;
  getLogs(): Promise<Array<{
    id: string;
    method: string;
    path: string;
    status: number;
    timestamp: string;
    error?: string;
  }>>;
}

export interface DesktopAPI {
  auth: AuthAPI;
  window: WindowAPI;
  localApi: LocalApiAPI;
  profile: ProfilesAPI;
  proxy: ProxiesAPI;
}

declare global {
  interface Window {
    desktop: DesktopAPI;
  }
}
