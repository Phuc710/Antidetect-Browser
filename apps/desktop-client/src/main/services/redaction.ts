const SENSITIVE_KEY_PATTERN = /(authorization|password|passwd|credential|token|api[-_]?key|secret|cookie)/i;
const FINGERPRINT_SECRET_KEYS = new Set([
  'payload',
  'signature',
  'signedEnvelopeJson',
  'signed_envelope_json',
  'fingerprintPayload',
  'fingerprint_payload',
]);
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_CREDENTIAL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@]+)@/gi;

export const REDACTED_VALUE = '[REDACTED]';

export function redactText(value: string): string {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(URL_CREDENTIAL_PATTERN, `$1${REDACTED_VALUE}@`);
}

export function redactSecrets(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, seen));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    clean[key] = SENSITIVE_KEY_PATTERN.test(key) || FINGERPRINT_SECRET_KEYS.has(key)
      ? REDACTED_VALUE
      : redactSecrets(item, seen);
  }
  return clean;
}
