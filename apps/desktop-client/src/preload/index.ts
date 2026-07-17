import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from 'shared';
import type { DesktopAPI, LoginInput, LoginResult, User, RegisterInput, ResetPasswordInput, IpcResult } from 'shared';

// Helper: invoke IPC và unwrap IpcResult
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await ipcRenderer.invoke(channel, ...args) as IpcResult<T>;
  if (!result.ok) {
    const err = new Error(result.message);
    (err as Error & { code: string }).code = result.code;
    throw err;
  }
  return result.data;
}

const desktopAPI: DesktopAPI = {
  auth: {
    async login(input: LoginInput): Promise<LoginResult> {
      return invoke<LoginResult>(IPC_CHANNELS.AUTH.LOGIN, input);
    },

    async register(input: RegisterInput): Promise<User> {
      return invoke<User>(IPC_CHANNELS.AUTH.REGISTER, input);
    },

    async logout(): Promise<void> {
      return invoke<void>(IPC_CHANNELS.AUTH.LOGOUT);
    },

    async logoutAll(): Promise<void> {
      return invoke<void>(IPC_CHANNELS.AUTH.LOGOUT_ALL);
    },

    async getMe(): Promise<User | null> {
      return invoke<User | null>(IPC_CHANNELS.AUTH.GET_ME);
    },

    async isAuthenticated(): Promise<boolean> {
      return invoke<boolean>(IPC_CHANNELS.AUTH.IS_AUTHENTICATED);
    },

    async forgotPassword(email: string): Promise<void> {
      return invoke<void>(IPC_CHANNELS.AUTH.FORGOT_PASSWORD, email);
    },

    async resetPassword(input: ResetPasswordInput): Promise<void> {
      return invoke<void>(IPC_CHANNELS.AUTH.RESET_PASSWORD, input);
    },
  },
  window: {
    async minimize(): Promise<void> {
      return invoke<void>(IPC_CHANNELS.WINDOW.MINIMIZE);
    },
    async maximize(): Promise<void> {
      return invoke<void>(IPC_CHANNELS.WINDOW.MAXIMIZE);
    },
    async close(): Promise<void> {
      return invoke<void>(IPC_CHANNELS.WINDOW.CLOSE);
    },
  },
};

// Expose duy nhất qua contextBridge — renderer chỉ thấy window.desktop
contextBridge.exposeInMainWorld('desktop', desktopAPI);
