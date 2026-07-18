import {
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
  type KeyLike,
} from 'crypto';
import canonicalize from 'canonicalize';
import { satisfies, valid } from 'semver';
import type {
  FingerprintEnvelope,
  FingerprintErrorCode,
  FingerprintTargetEngine,
  FingerprintTargetOs,
  UnsignedFingerprintEnvelope,
} from 'shared';

const CLOCK_SKEW_MS = 5 * 60 * 1_000;
const MAX_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const ED25519_SIGNATURE_BYTES = 64;
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type ApplicationMode = 'production' | 'development' | 'test' | 'integration_test';
export type FingerprintPublicKeyBundle = Readonly<Record<string, string>>;

export interface FingerprintEnvelopeValidationContext {
  readonly targetEngine: FingerprintTargetEngine;
  readonly targetOs: FingerprintTargetOs;
  readonly runtimeVersion?: string;
}

export class FingerprintPipelineError extends Error {
  constructor(
    public readonly code: FingerprintErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FingerprintPipelineError';
  }
}

function fail(code: FingerprintErrorCode, message: string, cause?: unknown): never {
  throw new FingerprintPipelineError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  code: FingerprintErrorCode = 'FINGERPRINT_SCHEMA_UNSUPPORTED',
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    return fail(code, `Fingerprint envelope field ${key} must be a non-empty string.`);
  }
  return value;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint headers must be an object.');
  }
  const entries: Array<[string, string]> = [];
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') {
      return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', `Fingerprint header ${key} must be a string.`);
    }
    entries.push([key, item]);
  }
  return Object.fromEntries(entries);
}

function parseOptionalCoherence(value: unknown): FingerprintEnvelope['coherence'] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint coherence must be an object.');
  }
  return {
    locale: requiredString(value, 'locale'),
    timezone: requiredString(value, 'timezone'),
    acceptLanguage: requiredString(value, 'acceptLanguage'),
  };
}

export function parseFingerprintEnvelope(value: unknown): FingerprintEnvelope {
  if (!isRecord(value)) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint envelope must be an object.');
  }
  if (value['schemaVersion'] !== 2) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Unsupported fingerprint schema version.');
  }

  const signatureValue = value['signature'];
  if (!isRecord(signatureValue)) {
    return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signature is missing.');
  }
  if (signatureValue['algorithm'] !== 'ed25519') {
    return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signature algorithm is invalid.');
  }
  const signature = {
    algorithm: 'ed25519' as const,
    keyId: requiredString(signatureValue, 'keyId', 'FINGERPRINT_INTEGRITY_INVALID'),
    value: requiredString(signatureValue, 'value', 'FINGERPRINT_INTEGRITY_INVALID'),
  };

  const targetEngine = value['targetEngine'];
  if (targetEngine !== 'chromium' && targetEngine !== 'firefox') {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint target engine is invalid.');
  }
  const targetOs = value['targetOs'];
  if (targetOs !== 'windows' && targetOs !== 'mac' && targetOs !== 'linux') {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint target OS is invalid.');
  }
  const payloadValue = value['payload'];
  if (!isRecord(payloadValue) || !isRecord(payloadValue['fingerprint'])) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint payload is invalid.');
  }

  const coherence = parseOptionalCoherence(value['coherence']);
  const cloudRevision = value['cloudRevision'];
  if (cloudRevision !== undefined && (typeof cloudRevision !== 'string' || cloudRevision.length === 0)) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Cloud revision must be a non-empty string.');
  }

  return {
    schemaVersion: 2,
    fingerprintId: requiredString(value, 'fingerprintId'),
    generatorVersion: requiredString(value, 'generatorVersion'),
    datasetVersion: requiredString(value, 'datasetVersion'),
    targetEngine,
    targetOs,
    compatibleRuntimeRange: requiredString(value, 'compatibleRuntimeRange'),
    generatedAt: requiredString(value, 'generatedAt', 'FINGERPRINT_TIMESTAMP_INVALID'),
    expiresAt: requiredString(value, 'expiresAt', 'FINGERPRINT_TIMESTAMP_INVALID'),
    payload: {
      fingerprint: payloadValue['fingerprint'],
      headers: stringRecord(payloadValue['headers']),
    },
    ...(coherence ? { coherence } : {}),
    signature,
    ...(typeof cloudRevision === 'string' ? { cloudRevision } : {}),
  };
}

export function canonicalizeFingerprintValue(value: unknown): string {
  try {
    const result = canonicalize(value);
    if (result === undefined) {
      return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint value cannot be canonicalized.');
    }
    return result;
  } catch (error: unknown) {
    return fail('FINGERPRINT_SCHEMA_UNSUPPORTED', 'Fingerprint value cannot be canonicalized.', error);
  }
}

export function buildFingerprintSignatureInput(
  envelope: FingerprintEnvelope | UnsignedFingerprintEnvelope,
): Uint8Array {
  const unsigned = 'signature' in envelope
    ? Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== 'signature'))
    : envelope;
  return Buffer.from(canonicalizeFingerprintValue(unsigned), 'utf8');
}

export function signFingerprintEnvelope(
  envelope: UnsignedFingerprintEnvelope,
  keyId: string,
  privateKey: KeyLike,
): FingerprintEnvelope {
  const signature = signBytes(null, buildFingerprintSignatureInput(envelope), privateKey);
  return {
    ...envelope,
    signature: {
      algorithm: 'ed25519',
      keyId,
      value: signature.toString('base64url'),
    },
  };
}

function decodeBase64Url(value: string, expectedBytes: number): Buffer {
  if (!BASE64URL_PATTERN.test(value)) {
    return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signature encoding is invalid.');
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length !== expectedBytes) {
    return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signature length is invalid.');
  }
  return decoded;
}

function parseTimestamp(value: string): number {
  if (!ISO_UTC_PATTERN.test(value)) {
    return fail('FINGERPRINT_TIMESTAMP_INVALID', 'Fingerprint timestamp must be ISO-8601 UTC.');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fail('FINGERPRINT_TIMESTAMP_INVALID', 'Fingerprint timestamp is invalid.');
  }
  return parsed;
}

function normalizeRuntimeVersion(value: string): string | undefined {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(value.trim());
  if (!match) return undefined;
  const normalized = `${match[1]}.${match[2]}.${match[3] ?? '0'}`;
  return valid(normalized) ?? undefined;
}

function normalizeRuntimeRange(value: string): string {
  return value.replace(/(\d+)\.(\d+)\.(\d+)\.\d+/g, '$1.$2.$3');
}

export class FingerprintEnvelopeValidator {
  constructor(
    private readonly publicKeys: FingerprintPublicKeyBundle,
    private readonly mode: ApplicationMode,
    private readonly now: () => Date = () => new Date(),
  ) {}

  parseAndVerifySignature(value: unknown): FingerprintEnvelope {
    const envelope = parseFingerprintEnvelope(value);
    this.verifySignature(envelope);
    return envelope;
  }

  validate(
    value: unknown,
    context: FingerprintEnvelopeValidationContext,
  ): FingerprintEnvelope {
    const envelope = this.parseAndVerifySignature(value);
    this.validateTimestampsAndExpiry(envelope);

    if (envelope.targetEngine !== context.targetEngine) {
      return fail('FINGERPRINT_ENGINE_MISMATCH', 'Fingerprint engine does not match the profile.');
    }
    if (envelope.targetOs !== context.targetOs) {
      return fail('FINGERPRINT_OS_MISMATCH', 'Fingerprint OS does not match the profile.');
    }
    if (!context.runtimeVersion || context.runtimeVersion === 'latest') {
      const range = normalizeRuntimeRange(envelope.compatibleRuntimeRange).trim();
      if (range !== '*' && range !== '>=0' && range !== '>=0.0.0') {
        return fail(
          'FINGERPRINT_RUNTIME_INCOMPATIBLE',
          'Selected browser runtime version is not resolved.',
        );
      }
    } else {
      const runtimeVersion = normalizeRuntimeVersion(context.runtimeVersion);
      const range = normalizeRuntimeRange(envelope.compatibleRuntimeRange);
      if (!runtimeVersion || !satisfies(runtimeVersion, range, { includePrerelease: true })) {
        return fail(
          'FINGERPRINT_RUNTIME_INCOMPATIBLE',
          'Fingerprint is incompatible with the selected browser runtime.',
        );
      }
    }
    return envelope;
  }

  private verifySignature(envelope: FingerprintEnvelope): void {
    if (this.mode === 'production' && envelope.signature.keyId.startsWith('test:')) {
      return fail('FINGERPRINT_INTEGRITY_INVALID', 'Test fingerprint keys are forbidden in production.');
    }
    const encodedPublicKey = this.publicKeys[envelope.signature.keyId];
    if (!encodedPublicKey) {
      return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signing key is unknown.');
    }
    const rawPublicKey = decodeBase64Url(encodedPublicKey, ED25519_PUBLIC_KEY_BYTES);
    const signature = decodeBase64Url(envelope.signature.value, ED25519_SIGNATURE_BYTES);
    try {
      const publicKey = createPublicKey({
        key: Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]),
        format: 'der',
        type: 'spki',
      });
      if (!verifyBytes(null, buildFingerprintSignatureInput(envelope), publicKey, signature)) {
        return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signature verification failed.');
      }
    } catch (error: unknown) {
      if (error instanceof FingerprintPipelineError) throw error;
      return fail('FINGERPRINT_INTEGRITY_INVALID', 'Fingerprint signature verification failed.', error);
    }
  }

  private validateTimestampsAndExpiry(envelope: FingerprintEnvelope): void {
    const generatedAt = parseTimestamp(envelope.generatedAt);
    const expiresAt = parseTimestamp(envelope.expiresAt);
    const now = this.now().getTime();
    if (generatedAt > now + CLOCK_SKEW_MS) {
      return fail('FINGERPRINT_TIMESTAMP_INVALID', 'Fingerprint generation time is in the future.');
    }
    if (expiresAt <= generatedAt) {
      return fail('FINGERPRINT_TIMESTAMP_INVALID', 'Fingerprint lifetime must be positive.');
    }
    if (expiresAt - generatedAt > MAX_LIFETIME_MS) {
      return fail('FINGERPRINT_TIMESTAMP_INVALID', 'Fingerprint lifetime exceeds 24 hours.');
    }
    if (expiresAt + CLOCK_SKEW_MS <= now) {
      return fail('FINGERPRINT_EXPIRED', 'Fingerprint envelope has expired.');
    }
  }
}
