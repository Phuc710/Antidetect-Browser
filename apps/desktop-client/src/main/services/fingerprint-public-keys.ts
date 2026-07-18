import type { FingerprintPublicKeyBundle } from './fingerprint-envelope-validator.js';

/**
 * Production keys are intentionally empty until the Cloud trust bootstrap in
 * RFC-0027A supplies owner-approved Ed25519 public keys. Production startup
 * therefore fails closed instead of accepting a development key.
 */
export const PRODUCTION_FINGERPRINT_PUBLIC_KEYS: FingerprintPublicKeyBundle = Object.freeze({});
