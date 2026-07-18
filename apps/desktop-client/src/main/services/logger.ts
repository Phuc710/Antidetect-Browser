import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { redactSecrets, redactText } from './redaction.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(private readonly context: string) {}

  private format(level: LogLevel, message: string): string {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  private write(level: LogLevel, message: string, ...args: unknown[]): void {
    const detail = args.length > 0
      ? ` ${args.map((argument) => {
        const redacted = redactSecrets(argument);
        return typeof redacted === 'object' ? JSON.stringify(redacted) : String(redacted);
      }).join(' ')}`
      : '';
    const formatted = this.format(level, redactText(message)) + detail;

    const isProduction = process.env['NODE_ENV'] === 'production';

    if (level === 'debug') {
      if (!isProduction) console.debug(formatted);
    } else if (level === 'info') {
      console.info(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.error(formatted);
    }

    if (isProduction) {
      try {
        const logDirectory = join(app.getPath('userData'), 'logs');
        mkdirSync(logDirectory, { recursive: true });
        appendFileSync(join(logDirectory, 'app.log'), `${formatted}\n`, 'utf8');
      } catch {
        // Logging must never crash startup or shutdown.
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

  error(message: string, error?: unknown): void {
    if (error === undefined) this.write('error', message);
    else this.write('error', message, redactSecrets(error));
  }
}
