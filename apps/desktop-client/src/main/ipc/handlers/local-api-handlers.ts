import { ipcMain } from 'electron';
import type { DatabaseService } from '../../services/database-service.js';
import type { LocalApiService } from '../../services/local-api-service.js';
import { Logger } from '../../services/logger.js';

const logger = new Logger('LocalApiIpcHandler');

export function registerLocalApiHandlers(
  db: DatabaseService,
  localApiService: LocalApiService,
): void {
  ipcMain.handle('local-api:get-config', () => {
    try {
      const connection = db.getConnection();
      const enabled = connection.prepare(
        "SELECT value FROM settings WHERE key = 'local_api_enabled'",
      ).get() as { value: string } | undefined;
      const port = connection.prepare(
        "SELECT value FROM settings WHERE key = 'local_api_port'",
      ).get() as { value: string } | undefined;
      return {
        ok: true,
        data: {
          enabled: enabled?.value === 'true',
          port: port ? Number.parseInt(port.value, 10) : 50325,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to get Local API config.', error);
      return failure();
    }
  });

  ipcMain.handle('local-api:set-enabled', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Enabled must be a boolean.' };
    }
    try {
      localApiService.setEnabled(enabled);
      return { ok: true, data: { enabled } };
    } catch (error: unknown) {
      logger.error('Failed to set Local API state.', error);
      return failure();
    }
  });

  ipcMain.handle('local-api:rotate-key', () => {
    try {
      return { ok: true, data: localApiService.rotateApiKey() };
    } catch (error: unknown) {
      logger.error('Failed to rotate Local API key.', error);
      return failure();
    }
  });
}

function failure(): { ok: false; code: string; message: string } {
  return { ok: false, code: 'INTERNAL_ERROR', message: 'The operation could not be completed.' };
}
