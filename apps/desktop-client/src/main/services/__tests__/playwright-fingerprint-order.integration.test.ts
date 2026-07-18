import Database from 'better-sqlite3';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium, type Browser } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';
import { PlaywrightRuntimeAdapter } from '../../adapters/playwright-runtime-adapter.js';
import { runMigrations } from '../../database/migration-runner.js';
import { ProfileRepository } from '../../database/repositories/profile-repository.js';
import { getHostArchitecture } from '../../../shared/profile-contracts.js';
import {
  BrowserApplicationService,
  PlaywrightProcessLauncher,
  type BrowserProcessHandle,
  type BrowserProcessLauncher,
} from '../browser-application-service.js';
import { FingerprintEnvelopeValidator } from '../fingerprint-envelope-validator.js';
import {
  createEphemeralDevelopmentSigningMaterial,
  createFingerprintProvider,
} from '../fingerprint-provider.js';
import { ProfileLockManager } from '../profile-lock-manager.js';
import { ProfileStorageResolver } from '../profile-storage-resolver.js';

const databases: Database.Database[] = [];
const roots: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('Playwright fingerprint injection order', () => {
  it('does not expose the automation endpoint before readiness', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'playwright-readiness-gate-'));
    roots.push(root);
    const handle = await new PlaywrightProcessLauncher().launch({
      engine: 'chromium', distribution: 'chromium', channel: 'stable',
      browserVersion: '147.0.7727.15', architecture: getHostArchitecture(),
      automationProtocol: 'cdp', userDataDir: root, headless: true,
    });
    const adapter = await PlaywrightRuntimeAdapter.connect(handle, {
      userAgent: 'gate-test', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    });
    try {
      expect(() => adapter.getAutomationEndpoint()).toThrow(expect.objectContaining({
        code: 'FINGERPRINT_READINESS_FAILED',
      }));
    } finally {
      await adapter.stop();
    }
  }, 30_000);

  it('runs the init script before the first user navigation without Internet access', async () => {
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    runMigrations(database);
    databases.push(database);
    const root = fs.mkdtempSync(join(tmpdir(), 'playwright-fingerprint-order-'));
    roots.push(root);
    const resolver = new ProfileStorageResolver(root);
    const now = () => new Date();
    new ProfileRepository(database).insert({
      id: 'profile-playwright', name: 'Real Chromium', os: 'windows', engine: 'chromium',
      distribution: 'chromium', channel: 'stable', browserVersion: '147.0.7727.15',
      architecture: getHostArchitecture(), storageKey: 'profile_profile-playwright',
      createdAt: now().toISOString(), updatedAt: now().toISOString(),
    });

    const signingMaterial = createEphemeralDevelopmentSigningMaterial();
    const validator = new FingerprintEnvelopeValidator(
      { [signingMaterial.keyId]: signingMaterial.publicKey },
      'integration_test',
      now,
    );
    const provider = createFingerprintProvider({
      mode: 'integration_test', validator, developmentSigningMaterial: signingMaterial,
    });
    const realLauncher = new PlaywrightProcessLauncher();
    let processHandle: BrowserProcessHandle | undefined;
    const capturingLauncher: BrowserProcessLauncher = {
      async launch(options) {
        processHandle = await realLauncher.launch(options);
        return processHandle;
      },
    };
    const service = new BrowserApplicationService({ getConnection: () => database }, {
      fingerprintProvider: provider,
      fingerprintValidator: validator,
      launcher: capturingLauncher,
      storageResolver: resolver,
      lockManager: new ProfileLockManager(resolver, {
        instanceId: 'playwright-order', processId: process.pid, isProcessAlive: () => true,
      }),
      idGenerator: () => 'session-playwright',
      now,
    });
    let observer: Browser | undefined;
    try {
      const session = await service.launch({ profileId: 'profile-playwright', headless: true });
      expect(session.state).toBe('running');
      if (!processHandle) throw new Error('Browser process handle was not captured.');
      if (session.automation.protocol !== 'cdp') throw new Error('Expected a CDP endpoint.');
      observer = await chromium.connectOverCDP(session.automation.endpoint);
      const context = observer.contexts()[0];
      if (!context) throw new Error('Injected browser context was not observable.');
      const page = await context.newPage();
      await page.goto(`data:text/html,${encodeURIComponent(`
        <script>
          window.observedAtDocumentScript = {
            marker: window.__fingerprintVersion,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
          };
        </script>
      `)}`);
      const observed = await page.evaluate(() => Reflect.get(window, 'observedAtDocumentScript'));
      expect(observed).toMatchObject({
        marker: '2.1.83-development',
        language: 'en-US',
      });
      expect(typeof (observed as { userAgent?: unknown }).userAgent).toBe('string');
      expect(typeof (observed as { platform?: unknown }).platform).toBe('string');
      await page.close();
    } finally {
      await service.stop('session-playwright');
    }
    expect(observer?.isConnected()).toBe(false);
  }, 30_000);
});
