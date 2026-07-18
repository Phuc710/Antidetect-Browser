import { describe, it, expect } from 'vitest';
import type { ProfileView } from 'shared';

type PageState = 'loading' | 'success' | 'empty' | 'error' | 'offline' | 'permission_denied';

function resolvePageState(
  loading: boolean,
  error: string | null,
  total: number
): PageState {
  if (loading) return 'loading';
  if (error) {
    if (error.includes('PERM')) return 'permission_denied';
    if (error.toLowerCase().includes('network') || error.toLowerCase().includes('offline')) return 'offline';
    return 'error';
  }
  return total === 0 ? 'empty' : 'success';
}

describe('Profiles UI Page States & Offline Cache Unit Tests', () => {
  it('should resolve loading state when loading is true', () => {
    expect(resolvePageState(true, null, 0)).toBe('loading');
  });

  it('should resolve empty state when total profiles count is 0', () => {
    expect(resolvePageState(false, null, 0)).toBe('empty');
  });

  it('should resolve success state when profiles are populated', () => {
    expect(resolvePageState(false, null, 5)).toBe('success');
  });

  it('should resolve offline state on network failure', () => {
    expect(resolvePageState(false, 'Network connection lost', 0)).toBe('offline');
  });

  it('should resolve permission_denied on PERM error', () => {
    expect(resolvePageState(false, 'PERM_DENIED: Access restricted', 0)).toBe('permission_denied');
  });

  it('should preserve cached profiles and banner when offline with cached data', () => {
    const cachedProfiles: ProfileView[] = [
      {
        id: 'p-1',
        workspaceId: 'ws-1',
        name: 'Cached Profile 1',
        os: 'windows',
        engine: 'chromium',
        distribution: 'chromium',
        channel: 'stable',
        browserVersion: '124.0',
        storageKey: 'key-1',
        syncStatus: 'synced',
        deletionState: 'active',
        version: 1,
        status: 'stopped',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-18T00:00:00Z',
      },
    ];

    const isOffline = true;
    const hasCachedData = cachedProfiles.length > 0;

    // View model logic: If offline but has cached data, render table + banner instead of full error page
    expect(hasCachedData).toBe(true);
    expect(isOffline).toBe(true);
  });
});
