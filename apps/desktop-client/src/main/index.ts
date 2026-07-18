import { app, BrowserWindow } from 'electron';
import { WindowService } from './windows/window-service.js';
import { DatabaseService } from './services/database-service.js';
import { AuthService } from './services/auth-service.js';
import { registerAuthHandlers } from './ipc/handlers/auth-handlers.js';
import { registerLocalApiHandlers } from './ipc/handlers/local-api-handlers.js';
import { registerWindowHandlers } from './ipc/handlers/window-handlers.js';
import { Logger } from './services/logger.js';
import { loadAndValidateConfig, getConfig } from './bootstrap/config.js';
import { registerProfileHandlers } from './ipc/handlers/profile-handlers.js';
import { registerProxyHandlers } from './ipc/handlers/proxy-handlers.js';
import { createCoreDesktopRuntime, resolveApplicationMode } from './composition-root.js';

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
  const {
    browserApplicationService: browserService,
    localApiService,
    profileService,
    proxyService,
  } = createCoreDesktopRuntime(db, {
    applicationMode: resolveApplicationMode(app.isPackaged, process.env['NODE_ENV']),
  });

  const recoveredSessions = browserService.recoverCrashedSessions();
  if (recoveredSessions > 0) logger.warn(`Recovered ${recoveredSessions} interrupted browser session(s).`);

  localApiService.start();
  await proxyService.initialize();

  // Đăng ký dọn dẹp khi tắt app
  app.on('will-quit', () => {
    localApiService.stop();
    void browserService.shutdown();
  });

  // Đăng ký IPC handlers TRƯỚC khi tạo window
  registerAuthHandlers(authService);
  registerLocalApiHandlers(db, localApiService);
  registerProfileHandlers(profileService, browserService);
  registerProxyHandlers(proxyService);

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
