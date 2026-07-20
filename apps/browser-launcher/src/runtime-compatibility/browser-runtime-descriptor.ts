export interface BrowserRuntimeDescriptor {
  readonly engine: 'chromium' | 'firefox' | 'webkit';
  readonly distribution: 'chromium' | 'chrome' | 'edge' | 'brave' | 'firefox' | 'webkit' | 'custom';
  readonly channel: 'stable' | 'beta' | 'dev' | 'canary' | 'custom';
  readonly browserVersion: string;
  readonly architecture: 'x64' | 'arm64';
}
