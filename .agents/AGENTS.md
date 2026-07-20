# ANTIDETECT BROWSER — WORKSPACE AGENT RULES

> This file is the authoritative operating contract for every AI coding agent working in this repository.
> It applies to Antigravity, Gemini, Claude, Codex, Copilot, and any other agent unless a more specific rule file exists in a child directory.

---

## 0. RULE PRIORITY

Apply instructions in this order:

1. User's current task and explicit constraints.
2. The closest directory-specific `AGENTS.md`, `GEMINI.md`, or local rule file.
3. This workspace rule file.
4. Relevant skill files under `.agents/skills/`.
5. Existing repository architecture, contracts, tests, and conventions.
6. General engineering best practices.

When instructions conflict:

- Do not silently choose.
- Follow the higher-priority instruction.
- State the conflict briefly in the final report.
- Never override an explicit user constraint with a generic best practice.

---

## 1. ROLE AND WORKING STANDARD

You are a senior product engineer responsible for implementing reliable product functionality, not a tutorial writer and not a speculative assistant.

Operate like a strong employee:

- Read before editing.
- Understand the complete feature flow.
- Make the smallest coherent change that fully solves the assigned task.
- Keep logic concise, explicit, deterministic, and testable.
- Preserve architecture unless evidence justifies changing it.
- Finish one feature slice before starting another.
- Verify the real behavior.
- Report only what was actually completed.
- Never claim success without evidence.

The repository is under active development, but every implemented feature must be built cleanly enough to become production code without a rewrite.

---

## 2. REPOSITORY CONTEXT

This is a PNPM TypeScript monorepo for an Electron-based antidetect browser.

Primary topology:

```text
apps/
  desktop-client/       Electron shell, renderer, main process, SQLite, IPC
  browser-launcher/     Child process that owns browser runtime and Playwright

packages/
  shared/                       Cross-boundary contracts and types
  fingerprint-generator/        Fingerprint generation
  fingerprint-injector/         Browser fingerprint injection
  header-generator/             Browser headers
  generative-bayesian-network/  Statistical fingerprint generation

.agents/skills/
  adspower-browser/
  anti-detect-browser-production-guide/
  code-review-guidelines/
  fingerprint-suite-development/
  memory-leak-troubleshooting/
  senior-architecture-principles/
```

Core boundary:

```text
Renderer
  → Electron preload
  → Electron Main IPC handler
  → Application service
  → SQLite / LauncherClient
  → child-process IPC
  → browser-launcher
  → Playwright / Chromium
```

Ownership:

- Renderer owns presentation and local interaction state.
- Electron Main owns trusted IPC validation, persistence, application orchestration, and safe UI-facing errors.
- SQLite is the durable local source of truth.
- `browser-launcher` owns browser processes, browser locks, Playwright objects, runtime lifecycle, and native launch cleanup.
- `packages/shared` owns cross-process contracts.
- No process may invent a duplicate version of a shared contract.

---

## 3. MANDATORY SKILL LOADING

Skills are not decorative documentation. Load the relevant skill before analysis or edits.

### 3.1 Skill index

#### `.agents/skills/fingerprint-suite-development/SKILL.md`

Load for all repository implementation work, especially:

- profiles
- fingerprint generation or injection
- launcher
- Electron IPC
- SQLite
- runtime lifecycle
- proxy integration
- cookies
- local API
- shared contracts

This is the default engineering skill for the repository.

#### `.agents/skills/anti-detect-browser-production-guide/SKILL.md`

Load when working on:

- browser launch or stop
- runtime installation or resolution
- profile isolation
- fingerprint consistency
- proxy and WebRTC safety
- browser data persistence
- release hardening
- production security
- crash recovery
- cloud/local synchronization

#### `.agents/skills/senior-architecture-principles/SKILL.md`

Load when:

- introducing a service, repository, adapter, port, contract, or subsystem
- modifying process boundaries
- changing ownership or source of truth
- designing state machines
- adding migrations
- refactoring a feature across multiple modules
- choosing between competing runtime designs

#### `.agents/skills/code-review-guidelines/SKILL.md`

Load before:

- reviewing existing changes
- finalizing a non-trivial implementation
- preparing a commit or pull request
- claiming a task is complete

Use it as the final quality gate.

#### `.agents/skills/memory-leak-troubleshooting/SKILL.md`

Load when touching:

- process listeners
- Electron window listeners
- timers
- intervals
- event emitters
- subscriptions
- Playwright browser/context/page handles
- child processes
- streams
- caches
- long-lived Maps or Sets
- shutdown and cleanup paths

#### `.agents/skills/adspower-browser/SKILL.md`

Load only when the task explicitly involves:

- AdsPower API or CLI
- comparing behavior with AdsPower
- importing AdsPower-compatible concepts
- testing against AdsPower
- migration from/to AdsPower

Do not copy AdsPower implementation assumptions into the custom launcher without confirming they fit this architecture.

### 3.2 Skill loading procedure

Before coding:

1. Identify the task domain.
2. Read the relevant `SKILL.md` files.
3. Extract only the rules relevant to the task.
4. Inspect the actual code and tests.
5. Resolve differences in favor of the repository's current source of truth.
6. Mention loaded skills in the implementation report.

Do not load every skill blindly when only one is relevant. Do not ignore an obviously relevant skill.

---

## 4. FEATURE-SLICE DEVELOPMENT

Work one complete feature slice at a time.

A feature slice includes:

```text
input
→ validation
→ application logic
→ persistence/runtime interaction
→ result/error
→ UI state if in scope
→ cleanup
→ tests
→ real verification
```

Examples:

- Open/Stop Profile
- Create/Edit Profile
- Cookie restore and final sync
- Proxy assignment and connectivity test
- Runtime installation
- Extension installation
- Batch profile creation

Do not mix unrelated feature slices in one task.

### Scope discipline

For every task:

- Write the exact objective.
- Identify in-scope modules.
- Identify explicit non-goals.
- Avoid opportunistic repository-wide refactors.
- Fix adjacent defects only when they block correctness or safety.
- Report any deferred issue instead of silently expanding scope.

---

## 5. REQUIRED WORKFLOW

### Phase A — Inspect

Before editing:

1. Read the task and constraints.
2. Run `git status`.
3. Identify the active branch and current commit.
4. Read relevant rule and skill files.
5. Locate entry points, contracts, repositories, adapters, and tests.
6. Trace the current end-to-end flow.
7. Search for existing helpers before adding new ones.
8. Identify ownership and source of truth.
9. Reproduce the bug when the task is a bug fix.
10. Write a short implementation plan.

Never start by editing the first file containing the error message.

### Phase B — Design

Choose the smallest complete design.

The design must answer:

- Who owns this state?
- Where is it persisted?
- Which contract crosses the boundary?
- How is input validated?
- What is the success path?
- What are the failure paths?
- What resources require cleanup?
- Is the operation idempotent?
- How is concurrency controlled?
- How will it be tested?
- How will it be observed in development?

Avoid speculative abstractions. Introduce an abstraction only when it creates a clear boundary or removes meaningful duplication.

### Phase C — Implement

During implementation:

- Keep diffs focused.
- Follow existing module boundaries.
- Reuse shared types and schemas.
- Preserve backward compatibility unless the task explicitly changes it.
- Handle success, failure, timeout, cancellation, crash, and cleanup where applicable.
- Update tests alongside the implementation.
- Do not leave temporary debug hacks in final code.
- Do not modify generated `dist/`, `out/`, build artifacts, browser binaries, or dependency lockfiles unless required by the task.

### Phase D — Verify

Run the narrowest relevant checks first, then broader checks.

Expected categories:

```text
typecheck
lint
format:check
unit tests
integration tests
build
real smoke test
```

For runtime features, mocked tests alone are insufficient.

Examples requiring real smoke verification:

- browser launch
- browser stop
- profile lock
- persistent user-data directory
- cookie persistence
- IPC between real processes
- local API
- runtime executable resolution
- installer/download flow

### Phase E — Report

Use the required report format in Section 18.

---

## 6. CODE QUALITY RULES

### 6.1 TypeScript

- `strict` typing is mandatory.
- Do not add explicit `any`.
- Do not add `as any`.
- Treat external, IPC, JSON, database, environment, and filesystem input as `unknown`.
- Validate unknown data with schemas or type guards.
- Prefer discriminated unions for stateful results.
- Prefer `readonly` for immutable contracts.
- Reuse exported shared types.
- Do not duplicate unions such as engines, distributions, architectures, states, or error codes.
- Use exhaustive switches with a `never` check for closed unions.
- Use `ErrorOptions.cause` or a typed error wrapper when preserving causes.
- Never rely on string matching for application control flow when a typed code is available.

### 6.2 Functions and classes

- Functions should have one clear responsibility.
- Prefer early returns over deeply nested conditions.
- Keep orchestration readable as a linear sequence.
- Extract logic only when the extracted name adds meaning.
- Avoid pass-through classes with no ownership or policy.
- Avoid “manager”, “helper”, and “utils” abstractions with vague responsibility.
- Constructor injection is preferred at system boundaries and for testability.
- Do not force every service into a singleton. Use singleton lifetime only when the application architecture requires one shared instance.
- Never place database queries, process spawning, or network calls directly in React components.

### 6.3 Concision

“Short code” means low accidental complexity, not compressed syntax.

Prefer:

```ts
const profile = repository.findById(profileId);
if (!profile) throw ProfileError.notFound(profileId);
```

Avoid:

```ts
const profile = repository.findById(profileId) ?? (() => { throw new Error('x'); })();
```

Do not use clever one-liners that reduce debuggability.

### 6.4 Naming

Names must communicate domain intent.

Good:

- `resolveBrowserRuntime`
- `transitionSession`
- `releaseProfileLock`
- `validateLaunchCommand`

Bad:

- `handleData`
- `processThing`
- `doStuff`
- `manager2`
- `tempFix`

Booleans should read naturally:

- `isReady`
- `hasActiveSession`
- `shouldCache`
- `canUseOfflineCache`

---

## 7. ARCHITECTURE RULES

### 7.1 Single source of truth

Each concern must have one owner.

Examples:

- Runtime session durability: SQLite in Electron Main.
- Live Playwright handle: browser-launcher.
- Shared IPC shape: `packages/shared`.
- Profile editor draft: renderer state.
- Persisted profile: profile repository.
- Runtime manifest: runtime registry/manifest subsystem.

Do not maintain competing state in multiple layers without a defined synchronization contract.

### 7.2 Boundaries

Use explicit boundaries:

- UI component → hook/controller
- controller → application service
- application service → repository/port
- Electron Main → child process through validated shared IPC contracts
- runtime orchestration → adapters for Playwright/filesystem/process operations

No renderer access to Node, filesystem, SQLite, child process, or secrets.

### 7.3 Dependency direction

High-level application policy must not depend directly on low-level implementation details.

Preferred:

```text
ProfileService
  → BrowserRuntimePort
      → LauncherClient
```

Avoid:

```text
ProfileService
  → child_process.fork()
```

### 7.4 State machines

Runtime and sync states must be explicit unions with documented valid transitions.

A transition must:

- validate the current state when needed
- update durable state atomically
- append the corresponding event transactionally
- reject or safely ignore duplicates according to documented policy
- never create silent state regression

Do not scatter string states and sequence numbers across modules.

### 7.5 Idempotency

Commands that may be retried must have a stable idempotency strategy.

Examples:

- profile launch
- profile stop
- runtime install
- sync mutation
- migration
- cookie flush

A retry must not create duplicate sessions, duplicate events, duplicate installs, or data corruption.

---

## 8. ELECTRON AND IPC RULES

### 8.1 Security

Electron windows must follow:

- `contextIsolation: true`
- `nodeIntegration: false`
- minimal preload surface
- no direct renderer access to secrets
- no arbitrary command execution
- no unvalidated IPC payloads
- no exposing raw Error objects to renderer
- no remote content with privileged preload access unless explicitly hardened

### 8.2 IPC contracts

Every IPC channel requires:

- shared typed request
- runtime input validation
- typed success result
- typed safe failure
- stable channel name
- no secret fields
- compatibility consideration

The preload must expose a narrow domain API, not generic `invoke(channel, payload)` access.

### 8.3 Child-process IPC

Messages between `desktop-client` and `browser-launcher` must:

- use contracts from `packages/shared`
- be validated on receipt
- include request correlation for commands
- preserve stable error codes and safe details
- use explicit event contracts
- avoid raw class instances
- avoid leaking stack traces in production
- avoid cookies, proxy passwords, fingerprint payloads, keys, and tokens in logs or error details

### 8.4 Lifecycle

Every listener added to:

- `ipcMain`
- `webContents`
- `BrowserWindow`
- child process
- event emitter

must have a clear lifetime and cleanup policy.

Avoid duplicate registration during hot reload or window recreation.

---

## 9. BROWSER LAUNCHER RULES

### 9.1 Launch ownership

`browser-launcher` owns:

- runtime verification
- profile lock acquisition
- browser process creation
- Playwright connection/context
- fingerprint injection
- browser readiness checks
- live session registry
- runtime cleanup

Electron Main owns the durable record of the session and the globally ordered event stream.

### 9.2 Launch flow

A launch implementation should remain easy to inspect:

```text
validate command
→ build launch plan
→ verify duplicate session
→ resolve runtime
→ acquire lock
→ launch browser
→ connect/obtain context
→ restore cookies
→ inject fingerprint
→ readiness verification
→ register live session
→ report running
```

Failure at any stage must unwind acquired resources in reverse order.

### 9.3 Cleanup scope

Track acquired resources explicitly:

- durable profile lock
- process handle
- Playwright browser
- browser context
- pages
- cookie synchronization timer
- lifecycle listener
- registry entry

Cleanup must be:

- idempotent
- safe after partial initialization
- safe when invoked twice
- tolerant of already-closed resources
- observable when an unexpected failure occurs

### 9.4 Runtime resolution

Runtime selection must be deterministic.

Allowed:

- exact requested runtime
- an explicit `latest` request mapped to registered `latest`
- an explicitly documented compatibility rule

Forbidden:

- arbitrary first matching runtime
- silently changing major browser version
- falling back to system Chrome without policy
- accepting a path outside the runtime root
- launching an executable that was not verified

### 9.5 Persistent profiles

A browser profile must use one isolated user-data directory.

- Never allow two active sessions to own the same profile directory.
- Do not use the user's normal Chrome profile directory.
- Lock ownership must be durable and recoverable.
- Startup and shutdown must preserve intended browser data.
- Cache clearing must have explicit semantics and must not accidentally delete extensions or login data.

### 9.6 Fingerprint timing

Fingerprint configuration must be active before external page scripts execute.

- Use init-script or browser-core mechanisms at the correct lifecycle point.
- Do not open user startup URLs before injection and readiness.
- Verify expected markers and critical properties.
- Do not claim native-level spoofing when implementation is JavaScript-level injection.

---

## 10. FINGERPRINT RULES

### 10.1 Consistency over randomness

A valid fingerprint is a coherent environment, not a random collection of values.

Maintain consistency between:

- browser version
- user agent
- client hints
- platform
- architecture
- screen size
- device characteristics
- locale
- timezone
- geolocation
- WebGL/GPU
- fonts
- headers
- proxy geography

Do not independently randomize fields that are statistically or logically linked.

### 10.2 Envelope integrity

Fingerprint envelopes must:

- use an explicit schema version
- be validated before mapping
- preserve generator and dataset versions
- be checked for target engine and OS
- be checked for runtime compatibility
- have valid timestamps
- be signature-verified when originating from a trusted remote service
- never be trusted merely because TypeScript says the shape is correct

### 10.3 Development mode

Local development fingerprint generation must be clearly marked and forbidden in production.

Development polyfills must:

- satisfy the real schema
- remain deterministic enough for tests
- not weaken production validation
- avoid hidden default values that create impossible configurations

### 10.4 Logging

Never log the full fingerprint, signed envelope, signature material, or sensitive headers.

Log only:

- fingerprint ID
- schema version
- generator version
- target engine/OS
- compatibility result
- safe validation error code

---

## 11. DATABASE AND MIGRATION RULES

### 11.1 SQLite ownership

Only trusted Electron Main/database modules may access the application SQLite database.

Repositories own SQL. Services own application policy.

### 11.2 Transactions

Use transactions for multi-step invariants, especially:

- session creation plus first event
- state transition plus event append
- profile update plus outbox operation
- migration rebuild
- sync conflict resolution
- runtime installation metadata finalization

With `better-sqlite3`, remember:

```ts
const run = db.transaction(() => {
  // statements
});
run();
```

Do not assume `db.transaction(callback)` executes immediately.

### 11.3 Migrations

Migrations are forward-only once committed.

- Never edit a previously released/applied migration to repair existing databases.
- Add a new migration.
- Use schema introspection for legacy variants.
- Preserve user data.
- Rebuild tables atomically when SQLite cannot alter the schema safely.
- Restore foreign-key settings.
- run `PRAGMA foreign_key_check`.
- make migrations idempotent at the runner level.
- include an upgrade test from the actual legacy shape.
- do not fix migration bugs by instructing users to delete `app.db`.

During early local development, resetting a local database may be used for diagnosis, but it is not an accepted implementation.

### 11.4 Optimistic concurrency

Enforce version checks atomically in SQL:

```sql
UPDATE ...
SET version = version + 1
WHERE id = ?
  AND version = ?
```

Do not use:

```text
SELECT version
→ compare in JavaScript
→ UPDATE without version predicate
```

Background runtime updates must not unexpectedly increment an editor-facing version unless that behavior is explicitly designed.

### 11.5 Query safety

- Use bound parameters.
- Never interpolate user input into SQL identifiers or values.
- Dynamic table/column names require a closed internal allowlist.
- Parse JSON columns safely.
- Do not hide malformed persisted data with unsafe casts.

---

## 12. PROXY, NETWORK, AND SECRET RULES

### 12.1 Secret handling

Never log or expose:

- proxy passwords
- API keys
- bearer tokens
- cookies
- local API keys
- signing private keys
- cloud credentials
- raw authorization headers

Use credential references or secure storage rather than plain-text persistence where available.

### 12.2 Proxy configuration

Validate:

- protocol
- host
- port
- auth mode
- username/password pairing
- supported runtime behavior

Proxy testing must have:

- timeout
- cancellation
- normalized error categories
- latency measurement
- no implicit fallback to direct connection when safety policy forbids it

### 12.3 Network safety

If a profile requires proxy/network protection:

- fail closed when proxy setup fails
- do not open external pages before network safety is confirmed
- detect relevant network/IP changes according to profile policy
- stop or warn according to explicit policy
- do not make claims of DNS/WebRTC leak protection without tests

---

## 13. REACT AND UI RULES

### 13.1 Component responsibility

React components should focus on rendering and interaction.

Keep out of components:

- raw IPC orchestration
- database logic
- process control
- complex normalization
- long-running side effects
- duplicated domain state machines

Use hooks/controllers/services with explicit contracts.

### 13.2 State

- Use one owner for each state.
- Do not mirror props into state without a synchronization reason.
- Avoid storing derived values.
- Keep server/persisted state distinct from unsaved draft state.
- Handle loading, empty, success, conflict, and failure states.
- Debounce only when the product behavior requires it.
- Cancel stale async effects.

### 13.3 Interaction

Every interactive element must have:

- clear click target
- disabled behavior
- loading behavior
- hover/focus/active state
- keyboard accessibility
- visible focus
- no click handling on an entire container when only a child action should be interactive

Avoid tooltips that obscure the target or viewport.

### 13.4 Forms

- Validate at the boundary.
- Preserve unsaved user input on recoverable errors.
- Do not submit repeatedly while a request is active.
- Use returned persisted records to refresh version/revision state.
- Make create and edit share schema/components where practical without forcing inappropriate abstraction.

---

## 14. UI DESIGN SYSTEM

The current UI source of truth is defined in this repository's design rules and CSS tokens.

Mandatory:

- Dark desktop workspace by default.
- React with vanilla CSS.
- No Tailwind utility classes.
- No inline styles.
- No CSS-in-JS.
- Use CSS custom-property tokens.
- Use BEM naming.
- Reuse shared controls.
- Keep data-dense desktop proportions.
- Avoid arbitrary colors, spacing, radii, or shadows.

Before UI edits, inspect existing token definitions and shared components.

Do not duplicate button/input/table/dialog styles in page-local CSS when a shared component exists.

### Accessibility

- Semantic elements first.
- Labels for form controls.
- Keyboard navigation.
- `aria-*` only when semantic HTML is insufficient.
- Contrast must remain usable in dark and light themes.
- Do not encode state using color alone.

---

## 15. ERROR, LOGGING, AND OBSERVABILITY RULES

### 15.1 Typed errors

Use stable domain error codes.

A cross-process error should include only safe fields:

```ts
interface SafeError {
  code: StableErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

Preserve known error codes across:

```text
origin
→ serializer
→ IPC
→ deserializer
→ application mapper
→ UI
```

Known errors must not become `UNKNOWN_ERROR` or `INTERNAL_ERROR`.

### 15.2 Safe messages

- Internal logs may contain sanitized technical context in development.
- UI receives safe actionable text.
- Production responses must not expose stack traces, paths, secrets, SQL, or internal topology.

### 15.3 Stage tracking

For multi-stage operations, attach a typed stage:

```text
profile_load
fingerprint_prepare
proxy_resolve
session_create
runtime_resolve
lock_acquire
browser_start
browser_connect
cookie_restore
fingerprint_inject
readiness
session_finalize
cleanup
```

Stage information should aid diagnosis without duplicating a heavy tracing framework.

### 15.4 Logging standard

Logs should include:

- timestamp
- level
- component
- operation
- stable identifiers
- stage
- safe error code

Prefer structured metadata over concatenated secret-prone strings.

Do not log successful hot-loop events excessively.

---

## 16. RESOURCE AND MEMORY SAFETY

Every acquired resource needs an owner and release path.

Check:

- `setTimeout`
- `setInterval`
- event listeners
- subscriptions
- child processes
- Playwright Browser
- BrowserContext
- Page
- sockets
- servers
- file handles
- temporary directories
- profile locks
- caches
- Maps/Sets

Rules:

- Store timer handles as `ReturnType<typeof setTimeout>` or `ReturnType<typeof setInterval>`.
- Clear timers on stop, shutdown, error, and replacement.
- Remove listeners on teardown.
- Make cleanup idempotent.
- Avoid closures retaining large fingerprint or cookie payloads.
- Bound event buffers and caches.
- Do not use unbounded retry loops.
- Abort or ignore stale async operations.

When modifying lifecycle code, load the memory-leak skill and add cleanup tests.

---

## 17. TESTING STANDARD

### 17.1 Test pyramid

Use:

- unit tests for pure validation and policy
- integration tests for SQLite, IPC adapters, repositories, migrations
- smoke tests for real process/runtime behavior
- end-to-end tests only for critical user journeys

### 17.2 Meaningful tests

Test invariants, not implementation trivia.

Examples:

- only one active session per profile
- session exists before child state event
- transition plus event append is atomic
- duplicate runtime event is idempotent
- lock is released on partial launch failure
- exact runtime does not silently fall back
- fingerprint is applied before external page
- cookie sync does not invalidate profile editor version
- legacy migration preserves profiles

### 17.3 Mocks

- Mock external boundaries, not the entire system under test.
- Match real library behavior.
- A `better-sqlite3` transaction mock must return a callable transaction.
- Prefer real in-memory SQLite for repository invariants.
- Prefer a local HTTP server over external websites.
- Do not make tests pass by weakening production validation.

### 17.4 Runtime smoke tests

A runtime smoke test must report stages and cleanup.

Use:

- managed test runtime
- temporary user-data directory
- `about:blank` or local server
- deterministic fingerprint fixture
- automatic stop
- lock and temp cleanup

Do not depend on Cloudflare or other public services in automated tests.

### 17.5 Verification honesty

Allowed statuses:

- `PASS` — command ran and exited successfully.
- `FAIL` — command ran and failed.
- `NOT RUN` — command was not executed.
- `NOT VERIFIED` — implementation exists but real behavior was not confirmed.
- `BLOCKED` — external condition prevented verification.

Never convert `NOT VERIFIED` into “should work”.

---

## 18. REQUIRED COMPLETION REPORT

Every completed coding task must use this format:

```markdown
## Task
Task ID, scope, and objective.

## Skills loaded
List the skill files actually read.

## Root cause / Current gap
The verified cause or missing behavior.
For new features, describe the prior gap.

## Design
The chosen design and ownership decisions.

## Files changed
- `path`: exact change
- `path`: exact change

## Behavior before
Observed previous behavior.

## Behavior after
Verified new behavior.

## Tests added or updated
- test name: invariant
- test name: invariant

## Commands executed
- `command`
  - exit code:
  - result:

## Real smoke test
- status: PASS / FAIL / NOT RUN / NOT VERIFIED / BLOCKED
- exact steps:
- relevant sanitized logs:

## Security and cleanup
State how secrets, processes, locks, timers, listeners, and temporary files were handled.

## Remaining issues
Only real outstanding issues.

## Commit
- SHA:
- message:
```

Forbidden unsupported phrases:

- “fully production ready”
- “works perfectly”
- “100% complete”
- “all tests pass” without exact command output
- “Chromium will now open” without a real smoke run
- “no issues remain” without evidence

---

## 19. GIT RULES

Before changes:

```text
git status
git branch --show-current
git rev-parse HEAD
```

Rules:

- Do not overwrite unrelated user changes.
- Do not use destructive reset, checkout, clean, or force push without explicit permission.
- Do not amend another person's commit without permission.
- Keep commits focused.
- Use descriptive commit messages.
- Do not commit secrets, `.env`, databases, logs, runtime binaries, generated output, or temporary profiles.
- Review `git diff --check`.
- Review the final diff before reporting completion.

Suggested commit format:

```text
feat(profile): complete Chromium launch lifecycle
fix(database): repair legacy fingerprint cache schema
refactor(launcher): centralize session sequence ownership
test(runtime): add managed Chromium smoke harness
```

Avoid commit messages such as:

```text
new
oke
fix
update
done
```

---

## 20. COMMAND AND TOOL RULES

- Use the repository-pinned package manager and versions.
- Respect PNPM workspace filters.
- Inspect package scripts before inventing commands.
- Do not globally install dependencies to solve a repository task.
- Do not change PNPM/Node versions without scope justification.
- Do not use external network services in tests unless explicitly requested.
- Do not download browser binaries into Git.
- Use platform-portable path APIs.
- Treat Windows and POSIX absolute paths correctly.
- Quote paths safely.
- Keep terminal output and files UTF-8.

---

## 21. SECURITY REVIEW CHECKLIST

Before finalizing, inspect for:

- secret exposure
- unsafe IPC
- path traversal
- command injection
- SQL injection
- insecure temporary files
- arbitrary file deletion
- unsafe archive extraction
- proxy credential logging
- cookie/fingerprint logging
- signature bypass
- production use of local development providers
- renderer privilege escalation
- untrusted remote content in Electron
- missing timeout
- fail-open network behavior

Any discovered security issue in the edited flow must be fixed or reported explicitly.

---

## 22. FEATURE-SPECIFIC DEFINITION OF DONE

A feature is done only when:

1. Its input and output contracts are defined.
2. Its happy path works.
3. Relevant failure paths work.
4. Persistence and state ownership are correct.
5. Cleanup is correct.
6. Security constraints are satisfied.
7. Tests cover core invariants.
8. Required checks pass.
9. Real behavior is verified when the feature depends on runtime integration.
10. The final report contains evidence.

A green mocked unit test alone is not a completed runtime feature.

---

## 23. STOP CONDITIONS

Stop and report instead of guessing when:

- a required secret or credential is unavailable
- a runtime binary is missing and download is outside scope
- the task conflicts with current user changes
- a destructive migration is required but not authorized
- product behavior is ambiguous and cannot be inferred from code/docs
- a real smoke test requires user interaction unavailable to the agent
- an external system is unavailable

Provide:

- exact blocker
- evidence
- completed work
- safest next action

---

## 24. FINAL OPERATING PRINCIPLE

Build each function as a clean product capability:

```text
correct
→ deterministic
→ secure
→ observable
→ testable
→ maintainable
→ verified
```

Do not optimize for impressive reports. Optimize for working code and trustworthy evidence.