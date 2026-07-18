import { FingerprintGenerator } from 'fingerprint-generator';
import { describe, expect, it } from 'vitest';
import { signedFingerprintFixture } from '../../test/signed-fingerprint-fixture.js';
import { mapFingerprintEnvelope } from '../fingerprint-envelope-mapper.js';

describe('fingerprint envelope mapper', () => {
  it('maps the data-only DTO to the workspace injector without private Playwright state', () => {
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

    expect(prepared.headers).not.toHaveProperty('accept');
    expect(prepared.headers).not.toHaveProperty('te');
    expect(prepared.headers).toHaveProperty('x-test-header', 'preserved');
    expect(prepared.initScript).toContain('__fingerprintVersion');
    expect(prepared.initScript).toContain(generated.fingerprint.navigator.userAgent);
    expect(prepared.contextSeed).toMatchObject({
      userAgent: generated.fingerprint.navigator.userAgent,
      viewport: {
        width: generated.fingerprint.screen.width,
        height: generated.fingerprint.screen.height,
      },
      deviceScaleFactor: generated.fingerprint.screen.devicePixelRatio,
    });
  });

  it('rejects structurally incomplete payloads before a process can start', () => {
    expect(() => mapFingerprintEnvelope(signedFingerprintFixture()))
      .toThrow(expect.objectContaining({ code: 'FINGERPRINT_SCHEMA_UNSUPPORTED' }));
  });
});
