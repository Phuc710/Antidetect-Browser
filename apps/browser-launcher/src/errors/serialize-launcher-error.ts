import type { SerializedLauncherError } from 'shared';
import { LauncherError } from './launcher-error.js';

export function serializeLauncherError(err: unknown): SerializedLauncherError {
  if (err instanceof LauncherError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    };
  }

  const error = err as any;
  return {
    code: error?.code || 'UNKNOWN_ERROR',
    message: error?.message || 'An unexpected error occurred in launcher process.',
    ...(error?.details ? { details: error.details } : {}),
  };
}
