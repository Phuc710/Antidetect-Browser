import type { LauncherErrorCode, SerializedLauncherError } from 'shared';

import { LauncherError } from './launcher-error.js';

const launcherErrorCodes = new Set<string>([
    'PROFILE_ALREADY_RUNNING',
    'PROFILE_LOCKED',
    'PROFILE_NOT_FOUND',
    'PROXY_RESOLUTION_FAILED',
    'FINGERPRINT_INVALID',
    'RUNTIME_NOT_FOUND',
    'BROWSER_LAUNCH_FAILED',
    'BROWSER_STOP_FAILED',
    'LAUNCHER_NOT_READY',
    'LAUNCHER_TIMEOUT',
    'LAUNCHER_CRASHED',
    'INVALID_COMMAND',
    'UNKNOWN_ERROR',
]);

export function serializeLauncherError(err: unknown): SerializedLauncherError {
    if (err instanceof LauncherError) {
        return {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
        };
    }

    const obj =
        err && typeof err === 'object'
            ? (err as Record<string, unknown>)
            : null;

    const candidateCode = typeof obj?.code === 'string' ? obj.code : '';
    const code: LauncherErrorCode = candidateCode
        ? (candidateCode as LauncherErrorCode)
        : 'UNKNOWN_ERROR';

    const message =
        typeof obj?.message === 'string'
            ? obj.message
            : 'An unexpected error occurred in launcher process.';

    const details =
        obj?.details &&
        typeof obj.details === 'object' &&
        !Array.isArray(obj.details)
            ? (obj.details as Record<string, unknown>)
            : {};

    const mergedDetails: Record<string, unknown> = {
        ...details,
    };

    if (obj?.stage) {
        mergedDetails.stage = obj.stage;
    }
    if (obj?.stack) {
        mergedDetails.stack = String(obj.stack);
    }
    if (obj?.executablePath) {
        mergedDetails.executablePath = String(obj.executablePath);
    }

    return {
        code,
        message,
        ...(Object.keys(mergedDetails).length > 0 ? { details: mergedDetails } : {}),
    };
}
