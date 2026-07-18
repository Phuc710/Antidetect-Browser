import { describe, expect, it } from 'vitest';
import { REDACTED_VALUE, redactSecrets, redactText } from '../redaction.js';

describe('secret redaction', () => {
  it('redacts nested secret keys without deleting safe metadata', () => {
    expect(redactSecrets({
      profileId: 'profile-1',
      credentials: { username: 'user', password: 'pass' },
      nested: { apiToken: 'token', note: 'safe' },
    })).toEqual({
      profileId: 'profile-1',
      credentials: REDACTED_VALUE,
      nested: { apiToken: REDACTED_VALUE, note: 'safe' },
    });
  });

  it('redacts bearer tokens and URL credentials in free text', () => {
    const redacted = redactText('Bearer abc.def https://user:pass@example.com/path');
    expect(redacted).not.toContain('abc.def');
    expect(redacted).not.toContain('user:pass');
    expect(redacted).toContain(REDACTED_VALUE);
  });
});
