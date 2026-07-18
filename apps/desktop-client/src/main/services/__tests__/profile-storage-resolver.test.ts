import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileStorageResolver } from '../profile-storage-resolver.js';

describe('ProfileStorageResolver Unit Tests', () => {
  let resolver: ProfileStorageResolver;

  beforeEach(() => {
    resolver = new ProfileStorageResolver();
  });

  it('should resolve valid storageKey inside root directory', () => {
    const key = 'profile_test_123';
    const path = resolver.resolvePath(key);
    expect(path).toContain('profiles');
    expect(path.endsWith(key)).toBe(true);
  });

  it('should block storageKey containing path traversal operators', () => {
    expect(() => resolver.resolvePath('../outside')).toThrow('STORAGE_KEY_INVALID_CHARACTERS');
    expect(() => resolver.resolvePath('sub/dir')).toThrow('STORAGE_KEY_INVALID_CHARACTERS');
    expect(() => resolver.resolvePath('sub\\dir')).toThrow('STORAGE_KEY_INVALID_CHARACTERS');
  });

  it('should throw error for empty or invalid key', () => {
    expect(() => resolver.resolvePath('')).toThrow('INVALID_STORAGE_KEY');
  });
});
