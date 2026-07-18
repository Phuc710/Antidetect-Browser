# RFC-0005: Profiles Cache

- **Status**: Draft
- **Owner**: Desktop Runtime
- **Last updated**: 2026-07-18

## Summary

The desktop application keeps an authoritative local cache of profile metadata in SQLite. Browser storage remains isolated on disk by an opaque `storage_key`; paths supplied by a renderer or API client are never accepted.

This RFC remains Draft until the project owner formally approves it.

## Scope

- Local profile CRUD and optimistic version checks.
- Migration of populated v2 profile and proxy-assignment data.
- Browser runtime metadata required to select a compatible runtime.
- Local cache, deletion and synchronization states.

Cloud synchronization, billing, teams and cloud profile leases are outside this RFC.

## Browser runtime identity

The following fields are independent and must not be collapsed into a single `browser` string:

| Field | Meaning | Examples |
|---|---|---|
| `engine` | Rendering/automation engine | `chromium`, `firefox`, `webkit` |
| `distribution` | Packaged browser product | `chromium`, `chrome`, `edge`, `brave`, `firefox`, `webkit`, `custom` |
| `channel` | Release channel | `stable`, `beta`, `dev`, `canary`, `custom` |
| `browser_version` | Requested runtime version | `latest`, `126.0.1` |
| `architecture` | Runtime CPU architecture | `x64`, `arm64` |

Runtime availability is validated before launch. A stored profile is not rewritten merely because a requested runtime is unavailable on the current device.

## SQLite model

`profiles_cache` stores profile identity, runtime identity, proxy reference, fingerprint envelope metadata, storage key, optimistic version, synchronization state and deletion state.

Important invariants:

1. `storage_key` is a single opaque path segment.
2. `proxy_id` uses `ON DELETE SET NULL`.
3. Profile deletion is represented by cache state before physical cleanup.
4. Runtime state is not stored in `profiles_cache`; it is derived from `browser_sessions`.
5. Browser credentials and proxy passwords are not stored in this table.

## Migration v3

Migration v3 upgrades a populated v2 database and must:

1. Preserve profile IDs, names, timestamps, notes, fingerprint payloads and valid proxy IDs.
2. Preserve valid rows from `profile_proxy_assignments`.
3. Convert the legacy `browser` value into independent runtime fields.
4. Use `x64` only as the legacy architecture fallback; new profiles use the host architecture unless explicitly configured.
5. Run in exactly one migration-runner transaction.
6. Disable `PRAGMA foreign_keys` only outside that transaction and restore its original value in `finally`.
7. Execute and assert `PRAGMA foreign_key_check` before commit.
8. Roll back both schema changes and the `schema_migrations` record on failure.

## IPC boundary

All input is validated in the main process. Unknown fields, invalid enum members, unbounded strings and invalid pagination are rejected. Renderer types are not a security boundary.

Profile runtime events and snapshots use the contract defined by RFC-0006.

## Failure codes

- `NOT_FOUND`
- `VERSION_CONFLICT`
- `PROFILE_RUNNING`
- `VALIDATION_ERROR`
- `BROWSER_ARCHITECTURE_MISMATCH`
- `BROWSER_ENGINE_UNAVAILABLE`
- `BROWSER_DISTRIBUTION_UNAVAILABLE`

Internal errors and secrets are never returned across IPC.

## Tests required before approval

- Fresh migration and populated v2 upgrade.
- Profile and proxy-assignment preservation.
- Foreign-key violation rollback and PRAGMA restoration.
- CRUD/version conflict behavior.
- Storage-key traversal protection.
- IPC validation and secret redaction.

## Current limitations

- Cloud synchronization is not implemented.
- Cloud Lease is not implemented.
- WebKit and custom/Brave runtime resolution are not implemented.
- Secure wipe and profile import/export remain outside the stabilized runtime slice.
