import { describe, expect, it } from 'vitest';
import {
  TEST_FINGERPRINT_KEY_ID,
  TEST_FINGERPRINT_PRIVATE_KEY,
  TEST_FINGERPRINT_PUBLIC_KEY,
  signedFingerprintFixture,
} from '../../test/signed-fingerprint-fixture.js';
import { FingerprintEnvelopeValidator } from '../fingerprint-envelope-validator.js';
import {
  CloudFingerprintProvider,
  DevelopmentFingerprintProvider,
  FingerprintTransportError,
  createFingerprintProvider,
} from '../fingerprint-provider.js';

const now = () => new Date('2026-01-01T00:30:00.000Z');
const signingMaterial = {
  keyId: TEST_FINGERPRINT_KEY_ID,
  privateKey: TEST_FINGERPRINT_PRIVATE_KEY,
  publicKey: TEST_FINGERPRINT_PUBLIC_KEY,
};

function testValidator(): FingerprintEnvelopeValidator {
  return new FingerprintEnvelopeValidator(
    { [TEST_FINGERPRINT_KEY_ID]: TEST_FINGERPRINT_PUBLIC_KEY },
    'test',
    now,
  );
}

describe('fingerprint provider selection and error mapping', () => {
  it('selects cloud in production and local generation outside production', () => {
    const validator = testValidator();
    const transport = { async post() { return signedFingerprintFixture(); } };
    expect(createFingerprintProvider({ mode: 'production', validator, cloudTransport: transport }))
      .toBeInstanceOf(CloudFingerprintProvider);
    expect(createFingerprintProvider({
      mode: 'test', validator, developmentSigningMaterial: signingMaterial,
      developmentGenerator: { generate: () => ({ fingerprint: {}, headers: {} }) },
    })).toBeInstanceOf(DevelopmentFingerprintProvider);
  });

  it('fails closed when production cloud transport is absent', () => {
    expect(() => createFingerprintProvider({ mode: 'production', validator: testValidator() }))
      .toThrow(expect.objectContaining({ code: 'FINGERPRINT_SERVICE_UNAVAILABLE' }));
  });

  it('forbids a development provider invoked in production', async () => {
    const provider = new DevelopmentFingerprintProvider({
      mode: 'production', validator: testValidator(), signingMaterial,
      generator: { generate: () => ({ fingerprint: {}, headers: {} }) }, now,
    });
    await expect(provider.getVerifiedEnvelope({
      profileId: 'profile-1', targetEngine: 'chromium', targetOs: 'windows',
    })).rejects.toMatchObject({ code: 'LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION' });
  });

  it.each([
    [new FingerprintTransportError(undefined, 'offline'), 'FINGERPRINT_SERVICE_UNAVAILABLE'],
    [new FingerprintTransportError(404, 'missing'), 'FINGERPRINT_MISSING'],
    [new FingerprintTransportError(422, 'rejected'), 'FINGERPRINT_SCHEMA_UNSUPPORTED'],
  ])('maps cloud transport errors without returning raw transport details', async (transportError, code) => {
    const provider = new CloudFingerprintProvider(
      { async post() { throw transportError; } },
      testValidator(),
    );
    await expect(provider.getVerifiedEnvelope({
      profileId: 'profile-1', targetEngine: 'chromium', targetOs: 'windows',
    })).rejects.toMatchObject({ code });
  });
});
