import { ipcMain } from 'electron';
import { IPC_CHANNELS } from 'shared';
import type { WindowService } from '../../windows/window-service.js';
import { Logger } from '../../services/logger.js';

const logger = new Logger('WindowIpcHandler');

export function registerWindowHandlers(windowService: WindowService): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW.MINIMIZE, async () => {
    try {
      const win = windowService.getMainWindow();
      if (win) {
        win.minimize();
      }
      return { ok: true, data: null };
    } catch (err: unknown) {
      logger.error('Failed to minimize window', err);
      return { ok: false, code: 'WINDOW_ERROR', message: 'Không thể thu nhỏ cửa sổ.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.MAXIMIZE, async () => {
    try {
      const win = windowService.getMainWindow();
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
      return { ok: true, data: null };
    } catch (err: unknown) {
      logger.error('Failed to maximize window', err);
      return { ok: false, code: 'WINDOW_ERROR', message: 'Không thể phóng to cửa sổ.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE, async () => {
    try {
      const win = windowService.getMainWindow();
      if (win) {
        win.close();
      }
      return { ok: true, data: null };
    } catch (err: unknown) {
      logger.error('Failed to close window', err);
      return { ok: false, code: 'WINDOW_ERROR', message: 'Không thể đóng cửa sổ.' };
    }
  });
}
