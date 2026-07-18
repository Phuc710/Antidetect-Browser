import { describe, expect, it } from 'vitest';
import { normalizeProfileName } from '../profile-service.js';

describe('normalizeProfileName', () => {
  it('stores a domain default instead of an empty name', () => {
    expect(normalizeProfileName(undefined)).toBe('Unnamed Profile');
    expect(normalizeProfileName('   ')).toBe('Unnamed Profile');
  });

  it('trims a supplied profile name', () => {
    expect(normalizeProfileName('  Work profile  ')).toBe('Work profile');
  });
});
