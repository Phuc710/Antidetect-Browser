# Desktop Main Consolidation Report

Date: 2026-07-18

Branch: `main`

Status: `PARTIAL`

## Consolidated functionality

- Fingerprint envelope validation, injection, readiness gating, lifecycle cleanup, cache, and artifact security checks.
- Shared Profile and Proxy contracts used by Electron Main, Preload, and Renderer.
- Full-page Create/Edit Profile flow using one `CreateProfilePage`; the old Profile dialog was removed.
- Profile metadata persistence for project, tags, startup URLs, cookies, network safety policy, and proxy assignment.
- Cookie parsing remains page-local in Renderer and only the persisted cookie count is returned in Profile views.
- Proxy CRUD, batch parsing/testing, OS secure credential storage, masked Renderer views, and Main-only launch resolution.
- Proxy launch options are resolved inside Main and passed to the browser launcher without exposing credentials in runtime snapshots or events.
- Deterministic desktop packaging, packaged injector smoke testing, and production artifact secret scanning.

## Verification

Toolchain:

- Node.js `20.18.1`
- pnpm `10.33.4`

Passed commands:

```text
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter desktop-client run typecheck
pnpm --filter desktop-client run lint
pnpm --filter desktop-client run test:unit
pnpm --filter desktop-client run test:integration
DESKTOP_PACKAGE_OUTPUT_DIR=dist-main pnpm --filter desktop-client run package:dir
DESKTOP_PACKAGE_OUTPUT_DIR=dist-main pnpm --filter desktop-client run smoke:packaged-injector
DESKTOP_PACKAGE_OUTPUT_DIR=dist-main pnpm --filter desktop-client run scan:production-artifacts
```

Results:

- Typecheck: PASS
- ESLint: PASS
- Unit: 19 files, 76 tests PASS
- Integration: 4 files, 18 tests PASS
- Build: PASS
- `package:dir`: PASS; `win-unpacked` created in 71.3 seconds
- Packaged `FingerprintInjector` smoke: PASS
- Artifact secret scan: PASS; 39 files scanned
- Generated `out`, `.packaging`, `dist`, and `dist-main` artifacts are not tracked by Git

## Commits on main

- `5b65d95` `feat(desktop): unify profile and proxy workflows`
- `abd1d27` `build(desktop): harden packaged runtime verification`

Earlier Profile and Fingerprint work already consolidated on `main`:

- `d2197ab` `feat(desktop): add full-page profile creation`
- `aa7d425` merge of the fingerprint-injection branch

## Remaining merge blockers

1. `PlaywrightProcessLauncher` accepts `userDataDir` but currently starts Chromium with `launchServer()` without applying that directory. Cookie/localStorage persistence across stop and relaunch is therefore not proven.
2. The published CDP endpoint may allow an external client to create another browser context and bypass the injected default context. A restricted automation contract or a persistent-context launcher design is required before production approval.
3. Production Cloud Fingerprint transport still depends on the separately configured cloud service. Development generation remains development-only.
4. Proxy identity testing requires a configured HTTPS `FINGERPRINT_SUITE_PROXY_IDENTITY_URL`; the app returns `configuration_error` rather than calling a fabricated endpoint when it is absent.

The local branch consolidation is complete, but the feature set must remain `PARTIAL` until items 1 and 2 are resolved and independently reviewed.
