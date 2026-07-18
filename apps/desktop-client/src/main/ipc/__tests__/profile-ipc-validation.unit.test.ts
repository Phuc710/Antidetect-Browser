import { describe, expect, it } from 'vitest';
import {
  isCreateProfileInput,
  isLaunchProfileInput,
  isListProfilesInput,
  isSessionIdInput,
  isUpdateProfileInput,
} from '../profile-ipc-validation.js';

describe('profile IPC validation', () => {
  it('accepts the separated browser runtime fields', () => {
    expect(isCreateProfileInput({
      name: 'Profile',
      os: 'windows',
      engine: 'chromium',
      distribution: 'chrome',
      channel: 'beta',
      browserVersion: '126.0.1',
      architecture: 'x64',
    })).toBe(true);
  });

  it('rejects the obsolete browser field and unknown properties', () => {
    expect(isCreateProfileInput({
      name: 'Profile',
      os: 'windows',
      browser: 'chrome',
    })).toBe(false);
    expect(isLaunchProfileInput({ profileId: 'p1', headless: 'yes' })).toBe(false);
    expect(isUpdateProfileInput({ profileId: 'p1', password: 'secret' })).toBe(false);
  });

  it('bounds list pagination and validates identifiers', () => {
    expect(isListProfilesInput({ limit: 100, offset: 0, status: 'running' })).toBe(true);
    expect(isListProfilesInput({ limit: 101 })).toBe(false);
    expect(isSessionIdInput({ sessionId: '' })).toBe(false);
  });
});
