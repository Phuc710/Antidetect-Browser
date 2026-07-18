import type { DatabaseService } from './services/database-service.js';
import {
  BrowserApplicationService,
  type BrowserApplicationServiceOptions,
} from './services/browser-application-service.js';
import { LocalApiService } from './services/local-api-service.js';
import { ProfileService } from './services/profile-service.js';

export interface CoreDesktopRuntime {
  browserApplicationService: BrowserApplicationService;
  localApiService: LocalApiService;
  profileService: ProfileService;
}

/**
 * The only composition root for browser lifecycle consumers. Both Electron IPC
 * (through ProfileService/handlers) and the Local Automation API receive this
 * exact BrowserApplicationService object.
 */
export function createCoreDesktopRuntime(
  databaseService: DatabaseService,
  browserOptions: BrowserApplicationServiceOptions = {},
): CoreDesktopRuntime {
  const browserApplicationService = new BrowserApplicationService(databaseService, browserOptions);
  return {
    browserApplicationService,
    localApiService: new LocalApiService(databaseService, browserApplicationService),
    profileService: new ProfileService(databaseService, browserApplicationService),
  };
}
