import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
    BrowserChannel,
    BrowserDistribution,
    BrowserEngine,
} from 'shared';

import { BrowserRuntimeError } from './runtime-errors.js';

export type SupportedArchitecture = 'x64' | 'arm64';
export type SupportedPlatform = 'win32' | 'darwin' | 'linux';

export interface RuntimeManifestEntry {
    readonly id: string;
    readonly engine: BrowserEngine;
    readonly distribution: BrowserDistribution;
    readonly channel: BrowserChannel;
    readonly version: string;
    readonly architecture: SupportedArchitecture;
    readonly platform: SupportedPlatform;
    readonly relativeExecutablePath: string;
}

export interface RuntimeManifest {
    readonly schemaVersion: 1;
    readonly runtimes: readonly RuntimeManifestEntry[];
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class RuntimeManifestReader {
    async read(manifestPath: string): Promise<RuntimeManifest> {
        try {
            await access(manifestPath);
        } catch {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                `Manifest file does not exist at path: ${manifestPath}`,
            );
        }

        let raw: string;
        try {
            raw = await readFile(manifestPath, 'utf8');
        } catch (err: unknown) {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                `Failed to read manifest file: ${getErrorMessage(err)}`,
            );
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (err: unknown) {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                `Manifest JSON is malformed: ${getErrorMessage(err)}`,
            );
        }

        if (!isRecord(parsed)) {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                'Manifest root must be a JSON object.',
            );
        }

        const { schemaVersion, runtimes } = parsed;

        if (schemaVersion !== 1) {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                `Unsupported schema version: ${String(schemaVersion)}`,
            );
        }

        if (!Array.isArray(runtimes)) {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                'Manifest "runtimes" must be an array.',
            );
        }

        if (runtimes.length === 0) {
            throw new BrowserRuntimeError(
                'MANIFEST_INVALID',
                'Manifest "runtimes" must not be empty.',
            );
        }

        const engines = new Set<string>(['chromium', 'firefox', 'webkit']);
        const distributions = new Set<string>([
            'chromium',
            'chrome',
            'edge',
            'brave',
            'firefox',
            'webkit',
            'custom',
        ]);
        const channels = new Set<string>([
            'stable',
            'beta',
            'dev',
            'canary',
            'custom',
        ]);
        const platforms = new Set<string>(['win32', 'darwin', 'linux']);
        const architectures = new Set<string>(['x64', 'arm64']);

        const validatedEntries: RuntimeManifestEntry[] = [];
        const seenIds = new Set<string>();
        const seenDescriptors = new Set<string>();
        const seenPaths = new Set<string>();

        for (let i = 0; i < runtimes.length; i++) {
            const entry: unknown = runtimes[i];
            if (!isRecord(entry)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}] must be an object.`,
                );
            }

            const {
                id,
                engine,
                distribution,
                channel,
                version,
                architecture,
                platform,
                relativeExecutablePath,
            } = entry;

            if (typeof id !== 'string' || !id) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].id must be a non-empty string.`,
                );
            }
            if (seenIds.has(id)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Duplicate runtime id detected: "${id}".`,
                );
            }
            seenIds.add(id);

            if (typeof engine !== 'string' || !engines.has(engine)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].engine is invalid.`,
                );
            }
            if (
                typeof distribution !== 'string' ||
                !distributions.has(distribution)
            ) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].distribution is invalid.`,
                );
            }
            if (typeof channel !== 'string' || !channels.has(channel)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].channel is invalid.`,
                );
            }
            if (typeof version !== 'string' || !version) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].version must be a non-empty string.`,
                );
            }
            if (
                typeof architecture !== 'string' ||
                !architectures.has(architecture)
            ) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].architecture is invalid.`,
                );
            }
            if (typeof platform !== 'string' || !platforms.has(platform)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].platform is invalid.`,
                );
            }
            if (
                typeof relativeExecutablePath !== 'string' ||
                !relativeExecutablePath
            ) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].relativeExecutablePath must be a non-empty string.`,
                );
            }

            // Check path safety: must be relative, cannot be absolute on posix or windows
            if (
                path.posix.isAbsolute(relativeExecutablePath) ||
                path.win32.isAbsolute(relativeExecutablePath)
            ) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Manifest entry at [${i}].relativeExecutablePath must be a relative path: "${relativeExecutablePath}".`,
                );
            }

            const descKey = `${engine}:${distribution}:${channel}:${version}:${architecture}:${platform}`;
            if (seenDescriptors.has(descKey)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Duplicate runtime descriptor detected: "${descKey}".`,
                );
            }
            seenDescriptors.add(descKey);

            if (seenPaths.has(relativeExecutablePath)) {
                throw new BrowserRuntimeError(
                    'MANIFEST_INVALID',
                    `Duplicate relative path mapping detected: "${relativeExecutablePath}".`,
                );
            }
            seenPaths.add(relativeExecutablePath);

            validatedEntries.push({
                id,
                engine: engine as BrowserEngine,
                distribution: distribution as BrowserDistribution,
                channel: channel as BrowserChannel,
                version,
                architecture: architecture as SupportedArchitecture,
                platform: platform as SupportedPlatform,
                relativeExecutablePath,
            });
        }

        return {
            schemaVersion: 1,
            runtimes: validatedEntries,
        };
    }
}
