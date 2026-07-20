export type RuntimeErrorCode =
    | 'MANIFEST_INVALID'
    | 'RUNTIME_NOT_REGISTERED'
    | 'EXECUTABLE_MISSING'
    | 'PATH_TRAVERSAL_DETECTED'
    | 'PLATFORM_MISMATCH'
    | 'ARCHITECTURE_MISMATCH'
    | 'VERSION_MISMATCH'
    | 'VERSION_UNDETECTABLE'
    | 'VERSION_CHECK_TIMEOUT'
    | 'EXECUTABLE_START_FAILED'
    | 'EXECUTABLE_INVALID'
    | 'ARCHITECTURE_UNSUPPORTED';

export class BrowserRuntimeError extends Error {
    constructor(
        public readonly code: RuntimeErrorCode,
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'BrowserRuntimeError';
        Object.setPrototypeOf(this, BrowserRuntimeError.prototype);
    }
}
