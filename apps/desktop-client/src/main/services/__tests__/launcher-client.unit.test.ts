import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import fs from 'fs';
import { LauncherClient } from '../launcher-client.js';

describe('LauncherClient unit tests', () => {
  const tmpScriptPath = join(__dirname, 'mock-launcher-script.js');

  beforeAll(() => {
    // Write a small mock launcher in pure Javascript that responds to IPC
    const code = `
      process.on('message', (cmd) => {
        if (cmd.type === 'launcher:initialize') {
          process.send({ type: 'command:success', requestId: cmd.requestId });
        } else if (cmd.type === 'profile:launch') {
          process.send({
            type: 'command:success',
            requestId: cmd.requestId,
            payload: { sessionId: 'session_123', profileId: cmd.payload.profileId, state: 'running' }
          });
        } else if (cmd.type === 'profile:stop') {
          process.send({ type: 'command:success', requestId: cmd.requestId });
        } else if (cmd.type === 'launcher:shutdown') {
          process.send({ type: 'command:success', requestId: cmd.requestId });
          process.exit(0);
        }
      });
      process.send({ type: 'launcher:ready' });
    `;
    fs.writeFileSync(tmpScriptPath, code, 'utf8');
  });

  afterAll(() => {
    try {
      fs.unlinkSync(tmpScriptPath);
    } catch {}
  });

  it('initializes and executes commands successfully', async () => {
    const mockDb = {
      getConnection: () => ({
        transaction: (cb: () => any) => () => cb(),
        prepare: (sql: string) => ({
          all: () => [],
          get: () => {
            if (sql.includes('FROM browser_sessions')) {
              return null;
            }
            return {
              id: 'profile_1',
              workspace_id: 'default_ws',
              name: 'Test Profile',
              os: 'windows',
              engine: 'chromium',
              distribution: 'chromium',
              channel: 'stable',
              browser_version: 'latest',
              architecture: 'x64',
              storage_key: 'test_profile_key',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          },
          run: () => ({ changes: 0 }),
        }),
      }) as any,
    };
    const client = new LauncherClient(mockDb, {
      applicationMode: 'test',
      deviceId: 'test_device',
      launcherScriptPath: tmpScriptPath,
      fingerprintProvider: {
        getVerifiedEnvelope: () => Promise.resolve({}),
      } as any,
      fingerprintValidator: {
        validate: () => ({}),
      } as any,
      fingerprintMapper: () => ({
        fingerprintWithHeaders: {} as any,
        markerScript: '',
        readiness: {} as any,
      }),
    });
    await client.initialize();

    const session = await client.launch({ profileId: 'profile_1' });
    expect(session.sessionId).toBe('session_123');

    await client.shutdown();
  });
});
