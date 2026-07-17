// IPC channel constants — dùng chung giữa main và preload
// Không bao giờ cho renderer truyền tên channel tùy ý

export const IPC_CHANNELS = {
  AUTH: {
    LOGIN: 'auth:login',
    LOGOUT: 'auth:logout',
    LOGOUT_ALL: 'auth:logout-all',
    GET_ME: 'auth:get-me',
    IS_AUTHENTICATED: 'auth:is-authenticated',
    REGISTER: 'auth:register',
    FORGOT_PASSWORD: 'auth:forgot-password',
    RESET_PASSWORD: 'auth:reset-password',
  },
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
  },
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS][keyof typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]];
