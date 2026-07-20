import { stat } from 'node:fs/promises';
import path from 'node:path';

import type { BrowserRuntimeDescriptor } from './browser-runtime-descriptor.js';
import { BrowserRuntimeError } from './runtime-errors.js';
import type { RuntimeManifest } from './runtime-manifest-reader.js';

export interface ResolvedBrowserRuntime {
  readonly descriptor: BrowserRuntimeDescriptor;
  readonly executablePath: string;
}

export class BrowserExecutableResolver {
  constructor(
    private readonly runtimeRoot: string,
    private readonly manifest: RuntimeManifest,
  ) {}

  async resolve(descriptor: BrowserRuntimeDescriptor): Promise<ResolvedBrowserRuntime> {
    const hostPlatform = process.platform; // 'win32' | 'darwin' | 'linux'

    // 1. Check if ANY runtime exists with matching logical descriptor: engine, distribution, channel, version
    const logicalMatches = this.manifest.runtimes.filter((r) =>
      r.engine === descriptor.engine &&
      r.distribution === descriptor.distribution &&
      r.channel === descriptor.channel &&
      r.version === descriptor.browserVersion
    );

    if (logicalMatches.length === 0) {
      throw new BrowserRuntimeError(
        'RUNTIME_NOT_REGISTERED',
        `No registered runtime matches the descriptor: ${descriptor.engine}/${descriptor.distribution}/${descriptor.channel}/${descriptor.browserVersion}`
      );
    }

    // 2. Check if logical match exists for current platform
    const platformMatches = logicalMatches.filter((r) => r.platform === hostPlatform);
    if (platformMatches.length === 0) {
      throw new BrowserRuntimeError(
        'PLATFORM_MISMATCH',
        `Runtime ${descriptor.engine}/${descriptor.distribution}/${descriptor.browserVersion} is not available for platform ${hostPlatform}.`
      );
    }

    // 3. Check if matching architecture exists
    const entry = platformMatches.find((r) => r.architecture === descriptor.architecture);
    if (!entry) {
      throw new BrowserRuntimeError(
        'ARCHITECTURE_MISMATCH',
        `Runtime ${descriptor.engine}/${descriptor.distribution}/${descriptor.browserVersion} on platform ${hostPlatform} does not support architecture ${descriptor.architecture}.`
      );
    }

    // 4. Resolve path under configured runtime root and reject path traversal
    const resolvedPath = path.resolve(this.runtimeRoot, entry.relativeExecutablePath);
    const relative = path.relative(this.runtimeRoot, resolvedPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BrowserRuntimeError(
        'PATH_TRAVERSAL_DETECTED',
        `Path traversal detected for relative path: ${entry.relativeExecutablePath}`
      );
    }

    // 5. Verify file type and readability using stat
    let fileStat;
    try {
      fileStat = await stat(resolvedPath);
    } catch {
      throw new BrowserRuntimeError(
        'EXECUTABLE_MISSING',
        `Executable file not found at resolved path: ${resolvedPath}`
      );
    }

    if (!fileStat.isFile()) {
      throw new BrowserRuntimeError(
        'EXECUTABLE_INVALID',
        `Path is not a regular file: ${resolvedPath}`
      );
    }

    // On Unix platforms, verify the file has executable permissions
    if (hostPlatform !== 'win32') {
      // eslint-disable-next-line no-bitwise
      const isExecutable = (fileStat.mode & 0o111) !== 0;
      if (!isExecutable) {
        throw new BrowserRuntimeError(
          'EXECUTABLE_INVALID',
          `File is not executable (missing execution permissions): ${resolvedPath}`
        );
      }
    }

    return {
      descriptor,
      executablePath: resolvedPath,
    };
  }
}
