# RFC-0006: Browser Lifecycle

- **Status**: Draft
- **Owner**: Desktop Runtime
- **Last updated**: 2026-07-18

## Summary

`BrowserApplicationService` is the sole owner of browser-session lifecycle, persistence, runtime events, process handles and durable local locks. Electron IPC and the Local Automation API receive the exact same service instance from the desktop composition root.

This RFC remains Draft until the project owner formally approves it.

## State model

`ProfileRuntimeState` is the only runtime-state union used by TypeScript contracts, SQLite repositories, services and IPC:

```text
validating -> acquiring_lock -> preparing -> starting -> running
                                                     -> stopping -> stopped
                                                     -> crashed
any non-terminal state -> error
recovery conflict      -> locked
```

Terminal states are `stopped`, `crashed`, `error` and `locked`.

## Session identity

One `browserSessionId` is generated per launch attempt. The same ID is used by:

- `browser_sessions.id`;
- `profile_runtime_events.browser_session_id`;
- the durable lock payload;
- the in-memory process handle;
- IPC and Local Automation API responses.

Creating a second ID in a lower layer is forbidden.

## Runtime events and snapshots

Every transition inserts a row into `profile_runtime_events`. Its SQLite autoincrement key is the global event `sequence`.

Rules:

1. Sequence is monotonic across all profiles and sessions, not per session.
2. State update and event insert occur in one SQLite transaction.
3. An atomic snapshot contains `snapshotSequence`, `capturedAt` and active session snapshots.
4. Each session snapshot contains its last applied event sequence and the complete browser runtime identity.
5. A consumer hydrates the snapshot, then applies buffered events where `event.sequence > snapshotSequence` in ascending order.
6. Duplicate or regressing sequence values are discarded or treated as invariant failures.

The preload bridge begins buffering runtime events before renderer code subscribes. This closes the snapshot-to-subscription race without requiring renderer access to Electron IPC.

## Concurrency and durable locking

Launch protection has three explicit layers:

1. An in-process mutex prevents concurrent launch preparation.
2. SQLite active-session lookup prevents a second launch after the first session reaches persistence.
3. `session.lock` uses exclusive file creation and contains an unguessable owner token.

Only the owner instance and owner token may heartbeat or remove a lock. A competing process cannot remove a lock owned by a live PID. A stale lock is removed only after its owner PID is no longer alive and its payload matches the session being recovered.

## Crash recovery

At composition-root startup, before IPC or Local API launch requests are accepted:

1. Query every non-terminal durable session.
2. Reconcile its durable lock.
3. Mark it `locked` if the recorded lock owner is still alive.
4. Otherwise remove the matching stale lock and mark the session `crashed` with `APP_CRASH_RECOVERY`.
5. Emit the recovery transition through the normal ordered event stream.

The runtime does not kill an arbitrary PID during recovery because PID reuse cannot be proven safe with the current metadata.

## Browser runtime selection

The launcher receives engine, distribution, channel, browser version and architecture as separate typed fields. Architecture mismatch and unavailable distributions fail before reporting a running session.

Current Playwright adapter support:

- Chromium and installed Chrome/Edge channels.
- Firefox through the Firefox launcher.
- WebKit, Brave and custom runtime paths return explicit unavailable errors.

## Cloud Lease status

Cloud Lease is **not implemented**. Its capability status is `stub_not_configured`; local launches do not claim a cloud lease, and health output must not report cloud connectivity. Implementing a cloud lease requires separate explicit approval and is not part of this stabilization work.

## Shutdown

Requested stop transitions through `stopping` to `stopped`, awaits process shutdown, then releases only the matching durable lock. Unexpected process exit transitions to `crashed` and performs the same ownership-checked cleanup.

## Tests required before approval

- Runtime state persistence and global sequence ordering.
- Snapshot watermark and buffered-event replay semantics.
- Concurrent/double launch rejection.
- Durable-lock ownership isolation.
- Requested stop and unexpected process exit.
- Desktop crash recovery.
- IPC validation and secret-safe failures.
- Composition-root service identity.

## Current limitations

- Cloud Lease is a declared stub.
- Runtime download/checksum/repair is not implemented.
- PID executable/start-time verification is not available, so recovery never kills an unknown process.
- Browser fingerprint and proxy injection remain separate follow-up work and are not claimed complete here.
