import { describe, expect, it } from 'vitest';
import { FingerprintPipelineError } from '../fingerprint-envelope-validator.js';
import { safeBrowserFailure } from '../browser-error-mapper.js';

describe('safe browser error mapping', () => {
  it.each([
    ['FINGERPRINT_SERVICE_UNAVAILABLE', 503],
    ['FINGERPRINT_MISSING', 404],
    ['FINGERPRINT_INTEGRITY_INVALID', 422],
    ['FINGERPRINT_INJECTION_FAILED', 500],
    ['FINGERPRINT_READINESS_FAILED', 500],
  ] as const)('preserves the safe fingerprint code %s', (code, httpStatus) => {
    const failure = safeBrowserFailure(new FingerprintPipelineError(code, 'raw secret payload'));
    expect(failure).toMatchObject({ code, httpStatus });
    expect(failure.message).not.toContain('raw secret payload');
  });

  it('does not reflect unknown raw errors', () => {
    expect(safeBrowserFailure(new Error('secret runtime path'))).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'The operation could not be completed.',
      httpStatus: 500,
    });
  });
});
