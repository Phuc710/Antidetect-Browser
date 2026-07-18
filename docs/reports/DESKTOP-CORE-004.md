# DESKTOP-CORE-004: Core Branch Isolation and Clean-Checkout Reproducibility

## Status

**COMPLETE**

The Core commit series is isolated on a clean branch and worktree. The final frozen install, typecheck, lint, Core unit tests, Core integration tests, and production build all pass. The task range contains no Renderer changes, does not depend on the original dirty worktree, does not import the untracked Proxy implementation, and keeps RFC-0005 and RFC-0006 in Draft.

## Isolation result

- Clean branch: `work/core-clean`
- Clean worktree: `C:\Users\Phucx\Desktop\fingerprint-suite-core-clean`
- Backup branch: `backup/mixed-core-ui-2026-07-18`
- Backup target: `732e45bba7f5eb8afe8bbe7d10680469587a73e6`
- Pre-Renderer base: `6f482c466a30fd59cc13420a3f9a7c77b627e631`
- Original mixed branch: `codex/core-desktop-runtime-rfc5-rfc6`
- Original worktree: `C:\Users\Phucx\Desktop\fingerprint-suite`

No merge or push was performed.

## Initial Git inspection

All required inspection commands were run before branch or worktree mutation and exited `0`:

```text
git branch --show-current
git status --short --untracked-files=all
git log --oneline --decorate -15
git worktree list
git rev-parse cbb85ed^
git show --stat 08afca1
git show --stat 5f6aead
git show --stat 732e45b
```

The original branch was `codex/core-desktop-runtime-rfc5-rfc6` at `732e45b`. Its relevant history was:

```text
732e45b test(desktop): cover runtime recovery and migrations
5f6aead feat(desktop): stabilize profile and browser runtime
08afca1 docs: draft profile cache and browser lifecycle RFCs
099c8f1 refactor(renderer): enforce BEM styling, remove inline styles, remove MOCK_REQUESTS, and add isolated dev fixtures
2eb9590 test(renderer): add unit test suites for auth validation, profiles states, sequence ordering, and proxy credentials
cbb85ed feat(renderer): add LanguageSelector component and unit tests
6f482c4 UI
```

`git rev-parse cbb85ed^` resolved the clean base to `6f482c466a30fd59cc13420a3f9a7c77b627e631`.

The original dirty files were not staged, copied, or modified. The initial status was:

```text
 M .agents/walkthrough.md
 M note.md
 M packages/shared/src/constants/ipc-channels.ts
 M packages/shared/src/index.ts
?? .agents/task.md
?? apps/desktop-client/src/main/database/repositories/proxy-repository.ts
?? apps/desktop-client/src/main/ipc/handlers/proxy-handlers.ts
?? apps/desktop-client/src/main/services/proxy-service.ts
?? docs/RFCs/RFC-0025-Proxy-Management.md
?? docs/RFCs/RFC-0026-Local-Automation-API.md
```

## Cherry-pick result

Only the three assigned Core commits were cherry-picked, in the required order:

| Original | Isolated commit | Subject |
| --- | --- | --- |
| `08afca157a91493d731e1454ed6eda1d4f779a26` | `b18f5a7d6f96f670893abbc2d3cb90cf566ef5bf` | `docs: draft profile cache and browser lifecycle RFCs` |
| `5f6aead226f5bd1efb2eacb45577f6c3e185b8ac` | `170692cf3ebabc599fb25cf756baa4fd7266e00e` | `feat(desktop): stabilize profile and browser runtime` |
| `732e45bba7f5eb8afe8bbe7d10680469587a73e6` | `2c84b9089402499efaa9c3715706c9f4f7aa7412` | `test(desktop): cover runtime recovery and migrations` |

The cherry-picks completed without conflicts. Renderer commits `cbb85ed`, `2eb9590`, and `099c8f1` were not cherry-picked.

One task-local remediation commit was added after the dependency audit:

```text
2ae14a44d0d2199527d4f09fc40135d1583fef2f fix(desktop): make core branch self-contained
```

It removes out-of-scope Proxy wiring from Main/Preload and tracks the Auth/Desktop API contracts that the clean Core build requires. It does not modify Renderer.

## Missing dependency audit

| Absolute path | Repository-relative path | Required by isolated Core? | Ownership | Action |
| --- | --- | --- | --- | --- |
| `C:\Users\Phucx\Desktop\fingerprint-suite\packages\shared\src\constants\ipc-channels.ts` | `packages/shared/src/constants/ipc-channels.ts` | The tracked base Auth/Window channels are required. The original dirty Profile/Proxy additions are not required; Core has `apps/desktop-client/src/shared/profile-ipc-channels.ts`. | Dirty additions mix Profile and unapproved Proxy work. | Left the original dirty file untouched. Did not copy its dirty changes. |
| `C:\Users\Phucx\Desktop\fingerprint-suite\packages\shared\src\index.ts` | `packages/shared/src/index.ts` | Yes, the shared package entry point is required, but the dirty version exports ignored/untracked `types/*` sources and Proxy/Profile contracts from another task. | Mixed shared/Proxy task dependency. | Did not copy the dirty version. Committed a self-contained index exporting tracked `contracts/auth.ts` and `contracts/desktop-api.ts`. |
| `C:\Users\Phucx\Desktop\fingerprint-suite\apps\desktop-client\src\main\database\repositories\proxy-repository.ts` | `apps/desktop-client/src/main/database/repositories/proxy-repository.ts` | No. | Proxy feature, outside RFC-0005/RFC-0006. | Left untracked and untouched in the original worktree. |
| `C:\Users\Phucx\Desktop\fingerprint-suite\apps\desktop-client\src\main\ipc\handlers\proxy-handlers.ts` | `apps/desktop-client/src/main/ipc/handlers/proxy-handlers.ts` | No. The clean composition root no longer imports it. | Proxy feature, outside RFC-0005/RFC-0006. | Left untracked and untouched; removed the invalid clean-branch import/wiring. |
| `C:\Users\Phucx\Desktop\fingerprint-suite\apps\desktop-client\src\main\services\proxy-service.ts` | `apps/desktop-client/src/main/services/proxy-service.ts` | No. The clean composition root no longer imports it. | Proxy feature, outside RFC-0005/RFC-0006. | Left untracked and untouched; removed the invalid clean-branch import/wiring. |
| `C:\Users\Phucx\Desktop\fingerprint-suite\docs\RFCs\RFC-0025-Proxy-Management.md` | `docs/RFCs/RFC-0025-Proxy-Management.md` | No. | Proxy feature RFC. | Left untracked and untouched. |
| `C:\Users\Phucx\Desktop\fingerprint-suite\docs\RFCs\RFC-0026-Local-Automation-API.md` | `docs/RFCs/RFC-0026-Local-Automation-API.md` | No. RFC-0006's current local automation adapter is defined and tested within the assigned Core scope; RFC-0026 was not used or changed. | Separate draft RFC outside the assigned paths. | Left untracked and untouched. |

Additional audit finding: `packages/shared/src/types/auth.ts` and `packages/shared/src/types/desktop-api.ts` existed only as ignored files because the repository-wide `types` ignore rule matched that directory. They were not copied. Equivalent required contracts are now tracked under `packages/shared/src/contracts/`.

## Package/runtime environment

Final verification environment:

```text
node --version
v20.18.1

pnpm --version
10.33.4
```

Node `20.18.1` is in the repository CI matrix and matches the Node runtime embedded in Electron `32.3.3`. A portable official Node archive was used outside the repository; its SHA-256 was verified as `56E5AACDEEE7168871721B75819CCACF2367DE8761B78EACEACDECD41E04CA03`. The repository pin remained unchanged at `pnpm@10.33.4`.

The first install attempt under the machine-default Node `v24.18.0` exited `1`: `better-sqlite3` had no matching prebuilt binary and Visual Studio C++ build tools were unavailable. Two subsequent Electron-as-Node experiments also exited `1` because package lifecycle scripts require a standard Node executable. Each partial `node_modules` tree was moved intact to a unique backup under `C:\Temp`; no source file, lockfile, original-worktree dependency, or user file was deleted.

The final clean install used portable Node `v20.18.1` and exited `0`:

```powershell
node C:\Program Files\nodejs\node_modules\corepack\dist\corepack.js pnpm install --frozen-lockfile
```

Because project tests intentionally run Vitest under Electron-as-Node, the locked `better-sqlite3@11.10.0` prebuilt binding was then selected for Electron `32.3.3` / ABI `128` using its own installed `prebuild-install` hook. A real in-memory SQLite database opened and closed under Electron with exit `0` before tests were run.

## Required verification

All final required commands were run from `C:\Users\Phucx\Desktop\fingerprint-suite-core-clean` with portable Node `v20.18.1` on PATH and Corepack resolving pnpm `10.33.4`.

| Verification | Exact project command | Exit code | Result |
| --- | --- | ---: | --- |
| Frozen install | `pnpm install --frozen-lockfile` | `0` | PASS |
| Typecheck | `pnpm --filter desktop-client typecheck` | `0` | PASS |
| Lint | `pnpm --filter desktop-client lint` | `0` | PASS, zero warnings |
| Core unit tests | `pnpm --filter desktop-client test:unit` | `0` | PASS |
| Core integration tests | `pnpm --filter desktop-client test:integration` | `0` | PASS |
| Production build | `pnpm --filter desktop-client build` | `0` | PASS |

The shell invoked pnpm through Corepack's JavaScript entry point to ensure the exact pinned version while using the portable Node runtime. No package-manager pin was changed.

## Test counts

Unit tests:

```text
Test Files  3 passed (3)
Tests       8 passed (8)
```

- `src/main/services/__tests__/redaction.unit.test.ts`: 2 tests
- `src/main/ipc/__tests__/profile-ipc-validation.unit.test.ts`: 3 tests
- `src/main/services/__tests__/profile-storage-resolver.test.ts`: 3 tests

Integration tests:

```text
Test Files  2 passed (2)
Tests       6 passed (6)
```

- `src/main/database/__tests__/migration-runner.integration.test.ts`: 4 tests
- `src/main/services/__tests__/browser-lifecycle.integration.test.ts`: 2 tests

Total: **5 test files and 14 tests passed**.

## Renderer scope check

Command:

```text
git diff --name-only 6f482c466a30fd59cc13420a3f9a7c77b627e631..HEAD -- apps/desktop-client/src/renderer
```

Output: empty. Exit code: `0`.

No file under `apps/desktop-client/src/renderer/**` was modified by this task.

## RFC status

- `docs/RFCs/RFC-0005-Profile-Management.md`: **Draft**
- `docs/RFCs/RFC-0006-Workspace-Management.md`: **Draft**

Neither RFC was approved.

## Final task range

Before adding this report, the range from the clean base contained 41 files with 3,779 insertions and 318 deletions. Every path was within the assigned Core scope, and the Renderer path diff was empty.

The isolated branch log before the report commit was:

```text
2ae14a4 fix(desktop): make core branch self-contained
2c84b90 test(desktop): cover runtime recovery and migrations
170692c feat(desktop): stabilize profile and browser runtime
b18f5a7 docs: draft profile cache and browser lifecycle RFCs
```

The final report commit hash and final range stat are recorded in Git itself after this file is committed.

## Final Git status

After committing this report, the required final check is:

```text
git status --short --untracked-files=all
```

Expected and verified output: empty.

The original dirty worktree remained separate and untouched. During final observation, unrelated untracked `docs/RFCs/RFC-0027-Browser-Fingerprint-Injection.md` and `docs/reports/DESKTOP-CORE-005.md` appeared there after the initial snapshot; this task did not create, read, stage, or modify them.

## Remaining limitations

- The machine-default Node `v24.18.0` cannot complete the locked native dependency install on this Windows host without Visual Studio C++ build tools. Reproducible verification therefore used CI-supported portable Node `v20.18.1`.
- Desktop integration tests require the Electron ABI build of `better-sqlite3`; a clean Windows verifier must select/rebuild that native binding for Electron before running the Electron-hosted Vitest scripts.
- RFC-0005 and RFC-0006 remain Draft and require formal project-owner review. This task does not approve them.
- Cloud lease behavior remains outside this task and is not represented as implemented.

## Suggested next task

Project-owner review of the isolated `work/core-clean` branch, its Draft RFCs, and this reproducibility evidence. Do not merge until that review explicitly approves the next action.

Task finished. Waiting for review and the next explicit assignment.
