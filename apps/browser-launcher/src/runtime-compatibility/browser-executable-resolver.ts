import path from 'path';
import fs from 'fs';
import { BrowserRuntimeDescriptor } from './browser-runtime-descriptor.js';
import { RuntimeManifest } from './runtime-manifest-reader.js';
import { BrowserRuntimeError } from './runtime-errors.js';

export interface ResolvedBrowserRuntime {
  readonly descriptor: BrowserRuntimeDescriptor;
  readonly executablePath: string;
}

export class BrowserExecutableResolver {
  constructor(
    private readonly runtimeRoot: string,
    private readonly manifest: RuntimeManifest,
  ) {}

  resolve(descriptor: BrowserRuntimeDescriptor): ResolvedBrowserRuntime {
    const hostPlatform = process.platform; // 'win32' | 'darwin' | 'linux'

    // Find matching entry in manifest
    const entry = this.manifest.runtimes.find((r) =>
      r.engine === descriptor.engine &&
      r.distribution === descriptor.distribution &&
      r.channel === descriptor.channel &&
      r.version === descriptor.browserVersion &&
      r.architecture === descriptor.architecture &&
      r.platform === hostPlatform
    );

    if (!entry) {
      throw new BrowserRuntimeError(
        'RUNTIME_NOT_REGISTERED',
        `No registered runtime matches the descriptor: ${descriptor.engine}/${descriptor.distribution}/${descriptor.channel}/${descriptor.browserVersion}/${descriptor.architecture} for platform ${hostPlatform}`
      );
    }

    // Resolve path under configured runtime root and reject path traversal
    const resolvedPath = path.resolve(this.runtimeRoot, entry.relativeExecutablePath);
    const relative = path.relative(this.runtimeRoot, resolvedPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BrowserRuntimeError(
        'PATH_TRAVERSAL_DETECTED',
        `Path traversal detected for relative path: ${entry.relativeExecutablePath}`
      );
    }

    // Verify if executable file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new BrowserRuntimeError(
        'EXECUTABLE_MISSING',
        `Executable file not found at resolved path: ${resolvedPath}`
      );
    }

    return {
      descriptor,
      executablePath: resolvedPath,
    };
  }
}
