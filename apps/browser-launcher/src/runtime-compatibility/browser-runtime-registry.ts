import { BrowserRuntimeDescriptor } from './browser-runtime-descriptor.js';
import { ResolvedBrowserRuntime, BrowserExecutableResolver } from './browser-executable-resolver.js';
import { RuntimeCompatibilityChecker } from './runtime-compatibility-checker.js';
import { RuntimeManifestReader } from './runtime-manifest-reader.js';
import { BrowserRuntimeError } from './runtime-errors.js';

export class BrowserRuntimeRegistry {
  private runtimeRoot: string = '';
  private manifestPath: string = '';
  private initialized = false;
  private readonly manifestReader = new RuntimeManifestReader();
  private readonly compatibilityChecker = new RuntimeCompatibilityChecker();

  initialize(runtimeRoot: string, manifestPath: string) {
    this.runtimeRoot = runtimeRoot;
    this.manifestPath = manifestPath;
    this.initialized = true;
  }

  resolveAndVerify(descriptor: BrowserRuntimeDescriptor): ResolvedBrowserRuntime {
    if (!this.initialized) {
      throw new Error('BrowserRuntimeRegistry has not been initialized yet.');
    }

    // 1. Read and parse manifest
    const manifest = this.manifestReader.read(this.manifestPath);

    // 2. Resolve path
    const resolver = new BrowserExecutableResolver(this.runtimeRoot, manifest);
    const resolved = resolver.resolve(descriptor);

    // 3. Compatibility Check
    const report = this.compatibilityChecker.check(resolved);
    if (!report.compatible) {
      const criticalIssue = report.issues.find((i) => i.severity === 'critical');
      const code = criticalIssue ? criticalIssue.code : 'PLATFORM_MISMATCH';
      throw new BrowserRuntimeError(
        code,
        criticalIssue?.message || 'Runtime compatibility check failed.',
        { issues: report.issues } as any
      );
    }

    return resolved;
  }
}
