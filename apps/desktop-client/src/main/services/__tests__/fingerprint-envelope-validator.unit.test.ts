import { describe, expect, it } from 'vitest';
import {
  TEST_FINGERPRINT_KEY_ID,
  TEST_FINGERPRINT_PUBLIC_KEY,
  signedFingerprintFixture,
} from '../../../../test/fixtures/fingerprint/signed-fingerprint-fixture.js';
import {
  FingerprintEnvelopeValidator,
  canonicalizeFingerprintValue,
} from '../fingerprint-envelope-validator.js';

const NOW = new Date('2026-01-01T00:30:00.000Z');

function validator(mode: 'test' | 'production' = 'test'): FingerprintEnvelopeValidator {
  return new FingerprintEnvelopeValidator(
    mode === 'production' ? {} : { [TEST_FINGERPRINT_KEY_ID]: TEST_FINGERPRINT_PUBLIC_KEY },
    mode,
    () => NOW,
  );
}

describe('FingerprintEnvelopeValidator', () => {
  it('uses RFC 8785 canonical key and number ordering', () => {
    expect(canonicalizeFingerprintValue({
      numbers: [Number('333333333.33333329'), 1E30, 4.50, 2e-3, 1e-27],
      string: '€$\u000f\nA\'B"\\"/',
      literals: [null, true, false],
    })).toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\"/"}');
  });

  it('accepts a valid signature independent of object insertion order', () => {
    const signed = signedFingerprintFixture();
    const reordered = Object.fromEntries(Object.entries(signed).reverse());
    expect(validator().validate(reordered, {
      targetEngine: 'chromium', targetOs: 'windows', runtimeVersion: '126.4.2',
    }).fingerprintId).toBe('fp-fixture');
  });

  it('rejects tampering, unknown keys, and test keys in production', () => {
    const signed = signedFingerprintFixture();
    expect(() => validator().validate({ ...signed, datasetVersion: 'tampered' }, {
      targetEngine: 'chromium', targetOs: 'windows', runtimeVersion: '126.4.2',
    })).toThrow(expect.objectContaining({ code: 'FINGERPRINT_INTEGRITY_INVALID' }));
    expect(() => new FingerprintEnvelopeValidator({}, 'test', () => NOW)
      .parseAndVerifySignature(signed)).toThrow(expect.objectContaining({
      code: 'FINGERPRINT_INTEGRITY_INVALID',
    }));
    expect(() => validator('production').parseAndVerifySignature(signed)).toThrow(
      expect.objectContaining({ code: 'FINGERPRINT_INTEGRITY_INVALID' }),
    );
  });

  it('rejects a production public-key bundle containing a test key ID', () => {
    expect(() => new FingerprintEnvelopeValidator(
      { [TEST_FINGERPRINT_KEY_ID]: TEST_FINGERPRINT_PUBLIC_KEY },
      'production',
      () => NOW,
    )).toThrow(expect.objectContaining({ code: 'FINGERPRINT_INTEGRITY_INVALID' }));
  });

  it.each([
    [
      signedFingerprintFixture({ generatedAt: '2026-01-01T00:36:00.000Z', expiresAt: '2026-01-01T01:00:00.000Z' }),
      'FINGERPRINT_TIMESTAMP_INVALID',
    ],
    [
      signedFingerprintFixture({ generatedAt: '2025-12-30T00:00:00.000Z', expiresAt: '2025-12-31T00:00:00.000Z' }),
      'FINGERPRINT_EXPIRED',
    ],
    [
      signedFingerprintFixture({ generatedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-02T00:00:00.001Z' }),
      'FINGERPRINT_TIMESTAMP_INVALID',
    ],
  ])('rejects invalid freshness boundaries', (envelope, code) => {
    expect(() => validator().validate(envelope, {
      targetEngine: 'chromium', targetOs: 'windows', runtimeVersion: '126.4.2',
    })).toThrow(expect.objectContaining({ code }));
  });

  it.each([
    [{ targetEngine: 'firefox' as const, targetOs: 'windows' as const, runtimeVersion: '126.4.2' }, 'FINGERPRINT_ENGINE_MISMATCH'],
    [{ targetEngine: 'chromium' as const, targetOs: 'linux' as const, runtimeVersion: '126.4.2' }, 'FINGERPRINT_OS_MISMATCH'],
    [{ targetEngine: 'chromium' as const, targetOs: 'windows' as const, runtimeVersion: '127.0.0' }, 'FINGERPRINT_RUNTIME_INCOMPATIBLE'],
    [{ targetEngine: 'chromium' as const, targetOs: 'windows' as const, runtimeVersion: 'latest' }, 'FINGERPRINT_RUNTIME_INCOMPATIBLE'],
  ])('rejects incompatible runtime context', (context, code) => {
    expect(() => validator().validate(signedFingerprintFixture(), context)).toThrow(
      expect.objectContaining({ code }),
    );
  });
});
