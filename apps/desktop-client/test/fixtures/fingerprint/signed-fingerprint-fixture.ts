import type { KeyLike } from 'crypto';
import type { FingerprintEnvelope, FingerprintPayloadDto, UnsignedFingerprintEnvelope } from 'shared';
import { signFingerprintEnvelope } from '../../../src/main/services/fingerprint-envelope-validator.js';

export const TEST_FINGERPRINT_KEY_ID = 'test:fixture';
export const TEST_FINGERPRINT_PUBLIC_KEY = 'FzpyxFC8kLGH55_hkcHCw-bcdyp1FXv9bWziJkVoFVo';
export const TEST_FINGERPRINT_PRIVATE_KEY: KeyLike = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIP5vf28euky0KYp5pA+TZIGMuazSNSNs+tWWWMFexHb4
-----END PRIVATE KEY-----`;

export function signedFingerprintFixture(
  overrides: Partial<UnsignedFingerprintEnvelope> = {},
  payload: FingerprintPayloadDto = { fingerprint: {}, headers: {} },
): FingerprintEnvelope {
  const unsigned: UnsignedFingerprintEnvelope = {
    schemaVersion: 2,
    fingerprintId: 'fp-fixture',
    generatorVersion: '2.1.83-test',
    datasetVersion: 'fixture-v1',
    targetEngine: 'chromium',
    targetOs: 'windows',
    compatibleRuntimeRange: '>=126.0.0 <127.0.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T01:00:00.000Z',
    payload,
    ...overrides,
  };
  return signFingerprintEnvelope(unsigned, TEST_FINGERPRINT_KEY_ID, TEST_FINGERPRINT_PRIVATE_KEY);
}
