export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: User;
  expiresAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export type AppErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'REFRESH_TOKEN_REUSE'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';
