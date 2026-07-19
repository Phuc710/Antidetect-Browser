# Desktop Client — Design Review Remediations & Task Status

## Design Review Remediations (RFC-0005 & RFC-0006)

- [x] **Formal Approvals**: Marked RFC-0005 & RFC-0006 as `APPROVED` by Project Owner (Date: 2026-07-18).
- [x] **Finding 1 (Locking Status)**: Documented Layer 1 (Implemented), Layer 2 (Implemented), Layer 3 (Out-of-scope for Local MVP Policy).
- [x] **Finding 2 (Runtime State Vocabulary)**: Unified `ProfileRuntimeState` union across DB, Types, Events, Snapshot, and UI.
- [x] **Finding 3 (Snapshot Contract)**: Extended `ProfileRuntimeSnapshot` with `browserSessionId`, `sequence`, `state: ProfileRuntimeState`, `occurredAt`.
- [x] **Finding 4 (Hydration Race Condition)**: Added event sequence buffering logic in `useProfiles.ts`.
- [x] **Finding 5 (Migration Data Preserved)**: Updated Migration v3 to copy old `profiles` data into `profiles_cache` so assignments are not lost!
- [x] **Finding 6 (PRAGMA foreign_key_check)**: Added violation array check throwing `MigrationIntegrityError`.
- [x] **Finding 7 (Nested Transaction Guard)**: Migration runner manages outer transaction cleanly.
- [x] **Finding 8 (Foreign Keys Safe Toggle)**: Implemented safe `PRAGMA foreign_keys` restoration.
- [x] **Finding 9 (Browser Taxonomy)**: Separated `engine`, `distribution`, `channel`, `browser_version`.
- [x] **Finding 10 (Lock Safety & Stale Detection)**: Lockfile checks PID + instanceId + heartbeat (10s interval, >30s stale cleanup).
- [x] **Finding 11 (Separate Deletion State)**: Added `deletion_state` column (`active`, `pending_delete`, `trashed`, `purge_pending`, `purged`).
- [x] **UI Create Profile Controls**: Added Radio buttons for Browser family (Chromium/Firefox/WebKit) and selects for Distribution, Channel, Version.

## Code & Build Verification
- [x] `pnpm run typecheck` — 0 errors
- [x] `pnpm run build` — Electron-Vite build successful
- [x] Unit test suite created for `ProfileStorageResolver`
