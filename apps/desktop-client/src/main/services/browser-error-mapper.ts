export interface SafeBrowserFailure {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
}

const FAILURES: Readonly<Record<string, Omit<SafeBrowserFailure, 'code'>>> = Object.freeze({
  NOT_FOUND: { message: 'Profile not found.', httpStatus: 404 },
  VERSION_CONFLICT: { message: 'Profile was updated by another operation.', httpStatus: 409 },
  PROFILE_ALREADY_RUNNING: { message: 'Profile is already running.', httpStatus: 409 },
  PROFILE_RUNNING: { message: 'A running profile cannot be deleted.', httpStatus: 409 },
  PROFILE_LOCK_CORRUPT: { message: 'The local profile lock requires recovery.', httpStatus: 409 },
  BROWSER_ARCHITECTURE_MISMATCH: { message: 'The configured browser architecture is unavailable.', httpStatus: 422 },
  BROWSER_ENGINE_UNAVAILABLE: { message: 'The configured browser engine is unavailable.', httpStatus: 422 },
  BROWSER_DISTRIBUTION_UNAVAILABLE: { message: 'The configured browser distribution is unavailable.', httpStatus: 422 },
  BROWSER_AUTOMATION_PROTOCOL_UNAVAILABLE: { message: 'The requested automation protocol is unavailable.', httpStatus: 422 },
  SESSION_NOT_FOUND: { message: 'Browser session not found.', httpStatus: 404 },
  LAUNCH_FAILED: { message: 'Browser launch failed.', httpStatus: 500 },
  FINGERPRINT_SERVICE_UNAVAILABLE: { message: 'The fingerprint service is unavailable.', httpStatus: 503 },
  FINGERPRINT_MISSING: { message: 'No fingerprint is available for this profile.', httpStatus: 404 },
  FINGERPRINT_SCHEMA_UNSUPPORTED: { message: 'The fingerprint format is unsupported.', httpStatus: 422 },
  FINGERPRINT_INTEGRITY_INVALID: { message: 'Fingerprint integrity validation failed.', httpStatus: 422 },
  FINGERPRINT_TIMESTAMP_INVALID: { message: 'The fingerprint timestamps are invalid.', httpStatus: 422 },
  FINGERPRINT_EXPIRED: { message: 'The fingerprint has expired.', httpStatus: 422 },
  FINGERPRINT_ENGINE_MISMATCH: { message: 'The fingerprint does not match the browser engine.', httpStatus: 422 },
  FINGERPRINT_OS_MISMATCH: { message: 'The fingerprint does not match the profile operating system.', httpStatus: 422 },
  FINGERPRINT_RUNTIME_INCOMPATIBLE: { message: 'The fingerprint is incompatible with the browser runtime.', httpStatus: 422 },
  FINGERPRINT_INJECTION_FAILED: { message: 'Fingerprint injection failed.', httpStatus: 500 },
  FINGERPRINT_READINESS_FAILED: { message: 'Fingerprint readiness verification failed.', httpStatus: 500 },
  LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION: { message: 'The production fingerprint provider is misconfigured.', httpStatus: 500 },
});

export function safeBrowserFailure(error: unknown): SafeBrowserFailure {
  const candidate = error instanceof Error && 'code' in error
    ? String((error as Error & { code?: unknown }).code ?? 'INTERNAL_ERROR')
    : 'INTERNAL_ERROR';
  const known = FAILURES[candidate];
  if (!known) {
    console.error('[safeBrowserFailure] Unknown or unmapped error caught:', error);
    const isDev = process.env.NODE_ENV === 'development';
    return {
      code: 'INTERNAL_ERROR',
      message: isDev && error instanceof Error
        ? `${error.message}${ (error as any).stage ? ` (at stage: ${(error as any).stage})` : '' }`
        : 'The operation could not be completed.',
      httpStatus: 500
    };
  }
  return { code: candidate, ...known };
}
