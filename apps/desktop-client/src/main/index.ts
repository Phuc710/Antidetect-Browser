import { app, BrowserWindow } from 'electron';
import { WindowService } from './windows/window-service.js';
import { DatabaseService } from './services/database-service.js';
import { AuthService } from './services/auth-service.js';
import { registerAuthHandlers } from './ipc/handlers/auth-handlers.js';
import { registerWindowHandlers } from './ipc/handlers/window-handlers.js';
import { Logger } from './services/logger.js';
import { loadAndValidateConfig, getConfig } from './bootstrap/config.js';

const logger = new Logger('Main');

// Khởi động và xác thực cấu hình (Fail Fast)
try {
  loadAndValidateConfig();
} catch (err: unknown) {
  logger.error('Lỗi cấu hình khởi động', err);
  app.exit(1);
}

// Single-instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  logger.warn('Another instance is already running. Quitting.');
  app.quit();
}

// Security: Tắt navigation đến origin lạ
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const config = getConfig();
    const { origin } = new URL(url);
    if (!config.allowedOrigins.includes(origin) && !url.startsWith('file://')) {
      logger.warn(`Blocked navigation to: ${url}`);
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    logger.warn(`Blocked window.open: ${url}`);
    return { action: 'deny' };
  });
});

async function bootstrap(): Promise<void> {
  await app.whenReady();

  // Khởi tạo services
  const db = new DatabaseService();
  await db.initialize();

  const authService = new AuthService(db);

  // Đăng ký IPC handlers TRƯỚC khi tạo window
  registerAuthHandlers(authService);

  // Tạo main window
  const windowService = new WindowService();
  registerWindowHandlers(windowService);
  const mainWindow = windowService.createMainWindow();

  // Khôi phục session nếu có
  const sessionRestored = await authService.restoreSession();
  logger.info(`Session restored: ${sessionRestored}`);

  // Gửi trạng thái auth về renderer sau khi window sẵn sàng
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('auth:session-restored', sessionRestored);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowService.createMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

bootstrap().catch((err: unknown) => {
  logger.error('Bootstrap failed', err);
  app.quit();
});
