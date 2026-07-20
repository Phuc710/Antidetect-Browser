export type RuntimeErrorCode =
  | 'MANIFEST_INVALID'
  | 'RUNTIME_NOT_REGISTERED'
  | 'EXECUTABLE_MISSING'
  | 'PATH_TRAVERSAL_DETECTED'
  | 'PLATFORM_MISMATCH'
  | 'ARCHITECTURE_MISMATCH'
  | 'VERSION_MISMATCH';

export class BrowserRuntimeError extends Error {
  constructor(
    public readonly code: RuntimeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BrowserRuntimeError';
    Object.setPrototypeOf(this, BrowserRuntimeError.prototype);
  }
}
