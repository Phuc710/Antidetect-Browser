import { is } from '@electron-toolkit/utils';
import { app } from 'electron';
import { join } from 'path';
import dotenv from 'dotenv';

try {
  dotenv.config({ path: join(app.getAppPath(), '.env') });
} catch {
  try {
    dotenv.config();
  } catch {
    // Environment loading is optional; validation below handles missing values.
  }
}

export interface AppConfig {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly isDev: boolean;
  readonly cloudApiUrl: string;
  readonly allowedOrigins: readonly string[];
  readonly keychain: {
    readonly service: string;
    readonly account: string;
  };
  readonly electronRendererUrl?: string | undefined;
}

let activeConfig: AppConfig | null = null;

function validateUrl(urlStr: string): void {
  try {
    new URL(urlStr);
  } catch {
    throw new Error(`Cấu hình URL không hợp lệ: "${urlStr}"`);
  }
}

export function loadAndValidateConfig(): AppConfig {
  if (activeConfig) {
    return activeConfig;
  }

  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as 'development' | 'production' | 'test';
  const isDevMode = is.dev || nodeEnv === 'development';

  const cloudApiUrl = process.env['CLOUD_API_URL'];

  if (!cloudApiUrl) {
    throw new Error('Cấu hình thiếu biến môi trường bắt buộc: CLOUD_API_URL');
  }

  validateUrl(cloudApiUrl);

  const parsedUrl = new URL(cloudApiUrl);

  // Validate production rules
  if (!isDevMode) {
    if (parsedUrl.protocol !== 'https:') {
      throw new Error(`Lỗi cấu hình bảo mật: CLOUD_API_URL trong môi trường Production phải sử dụng giao thức HTTPS. Nhận được: "${cloudApiUrl}"`);
    }
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
      throw new Error(`Lỗi cấu hình bảo mật: CLOUD_API_URL trong môi trường Production không được phép trỏ tới localhost. Nhận được: "${cloudApiUrl}"`);
    }
  }

  // Allowed Origins logic
  const allowedOrigins: string[] = [];
  if (isDevMode) {
    allowedOrigins.push('http://localhost:5173');
    const envRendererUrl = process.env['ELECTRON_RENDERER_URL'];
    if (envRendererUrl) {
      try {
        const parsedDev = new URL(envRendererUrl);
        allowedOrigins.push(parsedDev.origin);
      } catch {
        // bỏ qua nếu định dạng URL dev server không hợp lệ
      }
    }
  }

  // Luôn thêm origin của CLOUD_API_URL vào danh sách cho phép điều hướng/kết nối
  allowedOrigins.push(parsedUrl.origin);

  const electronRendererUrl = process.env['ELECTRON_RENDERER_URL'];

  const config: AppConfig = {
    nodeEnv,
    isDev: isDevMode,
    cloudApiUrl,
    allowedOrigins: Object.freeze(allowedOrigins),
    keychain: Object.freeze({
      service: 'antidetect-browser',
      account: 'refresh-token',
    }),
    electronRendererUrl,
  };

  activeConfig = Object.freeze(config);
  return activeConfig;
}

export function getConfig(): AppConfig {
  if (!activeConfig) {
    throw new Error('Config chưa được tải và xác thực. Hãy gọi loadAndValidateConfig() trước khi khởi động các service.');
  }
  return activeConfig;
}
