import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createCoreDesktopRuntime, resolveApplicationMode } from '../composition-root.js';
import { runMigrations } from '../database/migration-runner.js';

const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('desktop composition root', () => {
  it('gives IPC/ProfileService and Local API the exact same browser service instance', () => {
    const database = new Database(':memory:');
    runMigrations(database);
    databases.push(database);
    const runtime = createCoreDesktopRuntime({
      getConnection: () => database,
    }, { applicationMode: 'test' });

    expect(Reflect.get(runtime.profileService, 'browserService'))
      .toBe(runtime.browserRuntime);
    expect(Reflect.get(runtime.localApiService, 'browserService'))
      .toBe(runtime.browserRuntime);
  });

  it('forces packaged and NODE_ENV production builds into production mode', () => {
    expect(resolveApplicationMode(true, 'development')).toBe('production');
    expect(resolveApplicationMode(false, 'production')).toBe('production');
    expect(resolveApplicationMode(false, 'test')).toBe('test');
  });
});
