import { app } from 'electron';
import { join } from 'path';
import { appendFileSync, mkdirSync } from 'fs';
import { getConfig } from '../bootstrap/config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(private readonly context: string) {}

  private format(level: LogLevel, message: string): string {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  private write(level: LogLevel, message: string, ...args: unknown[]): void {
    const detail = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    const formatted = this.format(level, message) + detail;

    // In ra console (chỉ in debug ở dev)
    let isProd = false;
    try {
      isProd = getConfig().nodeEnv === 'production';
    } catch {
      isProd = process.env['NODE_ENV'] === 'production';
    }

    if (level === 'debug') {
      if (!isProd) {
        console.debug(formatted);
      }
    } else if (level === 'info') {
      console.info(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else if (level === 'error') {
      console.error(formatted);
    }

    // Ghi file log ở production
    if (isProd) {
      try {
        const userDataPath = app.getPath('userData');
        const logDir = join(userDataPath, 'logs');
        mkdirSync(logDir, { recursive: true });
        const logFile = join(logDir, 'app.log');
        appendFileSync(logFile, formatted + '\n', 'utf8');
      } catch {
        // Bỏ qua nếu có lỗi ghi file log (ví dụ lúc startup trước khi app sẵn sàng)
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, ...args);
  }

  error(message: string, err?: unknown): void {
    const errMsg = err instanceof Error ? err.stack ?? err.message : String(err ?? '');
    this.write('error', message, errMsg);
  }
}
