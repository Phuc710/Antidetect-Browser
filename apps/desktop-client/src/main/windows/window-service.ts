import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { Logger } from '../services/logger.js';

const logger = new Logger('WindowService');

export class WindowService {
  private mainWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 600,
      show: false,
      frame: false,           // Custom titlebar
      titleBarStyle: 'hidden',
      backgroundColor: '#0f1117',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    // Hiện window sau khi render xong để tránh flash trắng
    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();
      logger.info('Main window shown');
    });

    // Mở link ngoài bằng system browser, không mở trong app
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).catch(() => { });
      return { action: 'deny' };
    });

    // Load renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
