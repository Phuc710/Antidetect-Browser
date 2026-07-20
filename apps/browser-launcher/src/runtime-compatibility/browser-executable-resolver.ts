import { stat } from 'node:fs/promises';
import path from 'node:path';

import type { BrowserRuntimeDescriptor } from './browser-runtime-descriptor.js';
import { BrowserRuntimeError } from './runtime-errors.js';
import type { RuntimeManifestEntry } from './runtime-manifest-reader.js';

export interface ResolvedBrowserRuntime {
    readonly descriptor: BrowserRuntimeDescriptor;
    readonly executablePath: string;
}

export type ManifestIndexMap = Map<
    string,
    Map<string, Map<string, RuntimeManifestEntry>>
>;

export class BrowserExecutableResolver {
    constructor(
        private readonly runtimeRoot: string,
        private readonly manifestIndex: ManifestIndexMap,
    ) {}

    async resolve(
        descriptor: BrowserRuntimeDescriptor,
    ): Promise<ResolvedBrowserRuntime> {
        const hostPlatform = process.platform; // 'win32' | 'darwin' | 'linux'

        // 1. Get matches for logical key: engine:distribution:channel:version
        const key = `${descriptor.engine}:${descriptor.distribution}:${descriptor.channel}:${descriptor.browserVersion}`;
        let platformMap = this.manifestIndex.get(key);

        if (!platformMap) {
            // Fallback 1: Try to look for 'latest' version of the same engine, distribution, and channel
            const fallbackKey = `${descriptor.engine}:${descriptor.distribution}:${descriptor.channel}:latest`;
            platformMap = this.manifestIndex.get(fallbackKey);
        }

        if (!platformMap) {
            // Fallback 2: Try to look for ANY registered version matching the same engine, distribution, and channel
            const prefix = `${descriptor.engine}:${descriptor.distribution}:${descriptor.channel}:`;
            for (const [mk, map] of this.manifestIndex.entries()) {
                if (mk.startsWith(prefix)) {
                    platformMap = map;
                    break;
                }
            }
        }

        if (!platformMap) {
            throw new BrowserRuntimeError(
                'RUNTIME_NOT_REGISTERED',
                `No registered runtime matches the descriptor: ${descriptor.engine}/${descriptor.distribution}/${descriptor.channel}/${descriptor.browserVersion}`,
            );
        }

        // 2. Get matches for host platform
        const archMap = platformMap.get(hostPlatform);
        if (!archMap) {
            throw new BrowserRuntimeError(
                'PLATFORM_MISMATCH',
                `Runtime ${descriptor.engine}/${descriptor.distribution}/${descriptor.browserVersion} is not available for platform ${hostPlatform}.`,
            );
        }

        // 3. Get matches for target architecture
        const entry = archMap.get(descriptor.architecture);
        if (!entry) {
            const availableArchitectures = Array.from(archMap.keys());
            throw new BrowserRuntimeError(
                'ARCHITECTURE_MISMATCH',
                `Runtime ${descriptor.engine}/${descriptor.distribution}/${descriptor.browserVersion} on platform ${hostPlatform} does not support architecture ${descriptor.architecture}.`,
                {
                    hostArchitecture: hostPlatform,
                    requestedArchitecture: descriptor.architecture,
                    availableArchitectures,
                },
            );
        }

        // 4. Resolve path under configured runtime root and reject path traversal
        const resolvedPath = path.resolve(
            this.runtimeRoot,
            entry.relativeExecutablePath,
        );
        const relative = path.relative(this.runtimeRoot, resolvedPath);

        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new BrowserRuntimeError(
                'PATH_TRAVERSAL_DETECTED',
                `Path traversal detected for relative path: ${entry.relativeExecutablePath}`,
            );
        }

        // 5. Verify file type and readability using stat
        let fileStat;
        try {
            fileStat = await stat(resolvedPath);
        } catch {
            throw new BrowserRuntimeError(
                'EXECUTABLE_MISSING',
                `Executable file not found at resolved path: ${resolvedPath}`,
            );
        }

        if (!fileStat.isFile()) {
            throw new BrowserRuntimeError(
                'EXECUTABLE_INVALID',
                `Path is not a regular file: ${resolvedPath}`,
            );
        }

        // On Unix platforms, verify the file has executable permissions
        if (hostPlatform !== 'win32') {
            // eslint-disable-next-line no-bitwise
            const isExecutable = (fileStat.mode & 0o111) !== 0;
            if (!isExecutable) {
                throw new BrowserRuntimeError(
                    'EXECUTABLE_INVALID',
                    `File is not executable (missing execution permissions): ${resolvedPath}`,
                );
            }
        }

        return {
            descriptor,
            executablePath: resolvedPath,
        };
    }
}
