import type {
  LauncherCommand,
  LauncherResponse,
  LauncherEvent,
  ProfileRuntimeState,
} from 'shared';
import { SessionRegistry, type BrowserSession } from './runtime/session-registry.js';
import { ProfileLockManager } from './runtime/profile-lock-manager.js';
import { PlaywrightProcessLauncher, PlaywrightRuntimeAdapter } from './runtime/browser-runtime-service.js';
import { FingerprintService } from './runtime/fingerprint-service.js';

const registry = new SessionRegistry();
const lockManager = new ProfileLockManager();
const launcher = new PlaywrightProcessLauncher();
const fingerprintService = new FingerprintService();

let isInitialized = false;

function sendToParent(message: LauncherResponse | LauncherEvent) {
  if (process.send) {
    process.send(message);
  }
}

function publishStateChanged(profileId: string, sessionId: string, state: ProfileRuntimeState, sequence: number, errorCode?: string) {
  sendToParent({
    type: 'runtime:changed',
    payload: {
      profileId,
      browserSessionId: sessionId,
      sequence,
      state,
      occurredAt: new Date().toISOString(),
      ...(errorCode ? { errorCode } : {}),
    },
  });
}

process.on('message', async (message: unknown) => {
  if (!message || typeof message !== 'object') return;

  const cmd = message as LauncherCommand;
  const { type, requestId } = cmd;
  if (!type || !requestId) return;

  try {
    switch (cmd.type) {
      case 'launcher:initialize': {
        isInitialized = true;
        sendToParent({
          type: 'command:success',
          requestId,
        });
        break;
      }

      case 'profile:launch': {
        if (!isInitialized) {
          throw new Error('Launcher is not initialized yet.');
        }

        const {
          sessionId,
          profileId,
          userDataDir,
          headless,
          engine,
          distribution,
          channel,
          browserVersion,
          architecture,
          automationProtocol,
          proxy,
          cookies,
          preparedFingerprint,
        } = cmd.payload;

        let durableLockAcquired = false;
        let processHandle: any = null;
        let runtime: any = null;

        try {
          // 1. Validating
          publishStateChanged(profileId, sessionId, 'validating', 1);

          // 2. Acquiring Lock
          publishStateChanged(profileId, sessionId, 'acquiring_lock', 2);
          lockManager.acquireDurableLock(profileId, userDataDir, sessionId);
          durableLockAcquired = true;

          // 3. Preparing
          publishStateChanged(profileId, sessionId, 'preparing', 3);

          const userAgent = preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.navigator?.userAgent;
          const language = preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.navigator?.language;
          const screenWidth = preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.screen?.width;
          const screenHeight = preparedFingerprint?.fingerprintWithHeaders?.fingerprint?.screen?.height;

          // 4. Launching Process
          processHandle = await launcher.launch({
            engine,
            distribution,
            channel,
            browserVersion,
            architecture,
            automationProtocol,
            userDataDir,
            headless,
            proxy,
            ...(userAgent ? { userAgent } : {}),
            ...(language ? { language } : {}),
            ...(screenWidth && screenHeight ? { screenWidth, screenHeight } : {}),
          });

          // 5. Starting & Connecting
          publishStateChanged(profileId, sessionId, 'starting', 4);
          runtime = await PlaywrightRuntimeAdapter.connect(processHandle, fingerprintService);

          // Inject cookies if present
          if (cookies) {
            try {
              const parsedCookies = JSON.parse(cookies);
              if (Array.isArray(parsedCookies)) {
                await runtime.injectCookies(parsedCookies);
              }
            } catch (err) {
              // Gracefully handle parsing errors
            }
          }

          // 6. Applying Fingerprint & Readiness
          await runtime.applyFingerprint(
            preparedFingerprint.fingerprintWithHeaders,
            preparedFingerprint.markerScript,
          );
          await runtime.verifyReadiness(preparedFingerprint.readiness);

          const automation = {
            protocol: processHandle.automation.protocol,
            endpoint: processHandle.automation.endpoint,
          };

          // Setup periodic cookies sync interval
          const cookieSyncInterval = setInterval(async () => {
            try {
              if (registry.getBySessionId(sessionId)) {
                const currentCookies = await runtime.getCookies();
                sendToParent({
                  type: 'session:cookies-sync',
                  payload: {
                    profileId,
                    sessionId,
                    cookies: JSON.stringify(currentCookies),
                  },
                });
              }
            } catch {
              // Ignore if context gets closed
            }
          }, 5000);

          const session: BrowserSession = {
            sessionId,
            profileId,
            pid: processHandle.pid,
            state: 'running',
            startedAt: new Date().toISOString(),
            engine,
            distribution,
            channel,
            browserVersion,
            architecture,
            automation,
            browserHandle: runtime,
            cookieSyncInterval,
          };

          registry.add(session);

          // Listen to unexpected exit
          const removeExitListener = processHandle.onExit((exitCode?: number) => {
            clearInterval(cookieSyncInterval);
            registry.remove(sessionId);
            lockManager.releaseDurableLock(profileId, sessionId);
            publishStateChanged(profileId, sessionId, 'crashed', 6, `Unexpected exit code: ${exitCode}`);
          });

          // Hacky wrap to clean exit listener on explicit stop
          const originalStop = runtime.stop.bind(runtime);
          runtime.stop = async () => {
            removeExitListener();
            clearInterval(cookieSyncInterval);
            await originalStop();
          };

          // 7. Running
          publishStateChanged(profileId, sessionId, 'running', 5);

          sendToParent({
            type: 'command:success',
            requestId,
            payload: {
              sessionId,
              profileId,
              state: 'running',
              pid: processHandle.pid,
              automation,
              startedAt: session.startedAt,
            },
          });
        } catch (err: any) {
          if (runtime) {
            await runtime.stop().catch(() => undefined);
          } else if (processHandle) {
            await processHandle.stop().catch(() => undefined);
          }
          if (durableLockAcquired) {
            lockManager.releaseDurableLock(profileId, sessionId);
          }
          
          publishStateChanged(profileId, sessionId, 'error', 10, err.code || 'LAUNCH_FAILED');
          throw err;
        }
        break;
      }

      case 'profile:stop': {
        if (!isInitialized) {
          throw new Error('Launcher is not initialized yet.');
        }

        const { sessionId } = cmd.payload;
        const session = registry.getBySessionId(sessionId);
        if (!session) {
          // If session doesn't exist, return success immediately as requested
          sendToParent({
            type: 'command:success',
            requestId,
          });
          return;
        }

        try {
          publishStateChanged(session.profileId, sessionId, 'stopping', 11);
          
          // Send one last cookie sync before stopping
          try {
            const currentCookies = await session.browserHandle.getCookies();
            sendToParent({
              type: 'session:cookies-sync',
              payload: {
                profileId: session.profileId,
                sessionId,
                cookies: JSON.stringify(currentCookies),
              },
            });
          } catch {}

          await session.browserHandle.stop();
          publishStateChanged(session.profileId, sessionId, 'stopped', 12);
        } catch (err: any) {
          publishStateChanged(session.profileId, sessionId, 'error', 13, err.code || 'STOP_FAILED');
          throw err;
        } finally {
          lockManager.releaseDurableLock(session.profileId, sessionId);
          registry.remove(sessionId);
        }

        sendToParent({
          type: 'command:success',
          requestId,
        });
        break;
      }

      case 'runtime:snapshot': {
        sendToParent({
          type: 'command:success',
          requestId,
          payload: {
            snapshotSequence: 1,
            capturedAt: new Date().toISOString(),
            sessions: registry.snapshot(),
          },
        });
        break;
      }

      case 'launcher:shutdown': {
        const sessions = registry.list();
        await Promise.allSettled(
          sessions.map(async (session) => {
            try {
              // Send final cookies sync
              try {
                const currentCookies = await session.browserHandle.getCookies();
                sendToParent({
                  type: 'session:cookies-sync',
                  payload: {
                    profileId: session.profileId,
                    sessionId: session.sessionId,
                    cookies: JSON.stringify(currentCookies),
                  },
                });
              } catch {}
              await session.browserHandle.stop();
            } catch {}
            lockManager.releaseDurableLock(session.profileId, session.sessionId);
          })
        );
        lockManager.shutdown();
        
        sendToParent({
          type: 'command:success',
          requestId,
        });
        process.exit(0);
        break;
      }

      default: {
        sendToParent({
          type: 'command:error',
          requestId,
          error: {
            code: 'UNKNOWN_ERROR',
            message: `Unsupported command type: ${(cmd as any).type}`,
          },
        });
      }
    }
  } catch (error: any) {
    sendToParent({
      type: 'command:error',
      requestId,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred in launcher process.',
      },
    });
  }
});

// Notify parent that the child process is spawned and ready to receive commands
sendToParent({
  type: 'launcher:ready',
});
