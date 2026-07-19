# DESKTOP-CORE-005 — Restore Clean Desktop Typecheck Baseline

**Date**: 2026-07-18  
**Branch**: `codex/core-desktop-runtime-rfc5-rfc6`  
**Agent**: Core/Desktop Main Process

---

## 1. Status

**COMPLETE — No changes required.**

Typecheck baseline was already clean at task start. All four TypeScript errors
reported in the previous session (`browser-session-repository.ts` TS2345,
`profile-repository.ts` TS2375, two TS6138 `'db' is declared but never read`)
had been resolved by earlier commits in this branch (Renderer audit DESKTOP-UI-002/003).
No source files were modified in this task.

---

## 2. Pre-task State

| Check | At task start |
|-------|--------------|
| `pnpm version` | 11.9.0 (repo declares 10.33.4, WARN only) |
| `git branch` | `codex/core-desktop-runtime-rfc5-rfc6` |
| Working tree | Clean for all in-scope files; untracked stubs outside scope |
| Uncommitted renderer files | None (committed in prior task) |

---

## 3. Typecheck Results

```
pnpm --filter desktop-client run typecheck
$ tsc --noEmit
(no output)
Exit code: 0
```

Zero errors. Zero warnings. Baseline confirmed clean.

---

## 4. Full Verification Suite

| Command | Exit Code | Notes |
|---------|-----------|-------|
| `pnpm --filter desktop-client run typecheck` | **0** | 0 errors |
| `pnpm --filter desktop-client run lint` | **0** | 0 warnings — `eslint src/main src/preload src/shared --max-warnings=0` |
| `pnpm --filter desktop-client run test` | **0** | 8 unit + 6 integration = **14 tests, 5 suites, all passed** |
| `pnpm --filter desktop-client run build` | **0** | Main 132 kB, Preload 5.46 kB, Renderer 512.56 kB |

### Test detail

```
Unit tests (vitest.config.mts):
  ✓ redaction.unit.test.ts                  (2 tests)
  ✓ profile-ipc-validation.unit.test.ts     (3 tests)
  ✓ profile-storage-resolver.test.ts        (3 tests)
  Test Files: 3 passed | Tests: 8 passed

Integration tests (vitest.integration.config.mts):
  ✓ migration-runner.integration.test.ts    (4 tests)
  ✓ browser-lifecycle.integration.test.ts   (2 tests)
  Test Files: 2 passed | Tests: 6 passed
```

---

## 5. Files Changed

**None.** This task confirmed the baseline; no source files were modified.

---

## 6. Architecture Decisions

None required. Task scope was diagnostic only.

---

## 7. Security Impact

None. No code was changed.

---

## 8. Known Limitations

- `pnpm` version on this machine (v11.9.0) differs from repository declaration (10.33.4).
  This produces a WARN on each command but does not affect behaviour.
  Not fixing `packageManager` field is intentional to avoid breaking CI that pins 10.33.4.

---

## 9. Core Contract Requests

None.

---

## 10. Suggested Next Task

**DESKTOP-CORE-006 — Browser Fingerprint Injection Pipeline**

Wire the local `fingerprint-generator` package into `BrowserApplicationService.launch()`:
- Replace stub `DevelopmentFingerprintProvider` with real `LocalFingerprintProvider` that calls `FingerprintGenerator.getFingerprint()`
- Pass the generated fingerprint to `FingerprintInjector.attachFingerprintToPlaywright()` after launch
- Wire proxy configuration from `ProfileRepository` → `playwright.launchServer({ proxy: { server, username, password } })`
- Add integration test asserting that a launched session has a non-default userAgent

Allowed paths: `apps/desktop-client/src/main/**`, `packages/fingerprint-injector/**`

---

Task finished. Waiting for review and the next explicit assignment.
