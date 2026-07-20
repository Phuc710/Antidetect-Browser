import fs from 'fs';
import { BrowserRuntimeError } from './runtime-errors.js';

export interface RuntimeManifestEntry {
  readonly engine: 'chromium' | 'firefox' | 'webkit';
  readonly distribution: 'chromium' | 'chrome' | 'edge' | 'brave' | 'firefox' | 'webkit' | 'custom';
  readonly channel: 'stable' | 'beta' | 'dev' | 'canary' | 'custom';
  readonly version: string;
  readonly architecture: 'x64' | 'arm64';
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly relativeExecutablePath: string;
}

export interface RuntimeManifest {
  readonly runtimes: RuntimeManifestEntry[];
}

export class RuntimeManifestReader {
  read(manifestPath: string): RuntimeManifest {
    if (!fs.existsSync(manifestPath)) {
      throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest file does not exist at path: ${manifestPath}`);
    }

    let raw: string;
    try {
      raw = fs.readFileSync(manifestPath, 'utf8');
    } catch (err: any) {
      throw new BrowserRuntimeError('MANIFEST_INVALID', `Failed to read manifest file: ${err.message || 'unknown error'}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest JSON is malformed: ${err.message || 'unknown error'}`);
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).runtimes)) {
      throw new BrowserRuntimeError('MANIFEST_INVALID', 'Manifest root must be an object containing a "runtimes" array.');
    }

    const manifest = parsed as RuntimeManifest;
    const engines = ['chromium', 'firefox', 'webkit'];
    const distributions = ['chromium', 'chrome', 'edge', 'brave', 'firefox', 'webkit', 'custom'];
    const channels = ['stable', 'beta', 'dev', 'canary', 'custom'];
    const platforms = ['win32', 'darwin', 'linux'];
    const architectures = ['x64', 'arm64'];

    manifest.runtimes.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}] must be an object.`);
      }
      if (!engines.includes(entry.engine)) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].engine is invalid.`);
      }
      if (!distributions.includes(entry.distribution)) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].distribution is invalid.`);
      }
      if (!channels.includes(entry.channel)) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].channel is invalid.`);
      }
      if (typeof entry.version !== 'string' || !entry.version) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].version must be a non-empty string.`);
      }
      if (!architectures.includes(entry.architecture)) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].architecture is invalid.`);
      }
      if (!platforms.includes(entry.platform)) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].platform is invalid.`);
      }
      if (typeof entry.relativeExecutablePath !== 'string' || !entry.relativeExecutablePath) {
        throw new BrowserRuntimeError('MANIFEST_INVALID', `Manifest entry at [${index}].relativeExecutablePath must be a non-empty string.`);
      }
    });

    return manifest;
  }
}
