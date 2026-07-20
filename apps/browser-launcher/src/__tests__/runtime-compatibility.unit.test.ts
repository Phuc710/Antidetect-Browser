import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { RuntimeManifestReader } from '../runtime-compatibility/runtime-manifest-reader.js';
import { BrowserExecutableResolver } from '../runtime-compatibility/browser-executable-resolver.js';
import { RuntimeCompatibilityChecker } from '../runtime-compatibility/runtime-compatibility-checker.js';
import { BrowserRuntimeRegistry } from '../runtime-compatibility/browser-runtime-registry.js';
import { BrowserRuntimeError } from '../runtime-compatibility/runtime-errors.js';
import { PlaywrightProcessLauncher } from '../runtime/playwright-process-launcher.js';

vi.mock('fs');
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('Browser Runtime Compatibility & Resolution - Unit Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('RuntimeManifestReader', () => {
    const reader = new RuntimeManifestReader();

    it('throws if manifest file does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(() => reader.read('/dummy/manifest.json')).toThrow(/Manifest file does not exist/);
    });

    it('throws if JSON is invalid', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{ invalid JSON');
      expect(() => reader.read('/dummy/manifest.json')).toThrow(/Manifest JSON is malformed/);
    });

    it('throws if manifest shape is invalid', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ notRuntimes: [] }));
      expect(() => reader.read('/dummy/manifest.json')).toThrow(/must be an object containing/);
    });

    it('parses valid manifest successfully', () => {
      const sampleManifest = {
        runtimes: [
          {
            engine: 'chromium',
            distribution: 'chromium',
            channel: 'stable',
            version: '120.0.0',
            architecture: 'x64',
            platform: 'win32',
            relativeExecutablePath: 'chromium-120/chrome.exe',
          },
        ],
      };
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sampleManifest));
      const res = reader.read('/dummy/manifest.json');
      expect(res.runtimes).toHaveLength(1);
      expect(res.runtimes[0].engine).toBe('chromium');
    });
  });

  describe('BrowserExecutableResolver', () => {
    const mockManifest = {
      runtimes: [
        {
          engine: 'chromium' as const,
          distribution: 'chromium' as const,
          channel: 'stable' as const,
          version: '120.0.0',
          architecture: 'x64' as const,
          platform: process.platform as any,
          relativeExecutablePath: 'chromium-120/chrome.exe',
        },
        {
          engine: 'chromium' as const,
          distribution: 'chromium' as const,
          channel: 'stable' as const,
          version: '121.0.0',
          architecture: 'x64' as const,
          platform: 'darwin' as any, // Mismatched platform
          relativeExecutablePath: 'chromium-121/chrome.exe',
        },
        {
          engine: 'chromium' as const,
          distribution: 'chromium' as const,
          channel: 'stable' as const,
          version: '122.0.0',
          architecture: 'x64' as const,
          platform: process.platform as any,
          relativeExecutablePath: '../../outside/chrome.exe', // Traversal candidate
        },
      ],
    };

    it('resolves valid registered runtime', () => {
      const resolver = new BrowserExecutableResolver('/root', mockManifest);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const resolved = resolver.resolve({
        engine: 'chromium',
        distribution: 'chromium',
        channel: 'stable',
        browserVersion: '120.0.0',
        architecture: 'x64',
      });
      expect(resolved.executablePath).toContain('chrome.exe');
    });

    it('throws error when runtime not registered', () => {
      const resolver = new BrowserExecutableResolver('/root', mockManifest);
      expect(() =>
        resolver.resolve({
          engine: 'chromium',
          distribution: 'chromium',
          channel: 'stable',
          browserVersion: '999.0.0', // not registered
          architecture: 'x64',
        })
      ).toThrow(BrowserRuntimeError);
    });

    it('throws error when platform mismatches', () => {
      const resolver = new BrowserExecutableResolver('/root', mockManifest);
      // Try to resolve version 121 which is darwin-only on non-darwin host platforms (or win32-only on non-win32 host)
      const targetPlatform = process.platform === 'darwin' ? 'win32' : 'darwin';
      const testManifest = {
        runtimes: [
          {
            engine: 'chromium' as const,
            distribution: 'chromium' as const,
            channel: 'stable' as const,
            version: '121.0.0',
            architecture: 'x64' as const,
            platform: targetPlatform as any,
            relativeExecutablePath: 'chromium-121/chrome.exe',
          },
        ],
      };
      const testResolver = new BrowserExecutableResolver('/root', testManifest);
      expect(() =>
        testResolver.resolve({
          engine: 'chromium',
          distribution: 'chromium',
          channel: 'stable',
          browserVersion: '121.0.0',
          architecture: 'x64',
        })
      ).toThrow(BrowserRuntimeError);
    });

    it('rejects path traversal relative paths', () => {
      const resolver = new BrowserExecutableResolver('/root', mockManifest);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      expect(() =>
        resolver.resolve({
          engine: 'chromium',
          distribution: 'chromium',
          channel: 'stable',
          browserVersion: '122.0.0',
          architecture: 'x64',
        })
      ).toThrow(/Path traversal detected/);
    });

    it('throws error when executable is missing on disk', () => {
      const resolver = new BrowserExecutableResolver('/root', mockManifest);
      vi.spyOn(fs, 'existsSync').mockReturnValue(false); // file missing
      expect(() =>
        resolver.resolve({
          engine: 'chromium',
          distribution: 'chromium',
          channel: 'stable',
          browserVersion: '120.0.0',
          architecture: 'x64',
        })
      ).toThrow(/Executable file not found/);
    });
  });

  describe('RuntimeCompatibilityChecker', () => {
    const checker = new RuntimeCompatibilityChecker();

    it('detects architecture mismatches', () => {
      // Stub host arch as x64, check target arch arm64
      const resolved = {
        descriptor: {
          engine: 'chromium' as const,
          distribution: 'chromium' as const,
          channel: 'stable' as const,
          browserVersion: '120.0.0',
          architecture: 'arm64' as const,
        },
        executablePath: '/root/chrome.exe',
      };
      
      // Override process.arch
      const originalArch = process.arch;
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true });
      
      try {
        const report = checker.check(resolved);
        expect(report.compatible).toBe(false);
        expect(report.issues[0].code).toBe('ARCHITECTURE_MISMATCH');
      } finally {
        Object.defineProperty(process, 'arch', { value: originalArch });
      }
    });

    it('detects browser binary version mismatches', () => {
      const resolved = {
        descriptor: {
          engine: 'chromium' as const,
          distribution: 'chromium' as const,
          channel: 'stable' as const,
          browserVersion: '120.0.0',
          architecture: process.arch as any,
        },
        executablePath: '/root/chrome.exe',
      };

      // Mock child_process outputting mismatched major version e.g. "121.0.0"
      vi.mocked(execFileSync).mockReturnValue('Google Chrome 121.0.123.4');

      const report = checker.check(resolved);
      expect(report.compatible).toBe(false);
      expect(report.issues.some((i) => i.code === 'VERSION_MISMATCH' && i.severity === 'critical')).toBe(true);
    });
  });

  describe('PlaywrightProcessLauncher - executablePath', () => {
    it('passes exact executablePath parameter into playwright launcherServer', async () => {
      const mockLaunchServer = vi.fn().mockResolvedValue({
        process: () => ({ pid: 1234 }),
        wsEndpoint: () => 'ws://...',
        on: vi.fn(),
      });
      vi.doMock('playwright', () => ({
        chromium: {
          launchServer: mockLaunchServer,
        },
      }));

      const launcher = new PlaywrightProcessLauncher();
      const plan: any = {
        runtime: { engine: 'chromium' },
        nativeArgs: [],
        proxy: undefined,
      };
      const resolvedRuntime = {
        descriptor: { engine: 'chromium' as const },
        executablePath: '/custom/path/to/chrome.exe',
      } as any;

      const handle = await launcher.launch(plan, resolvedRuntime);
      expect(mockLaunchServer).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/custom/path/to/chrome.exe',
        })
      );
    });
  });
});
