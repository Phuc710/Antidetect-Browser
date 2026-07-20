import { BrowserWindow, ipcMain } from 'electron';
import { PROFILE_IPC_CHANNELS } from '../../../shared/profile-ipc-channels.js';
import type { BrowserRuntimePort } from '../../services/browser-runtime-port.js';
import type { ProfileService } from '../../services/profile-service.js';
import { Logger } from '../../services/logger.js';
import { safeBrowserFailure } from '../../services/browser-error-mapper.js';
import {
  isCreateProfileInput,
  isLaunchProfileInput,
  isListProfilesInput,
  isProfileIdInput,
  isSessionIdInput,
  isUpdateProfileInput,
} from '../profile-ipc-validation.js';

const logger = new Logger('ProfileIpcHandler');

export function registerProfileHandlers(
  profileService: ProfileService,
  browserService: BrowserRuntimePort,
): void {
  browserService.subscribe((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(PROFILE_IPC_CHANNELS.RUNTIME_EVENT, event);
    }
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.LIST, (_event, input: unknown) => {
    if (!isListProfilesInput(input)) return validationError('Invalid profile filters.');
    return execute(() => profileService.list(input), 'profile:list');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.GET, (_event, input: unknown) => {
    if (!isProfileIdInput(input)) return validationError('Invalid profile ID.');
    return execute(() => profileService.get(input.profileId), 'profile:get');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.CREATE, async (_event, input: unknown) => {
    if (!isCreateProfileInput(input)) return validationError('Invalid profile configuration.');
    return execute(() => profileService.create(input), 'profile:create');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.UPDATE, async (_event, input: unknown) => {
    if (!isUpdateProfileInput(input)) return validationError('Invalid profile update.');
    return execute(() => profileService.update(input), 'profile:update');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.REMOVE, async (_event, input: unknown) => {
    if (!isProfileIdInput(input)) return validationError('Invalid profile ID.');
    return execute(async () => {
      await profileService.remove(input.profileId);
      return null;
    }, 'profile:remove');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.LAUNCH, async (_event, input: unknown) => {
    if (!isLaunchProfileInput(input)) return validationError('Invalid launch request.');
    return execute(async () => {
      const session = await browserService.launch(input);
      return { sessionId: session.sessionId };
    }, 'profile:launch');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.STOP, async (_event, input: unknown) => {
    if (!isSessionIdInput(input)) return validationError('Invalid browser session ID.');
    return execute(async () => {
      await browserService.stop(input.sessionId);
      return null;
    }, 'profile:stop');
  });

  ipcMain.handle(PROFILE_IPC_CHANNELS.GET_RUNTIME_SNAPSHOT, () => {
    return execute(() => browserService.getRuntimeSnapshot(), 'profile:get-runtime-snapshot');
  });
}

function validationError(message: string): { ok: false; code: string; message: string } {
  return { ok: false, code: 'VALIDATION_ERROR', message };
}

async function execute<T>(operation: () => T | Promise<T>, operationName: string): Promise<
  { ok: true; data: T } | { ok: false; code: string; message: string }
> {
  try {
    return { ok: true, data: await operation() };
  } catch (error: unknown) {
    const failure = safeIpcFailure(error);
    logger.warn(`${operationName} failed with ${failure.code}.`);
    return { ok: false, ...failure };
  }
}

export function safeIpcFailure(error: unknown): { code: string; message: string } {
  const { code, message } = safeBrowserFailure(error);
  return { code, message };
}
