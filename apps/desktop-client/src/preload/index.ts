import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from 'shared';
import type {
  DesktopAPI, LoginInput, LoginResult, User, RegisterInput, ResetPasswordInput, IpcResult,
  ListProxiesInput, CreateProxyInput, UpdateProxyInput, TestDraftProxyInput,
  ProxyView, ProxyTestResult, ProxyListResult,
} from 'shared';
import type {
  CreateProfileInput,
  ListProfilesInput,
  ProfileListResult,
  ProfileRuntimeEvent,
  ProfileRuntimeSnapshot,
  ProfileRuntimeSnapshotEnvelope,
  ProfilesAPI,
  ProfileView,
  UpdateProfileInput,
} from '../shared/profile-contracts.js';
import { PROFILE_IPC_CHANNELS } from '../shared/profile-ipc-channels.js';

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

type DesktopBridgeAPI = Omit<DesktopAPI, 'profile'> & { profile: ProfilesAPI };

const runtimeEventBuffer: ProfileRuntimeEvent[] = [];
const runtimeSubscribers = new Set<{ listener: (event: ProfileRuntimeEvent) => void; lastSequence: number }>();
let latestSnapshotSequence = 0;

ipcRenderer.on(PROFILE_IPC_CHANNELS.RUNTIME_EVENT, (_event, payload: ProfileRuntimeEvent) => {
  if (runtimeEventBuffer.some((event) => event.sequence === payload.sequence)) return;
  runtimeEventBuffer.push(payload);
  runtimeEventBuffer.sort((left, right) => left.sequence - right.sequence);
  if (runtimeEventBuffer.length > 512) runtimeEventBuffer.shift();
  for (const subscriber of runtimeSubscribers) {
    if (payload.sequence > subscriber.lastSequence) {
      subscriber.listener(payload);
      subscriber.lastSequence = payload.sequence;
    }
  }
});

const desktopAPI: DesktopBridgeAPI = {
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
  proxy: {
    async list(input: ListProxiesInput): Promise<ProxyListResult> {
      return invoke<ProxyListResult>(IPC_CHANNELS.PROXY.LIST, input);
    },
    async create(input: CreateProxyInput): Promise<ProxyView> {
      return invoke<ProxyView>(IPC_CHANNELS.PROXY.CREATE, input);
    },
    async update(input: UpdateProxyInput): Promise<ProxyView> {
      return invoke<ProxyView>(IPC_CHANNELS.PROXY.UPDATE, input);
    },
    async remove(input: { proxyId: string }): Promise<void> {
      return invoke<void>(IPC_CHANNELS.PROXY.REMOVE, input);
    },
    async testDraft(input: TestDraftProxyInput): Promise<ProxyTestResult> {
      return invoke<ProxyTestResult>(IPC_CHANNELS.PROXY.TEST_DRAFT, input);
    },
    async testStored(input: { proxyId: string; testId: string }): Promise<ProxyTestResult> {
      return invoke<ProxyTestResult>(IPC_CHANNELS.PROXY.TEST_STORED, input);
    },
    async cancelTest(input: { testId: string }): Promise<void> {
      return invoke<void>(IPC_CHANNELS.PROXY.CANCEL_TEST, input);
    },
  },
  localApi: {
    async getConfig(): Promise<{ enabled: boolean; port: number }> {
      return ipcRenderer.invoke('local-api:get-config').then((res) => {
        if (!res.ok) throw new Error(res.message);
        return res.data;
      });
    },
    async setEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
      return ipcRenderer.invoke('local-api:set-enabled', enabled).then((res) => {
        if (!res.ok) throw new Error(res.message);
        return res.data;
      });
    },
    async rotateKey(): Promise<string> {
      return ipcRenderer.invoke('local-api:rotate-key').then((res) => {
        if (!res.ok) throw new Error(res.message);
        return res.data;
      });
    },
  },
  profile: {
    async list(input: ListProfilesInput): Promise<ProfileListResult> {
      return invoke<ProfileListResult>(PROFILE_IPC_CHANNELS.LIST, input);
    },
    async create(input: CreateProfileInput): Promise<ProfileView> {
      return invoke<ProfileView>(PROFILE_IPC_CHANNELS.CREATE, input);
    },
    async update(input: UpdateProfileInput): Promise<ProfileView> {
      return invoke<ProfileView>(PROFILE_IPC_CHANNELS.UPDATE, input);
    },
    async remove(input: { profileId: string }): Promise<void> {
      return invoke<void>(PROFILE_IPC_CHANNELS.REMOVE, input);
    },
    async launch(input: { profileId: string; headless?: boolean }): Promise<{ sessionId: string }> {
      return invoke<{ sessionId: string }>(PROFILE_IPC_CHANNELS.LAUNCH, input);
    },
    async stop(input: { sessionId: string }): Promise<void> {
      return invoke<void>(PROFILE_IPC_CHANNELS.STOP, input);
    },
    async getRuntimeSnapshot(): Promise<ProfileRuntimeSnapshot[]> {
      const snapshot = await invoke<ProfileRuntimeSnapshotEnvelope>(PROFILE_IPC_CHANNELS.GET_RUNTIME_SNAPSHOT);
      latestSnapshotSequence = snapshot.snapshotSequence;
      return snapshot.sessions;
    },
    subscribeRuntime(listener: (event: ProfileRuntimeEvent) => void): () => void {
      const subscriber = { listener, lastSequence: latestSnapshotSequence };
      for (const event of runtimeEventBuffer) {
        if (event.sequence > subscriber.lastSequence) {
          listener(event);
          subscriber.lastSequence = event.sequence;
        }
      }
      runtimeSubscribers.add(subscriber);
      return () => {
        runtimeSubscribers.delete(subscriber);
      };
    },
  },
};

// Expose duy nhất qua contextBridge — renderer chỉ thấy window.desktop
contextBridge.exposeInMainWorld('desktop', desktopAPI);
