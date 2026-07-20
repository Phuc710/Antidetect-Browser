import {
    BrowserExecutableResolver,
    type ManifestIndexMap,
    type ResolvedBrowserRuntime,
} from './browser-executable-resolver.js';
import type { BrowserRuntimeDescriptor } from './browser-runtime-descriptor.js';
import { RuntimeCompatibilityChecker } from './runtime-compatibility-checker.js';
import { BrowserRuntimeError } from './runtime-errors.js';
import {
    type RuntimeManifest,
    RuntimeManifestReader,
} from './runtime-manifest-reader.js';

type RegistryState =
    | { readonly status: 'uninitialized' }
    | {
          readonly status: 'initialized';
          readonly runtimeRoot: string;
          readonly manifestPath: string;
          readonly manifest: RuntimeManifest;
          readonly manifestIndex: ManifestIndexMap;
      };

export function buildManifestIndex(
    manifest: RuntimeManifest,
): ManifestIndexMap {
    const index: ManifestIndexMap = new Map();
    for (const entry of manifest.runtimes) {
        const key = `${entry.engine}:${entry.distribution}:${entry.channel}:${entry.version}`;

        let platformMap = index.get(key);
        if (!platformMap) {
            platformMap = new Map();
            index.set(key, platformMap);
        }

        let archMap = platformMap.get(entry.platform);
        if (!archMap) {
            archMap = new Map();
            platformMap.set(entry.platform, archMap);
        }

        archMap.set(entry.architecture, entry);
    }
    return index;
}

export class BrowserRuntimeRegistry {
    private state: RegistryState = { status: 'uninitialized' };
    private readonly manifestReader = new RuntimeManifestReader();
    private readonly compatibilityChecker = new RuntimeCompatibilityChecker();

    async initialize(runtimeRoot: string, manifestPath: string): Promise<void> {
        const manifest = await this.manifestReader.read(manifestPath);
        const manifestIndex = buildManifestIndex(manifest);
        this.state = {
            status: 'initialized',
            runtimeRoot,
            manifestPath,
            manifest,
            manifestIndex,
        };
    }

    async reload(): Promise<void> {
        if (this.state.status !== 'initialized') {
            throw new Error(
                'Cannot reload uninitialized BrowserRuntimeRegistry.',
            );
        }
        const manifest = await this.manifestReader.read(
            this.state.manifestPath,
        );
        const manifestIndex = buildManifestIndex(manifest);
        this.state = {
            status: 'initialized',
            runtimeRoot: this.state.runtimeRoot,
            manifestPath: this.state.manifestPath,
            manifest,
            manifestIndex,
        };
    }

    async resolveAndVerify(
        descriptor: BrowserRuntimeDescriptor,
    ): Promise<ResolvedBrowserRuntime> {
        if (this.state.status !== 'initialized') {
            throw new Error(
                'BrowserRuntimeRegistry has not been initialized yet.',
            );
        }

        // 1. Resolve path using indexed map
        const resolver = new BrowserExecutableResolver(
            this.state.runtimeRoot,
            this.state.manifestIndex,
        );
        const resolved = await resolver.resolve(descriptor);

        // 2. Compatibility Check
        const report = await this.compatibilityChecker.check(resolved);
        if (!report.compatible) {
            const criticalIssue = report.issues.find(
                (i) => i.severity === 'critical',
            );
            const code = criticalIssue
                ? criticalIssue.code
                : 'PLATFORM_MISMATCH';
            throw new BrowserRuntimeError(
                code,
                criticalIssue?.message || 'Runtime compatibility check failed.',
                { issues: report.issues },
            );
        }

        return resolved;
    }
}
