import type { FingerprintEnvelope, BrowserEngine } from '../../shared/profile-contracts.js';
import { Logger } from './logger.js';

const logger = new Logger('FingerprintProvider');

export interface IFingerprintProvider {
  getEnvelope(options: { os: 'windows' | 'mac' | 'linux'; engine: BrowserEngine }): Promise<FingerprintEnvelope>;
}

export class CloudFingerprintProvider implements IFingerprintProvider {
  async getEnvelope(options: { os: 'windows' | 'mac' | 'linux'; engine: BrowserEngine }): Promise<FingerprintEnvelope> {
    return {
      schemaVersion: 1,
      generatorVersion: 'cloud-v1.0.0',
      browserEngine: options.engine,
      minimumKernelVersion: '120.0.0.0',
      generatedAt: new Date().toISOString(),
      payload: {
        userAgent: options.os === 'mac'
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          : options.os === 'linux'
          ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        hardwareConcurrency: 8,
        deviceMemory: 8,
      },
    };
  }
}

export class DevelopmentFingerprintProvider implements IFingerprintProvider {
  async getEnvelope(options: { os: 'windows' | 'mac' | 'linux'; engine: BrowserEngine }): Promise<FingerprintEnvelope> {
    logger.warn('Using DevelopmentFingerprintProvider adapter (DEV ONLY)');
    return {
      schemaVersion: 1,
      generatorVersion: 'dev-mock-1.0',
      browserEngine: options.engine,
      minimumKernelVersion: '120.0.0.0',
      generatedAt: new Date().toISOString(),
      payload: {
        userAgent: `DevMockUA/${options.engine}/${options.os}`,
        hardwareConcurrency: 4,
        deviceMemory: 4,
      },
    };
  }
}

export function createFingerprintProvider(): IFingerprintProvider {
  if (process.env['NODE_ENV'] === 'production') {
    return new CloudFingerprintProvider();
  }
  return new DevelopmentFingerprintProvider();
}
