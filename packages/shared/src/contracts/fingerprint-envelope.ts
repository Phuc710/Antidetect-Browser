export const FINGERPRINT_SCHEMA_VERSION = 2 as const;

export type FingerprintTargetEngine = 'chromium' | 'firefox';
export type FingerprintTargetOs = 'windows' | 'mac' | 'linux';

/** Data-only transport boundary. Implementation package types must not leak here. */
export interface FingerprintPayloadDto {
  readonly fingerprint: Record<string, unknown>;
  readonly headers: Record<string, string>;
}

export interface FingerprintEnvelopeSignature {
  readonly algorithm: 'ed25519';
  readonly keyId: string;
  readonly value: string;
}

export interface FingerprintEnvelope {
  readonly schemaVersion: typeof FINGERPRINT_SCHEMA_VERSION;
  readonly fingerprintId: string;
  readonly generatorVersion: string;
  readonly datasetVersion: string;
  readonly targetEngine: FingerprintTargetEngine;
  readonly targetOs: FingerprintTargetOs;
  readonly compatibleRuntimeRange: string;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly payload: FingerprintPayloadDto;
  readonly coherence?: {
    readonly locale: string;
    readonly timezone: string;
    readonly acceptLanguage: string;
  };
  readonly signature: FingerprintEnvelopeSignature;
  readonly cloudRevision?: string;
}

export type UnsignedFingerprintEnvelope = Omit<FingerprintEnvelope, 'signature'>;

export const FINGERPRINT_ERROR_CODES = [
  'FINGERPRINT_SERVICE_UNAVAILABLE',
  'FINGERPRINT_MISSING',
  'FINGERPRINT_SCHEMA_UNSUPPORTED',
  'FINGERPRINT_INTEGRITY_INVALID',
  'FINGERPRINT_TIMESTAMP_INVALID',
  'FINGERPRINT_EXPIRED',
  'FINGERPRINT_ENGINE_MISMATCH',
  'FINGERPRINT_OS_MISMATCH',
  'FINGERPRINT_RUNTIME_INCOMPATIBLE',
  'FINGERPRINT_INJECTION_FAILED',
  'FINGERPRINT_READINESS_FAILED',
  'LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION',
] as const;

export type FingerprintErrorCode = (typeof FINGERPRINT_ERROR_CODES)[number];
