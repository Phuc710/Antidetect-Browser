export * from 'shared';

import type { BrowserArchitecture } from 'shared';

export function getHostArchitecture(): BrowserArchitecture {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}
