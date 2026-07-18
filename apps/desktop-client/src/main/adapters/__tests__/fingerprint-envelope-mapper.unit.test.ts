import { FingerprintGenerator } from 'fingerprint-generator';
import { describe, expect, it } from 'vitest';
import { signedFingerprintFixture } from '../../../../test/fixtures/fingerprint/signed-fingerprint-fixture.js';
import { mapFingerprintEnvelope } from '../fingerprint-envelope-mapper.js';

describe('fingerprint envelope mapper', () => {
  it('maps the data-only DTO to the workspace package contract without generating a second fingerprint', () => {
    const generated = new FingerprintGenerator().getFingerprint({
      browsers: ['chrome'], operatingSystems: ['windows'], devices: ['desktop'], locales: ['en-US'],
    });
    const prepared = mapFingerprintEnvelope(signedFingerprintFixture({}, {
      fingerprint: { ...generated.fingerprint },
      headers: {
        ...generated.headers,
        accept: 'filtered',
        te: 'filtered-for-chromium',
        'x-test-header': 'preserved',
      },
    }));

    expect(prepared.fingerprintWithHeaders.headers).toMatchObject({
      accept: 'filtered',
      te: 'filtered-for-chromium',
      'x-test-header': 'preserved',
    });
    expect(prepared.fingerprintWithHeaders.fingerprint.navigator.userAgent)
      .toBe(generated.fingerprint.navigator.userAgent);
    expect(prepared.markerScript).toContain('__fingerprintVersion');
    expect(prepared.readiness.userAgent).toBe(generated.fingerprint.navigator.userAgent);
  });

  it('rejects structurally incomplete payloads before a process can start', () => {
    expect(() => mapFingerprintEnvelope(signedFingerprintFixture()))
      .toThrow(expect.objectContaining({ code: 'FINGERPRINT_SCHEMA_UNSUPPORTED' }));
  });
});
