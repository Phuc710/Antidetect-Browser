import type { LauncherErrorCode } from 'shared';

export class LauncherError extends Error {
    constructor(
        public readonly code: LauncherErrorCode,
        message: string,
        public readonly details?: Record<string, unknown> | undefined,
    ) {
        super(message);
        this.name = 'LauncherError';
        Object.setPrototypeOf(this, LauncherError.prototype);
    }

    static invalidCommand(
        message: string,
        details?: Record<string, unknown>,
    ): LauncherError {
        return new LauncherError('INVALID_COMMAND', message, details);
    }

    static profileAlreadyRunning(profileId: string): LauncherError {
        return new LauncherError(
            'PROFILE_ALREADY_RUNNING',
            `Profile ${profileId} is already running.`,
        );
    }

    static profileLocked(profileId: string): LauncherError {
        return new LauncherError(
            'PROFILE_LOCKED',
            `Profile ${profileId} directory is locked.`,
        );
    }

    static browserLaunchFailed(
        message: string,
        details?: Record<string, unknown>,
    ): LauncherError {
        return new LauncherError('BROWSER_LAUNCH_FAILED', message, details);
    }

    static browserStopFailed(
        message: string,
        details?: Record<string, unknown>,
    ): LauncherError {
        return new LauncherError('BROWSER_STOP_FAILED', message, details);
    }

    static sessionNotFound(sessionId: string): LauncherError {
        return new LauncherError(
            'BROWSER_STOP_FAILED',
            `Session ${sessionId} was not found.`,
        );
    }

    static readinessFailed(details?: Record<string, unknown>): LauncherError {
        return new LauncherError(
            'BROWSER_LAUNCH_FAILED',
            'Fingerprint readiness verification failed.',
            details,
        );
    }
}
