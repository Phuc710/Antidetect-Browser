import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMigrations } from '../../database/migration-runner.js';
import { ProxyService } from '../proxy-service.js';

const credentialVault = vi.hoisted(() => new Map<string, string>());

vi.mock('keytar', () => ({
  default: {
    setPassword: async (service: string, account: string, password: string) => {
      credentialVault.set(`${service}:${account}`, password);
    },
    getPassword: async (service: string, account: string) => (
      credentialVault.get(`${service}:${account}`) ?? null
    ),
    deletePassword: async (service: string, account: string) => (
      credentialVault.delete(`${service}:${account}`)
    ),
  },
}));

const databases: Database.Database[] = [];

afterEach(() => {
  credentialVault.clear();
  for (const database of databases.splice(0)) database.close();
});

function service(): ProxyService {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  runMigrations(database);
  databases.push(database);
  return new ProxyService({ getConnection: () => database });
}

describe('ProxyService credential boundary', () => {
  it('stores the password in secure storage and returns only a masked view', async () => {
    const proxyService = service();
    await proxyService.initialize();

    const created = await proxyService.create({
      name: 'Primary',
      protocol: 'http',
      host: 'proxy.example.test',
      port: 8080,
      authMode: 'username_password',
      username: 'operator',
      password: 'secret-value',
    });

    expect(created).not.toHaveProperty('password');
    expect(created.usernameMasked).toBe('op****');
    expect(JSON.stringify(proxyService.list({}))).not.toContain('secret-value');
    await expect(proxyService.resolveForLaunch(created.id)).resolves.toEqual({
      server: 'http://proxy.example.test:8080',
      username: 'operator',
      password: 'secret-value',
    });
  });

  it('removes stale credentials when authentication is disabled', async () => {
    const proxyService = service();
    await proxyService.initialize();
    const created = await proxyService.create({
      name: 'Authenticated',
      protocol: 'socks5',
      host: 'proxy.example.test',
      port: 1080,
      authMode: 'username_password',
      username: 'user',
      password: 'password',
    });

    await proxyService.update({ proxyId: created.id, authMode: 'none' });

    await expect(proxyService.resolveForLaunch(created.id)).resolves.toEqual({
      server: 'socks5://proxy.example.test:1080',
    });
    expect(credentialVault.size).toBe(0);
  });
});
