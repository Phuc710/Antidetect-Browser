# RFC-0027 — Browser Fingerprint Injection Pipeline

| Field | Value |
|-------|-------|
| **RFC Number** | 0027 |
| **Status** | **Approved** |
| **Revision** | 003 |
| **Created** | 2026-07-18 |
| **Revised** | 2026-07-18 (REVISION-003 — RFC-0027-FINALIZE: Owner decisions applied, RFC Approved) |
| **Author** | Core Agent (Desktop Main Process) |
| **Related** | RFC-0005 (Core Runtime), RFC-0006 (Profile Model), RFC-0025 (Proxy Management), RFC-0027A (Cloud Fingerprint Issuance API — separate backend RFC) |
| **Approved by** | Project Owner — 2026-07-18 |
| **Production Enablement** | **Blocked** until RFC-0027A (Cloud Fingerprint Issuance API) is deployed and integrated. Approval of this RFC does not indicate production-readiness. |

---

## 0. Revision History

| Rev | Date | Summary of Changes |
|-----|------|-------------------|
| 000 | 2026-07-18 | Initial draft |
| 001 | 2026-07-18 | CHANGES_REQUIRED: HMAC → Ed25519, fail-closed rollback, compatibility matrix, runtime abstraction Option B, readiness probe, separate cache table, cloud sequencing, test strategy |
| 002 | 2026-07-18 | Owner design decisions applied: BrowserRuntimeSession interface, Ed25519 confirmed, expiry policy (24h + 5min skew), offline launch rule, cache table confirmed, Phase 1 scope (chromium/chrome/edge), readiness sequence, ASAR handling, at-rest protection policy, open questions resolved/narrowed |
| 003 | 2026-07-18 | RFC-0027-FINALIZE: All remaining open questions resolved per owner. Canonical serialization replaced with deterministic JCS (RFC 8785). ASAR decision: Phase 1 uses explicit `asarUnpack`. Compatibility matrix acceptance criteria finalized. RFC status set to **Approved**. Production enablement dependency on RFC-0027A recorded. |

---

## 1. Context

The Desktop Client can launch Chromium and Firefox browser processes via `BrowserApplicationService` backed by `PlaywrightProcessLauncher`. The browser opens a blank, un-fingerprinted context: no User-Agent override, no navigator/screen/WebGL spoofing, no generated HTTP headers are injected.

The `packages/fingerprint-injector` library provides a complete injection engine (`FingerprintInjector`). The `packages/fingerprint-generator` library provides a Bayesian-network fingerprint generator (`FingerprintGenerator`). **No wiring exists** between the browser launch lifecycle in `BrowserApplicationService` and these packages.

A stub `CloudFingerprintProvider` in `fingerprint-provider.ts` returns a hard-coded static User-Agent. This stub must not be shipped to production users and is a correctness risk in the current codebase.

This RFC (Revision 003) incorporates all owner design decisions from the Design Review held on 2026-07-18. All open questions are resolved. The RFC is **Approved**; production enablement remains blocked pending RFC-0027A (Cloud Fingerprint Issuance API).

---

## 2. Goals

1. Define a versioned, Ed25519-signed `FingerprintEnvelope` contract.
2. Establish Cloud (Ed25519-signed) as the only source of production fingerprints; generator runs server-side only.
3. Define a `DevelopmentFingerprintProvider` wrapping the local `FingerprintGenerator` for development and test only — with strict fail-closed production guard.
4. Define the injection lifecycle and readiness verification sequence exactly, using the `BrowserRuntimeSession` interface.
5. Define validation, compatibility, and failure contracts that fail closed in all production error paths.
6. Ensure Playwright types do not leak into domain/shared contracts.
7. Define the `fingerprint_envelopes_cache` SQLite table design.
8. Establish Cloud dependency sequencing (RFC-0027A before production enablement).
9. Design a test plan with no external URL dependencies.
10. Document at-rest protection policy honestly (Phase 1: OS permissions + log redaction; no SQLite encryption).

---

## 3. Non-goals

- **Cloud Backend implementation**: `RFC-0027A` is a separate backend RFC with separate ownership.
- **Proxy wiring**: `RFC-0028`.
- **Cookie injection**: separate RFC.
- **Extension loading**: separate RFC.
- **WebKit support**: deferred.
- **Brave support**: deferred — no executable resolver, no integration test.
- **Firefox support**: deferred — `launchServer`+`connect` path unverified in Electron context, injection not CI-proven.
- **GeoIP coherence**: envelope reserves fields; not implemented Phase 1.
- **SQLCipher / encrypted SQLite cache**: separate security task; not Phase 1.
- **Cloud Fingerprint Issuance API**: separate backend RFC (RFC-0027A).

---

## 4. Terminology

| Term | Definition |
|------|-----------|
| **FingerprintEnvelope** | The complete Ed25519-signed object transported from Cloud to Desktop. |
| **payload** | `{ fingerprint: Fingerprint; headers: Headers }` inside the envelope — the actual injection data. |
| **signedEnvelopeJson** | The canonical JSON serialization of `FingerprintEnvelope`, stored in `fingerprint_envelopes_cache.signed_envelope_json`. |
| **BrowserRuntimeSession** | The domain-level interface returned after a browser process is started and a context is prepared. Playwright types do not appear in this interface. |
| **PlaywrightRuntimeAdapter** | Internal implementation of `BrowserRuntimeSession` that owns `BrowserServer`, `Browser` client, and `BrowserContext`. Not exposed outside the service. |
| **Provider** | An `IFingerprintProvider` implementation. |
| **Injection** | Calling the Playwright adapter's `applyPrePageConfiguration()` to register headers and init script before any user page is created. |
| **Readiness** | State confirmed by the `about:blank` probe that injection is active. Only after readiness is `running` emitted. |
| **Persistent profile metadata** | `ProfileCacheRow` in `profiles_cache` — engine, distribution, os, etc. Fingerprint envelopes are NOT stored here. |
| **Fingerprint cache** | `fingerprint_envelopes_cache` — separate SQLite table. |
| **Ephemeral runtime state** | In-memory `ActiveSession` held by `BrowserApplicationService` for the lifetime of a browser process. |
| **ApplicationMode** | Typed enum: `production` | `development` | `test` | `integration_test`. Derived at startup from `app.isPackaged` + `NODE_ENV` + optional build flag. |

---

## 5. Existing Code Audit

### 5.1 `packages/fingerprint-generator`

- `FingerprintGenerator.getFingerprint()` → `BrowserFingerprintWithHeaders`.
- Bayesian network zip loaded at instantiation (~250ms cold start).
- **Development/test adapter only.** Not production: algorithm exposed client-side; dataset cannot be updated without a client release.
- Compatible with Electron Main process (uses `__dirname`/`readFileSync`).

### 5.2 `packages/fingerprint-injector`

- `attachFingerprintToPlaywright(browserContext, fingerprint)`:  
  1. `setExtraHTTPHeaders(filteredHeaders)`.
  2. `browserContext.on('page', page.emulateMedia({ colorScheme: 'dark' }))`.
  3. `addInitScript({ content })`.
- Uses `readFileSync(__dirname/../utils.js)` at instantiation — Main process only.
- Contains one `@ts-expect-error Accessing private property` (`browserContext._options`) — fragile Playwright internal API; documented as a known touch-point.
- **Reusable in Main process / Playwright adapter.** ASAR packaging requires explicit handling (§9).

### 5.3 `packages/launcher`

- **Empty directory.** Not usable.

### 5.4 `BrowserApplicationService` (current gap)

- Emits `running` immediately after PID — **before any fingerprint injection**.
- `PlaywrightProcessLauncher` uses `launchServer()` and does not obtain a `BrowserContext`.
- Injection step and readiness probe are entirely absent.

### 5.5 `FingerprintEnvelope` v1 (current — must be replaced)

```typescript
export interface FingerprintEnvelope {
  schemaVersion: number;
  generatorVersion: string;
  browserEngine: BrowserEngine;
  minimumKernelVersion: string;
  generatedAt: string;
  payload: Record<string, unknown>; // untyped, unsigned, no expiry
}
```

Must be replaced with v2 (§7). Old v1 fields are deprecated; `schemaVersion: 1` must be rejected.

---

## 6. Cloud Dependency Sequencing

```
RFC-0027A  Cloud Fingerprint Issuance API      ← separate backend RFC, not yet authored
     │  Must be deployed and tested before...
     ▼
RFC-0027B  Desktop Envelope Validation + Injection    (this RFC)
     │  Can be developed against Ed25519-signed deterministic test fixtures
     │  Production enablement blocked until RFC-0027A is integrated
     ▼
  Production launch with verified fingerprint injection
```

**Rules (owner decision #8):**
- Cloud Fingerprint Issuance API is a separate backend deliverable.
- Desktop may develop and run integration tests using Ed25519-signed deterministic test fixtures with a dedicated `test:` keypair.
- Production enablement (switching `CloudFingerprintProvider` to the real endpoint) remains blocked until Cloud issuance is integrated and verified.
- `CloudFingerprintProvider` does not hardcode API keys or mock responses. Authentication is obtained via an injected `AuthenticatedTransportClient` abstraction.

---

## 7. FingerprintEnvelope Contract (v2)

### 7.1 Type Definition

```typescript
/**
 * Versioned, Ed25519-signed fingerprint envelope.
 * Transported from Cloud to Desktop via HTTPS.
 * MUST NOT contain proxy credentials, auth tokens, or PII.
 * MUST be verified before injection is permitted.
 *
 * schemaVersion: 2 — defined by RFC-0027.
 */
export interface FingerprintEnvelope {
  readonly schemaVersion: 2;
  readonly fingerprintId: string;              // UUID assigned by Cloud generator
  readonly generatorVersion: string;           // semver of Cloud generator (e.g., "2.1.0")
  readonly datasetVersion: string;             // dataset build date (e.g., "2026-02-01")
  readonly targetEngine: 'chromium' | 'firefox';
  readonly targetOs: 'windows' | 'mac' | 'linux';
  readonly compatibleRuntimeRange: string;     // semver range (e.g., ">=120.0.0.0 <140.0.0.0")
  readonly generatedAt: string;                // ISO-8601 UTC
  readonly expiresAt: string;                  // ISO-8601 UTC; server-supplied; max 24h from generatedAt
  readonly payload: {
    readonly fingerprint: Fingerprint;         // packages/fingerprint-generator type
    readonly headers: Record<string, string>;  // coherent generated HTTP headers
  };
  readonly coherence?: {                       // Phase 1b; reserved; may be absent in Phase 1
    readonly locale: string;
    readonly timezone: string;
    readonly acceptLanguage: string;
  };
  readonly signature: {
    readonly algorithm: 'ed25519';
    readonly keyId: string;                    // identifies which public key in the pinned bundle
    readonly value: string;                    // base64url-encoded 64-byte Ed25519 signature
  };
  readonly cloudRevision?: string;             // optional server cache coherence field
}
```

**Key invariant:** `Fingerprint` type is imported from `packages/fingerprint-generator`. This is the correct dependency direction: the desktop shared contract depends on the generator type, not the other way around. No implementation package is reverse-imported.

### 7.2 Canonical Serialization for Signature (owner decision #6)

Canonical serialization **must not** rely on TypeScript interface declaration order or JavaScript object insertion order. Both are undefined from a protocol perspective and would produce different byte sequences across implementations, runtimes, or serializers.

**Required algorithm: JSON Canonicalization Scheme (JCS), RFC 8785.**

JCS (RFC 8785) defines a deterministic canonical JSON serialization:
- Object keys are sorted lexicographically by Unicode code point (UTF-16 code unit comparison).
- No whitespace (compact serialization).
- Unicode strings serialized as per RFC 8785 §3.2.2.
- Numbers serialized as per RFC 8785 §3.2.3 (no trailing zeros, no unnecessary exponents).
- Recursively applied to nested objects and array elements.

**Sign input construction:**

1. Take the full `FingerprintEnvelope` object.
2. Delete the `signature` field entirely before canonicalization.
3. If `coherence` is absent (undefined), omit the key entirely (do not serialize as `null`).
4. If `cloudRevision` is absent (undefined), omit the key entirely (do not serialize as `null`).
5. Apply JCS (RFC 8785) to the resulting object to produce a canonical UTF-8 byte sequence.
6. The Ed25519 signature is computed over those exact bytes.

**Pseudocode:**

```typescript
import { canonicalize } from 'canonicalize'; // RFC 8785-compliant library

function buildSignInput(envelope: FingerprintEnvelope): Uint8Array {
  const { signature: _omit, ...rest } = envelope;
  // Remove optional absent fields to prevent null serialization
  if (rest.coherence === undefined) delete (rest as Partial<typeof rest>).coherence;
  if (rest.cloudRevision === undefined) delete (rest as Partial<typeof rest>).cloudRevision;
  const canonical: string = canonicalize(rest); // RFC 8785 output
  return new TextEncoder().encode(canonical);    // UTF-8 bytes
}
```

**Rules:**
- Implementation must use a well-tested RFC 8785-compliant library (e.g., the `canonicalize` npm package or equivalent).
- Cloud signing side and Desktop verification side must use the same RFC 8785 algorithm.
- `signature` field is excluded before canonicalization — it must not appear in the sign input.
- `coherence` and `cloudRevision` are omitted entirely (not set to `null`) when absent.
- Encoding: UTF-8 bytes.
- Do NOT implement a custom sort-based serializer inline; use an audited RFC 8785 library.

### 7.3 Key Management (owner decision #2)

- Cloud holds Ed25519 **private signing key**. Never leaves the server.
- Desktop ships a **pinned public key bundle** (static JSON file, bundled at build time).
  - Format: `Record<keyId, base64url-encoded-public-key>`.
  - Key rotation: new `keyId` entries added to bundle; old entries retained until all envelopes signed with old key have expired. No client reinstall required if new key is pre-bundled.
- Test keypairs use `test:` prefix (e.g., `test:dev-2026`). Test private key is committed as a test fixture (not a secret — valid only for test envelopes).
- Production `keyId` values must not use the `test:` prefix.

### 7.4 Signature Verification Policy (owner decision #2)

| Condition | Action |
|-----------|--------|
| `signature.algorithm` ≠ `"ed25519"` | `FINGERPRINT_INTEGRITY_INVALID` |
| `signature.keyId` not found in pinned bundle | `FINGERPRINT_INTEGRITY_INVALID` |
| `signature.keyId` has `test:` prefix in production mode | `FINGERPRINT_INTEGRITY_INVALID` |
| Ed25519 verification fails | `FINGERPRINT_INTEGRITY_INVALID` |
| `signature` field absent | `FINGERPRINT_INTEGRITY_INVALID` |

**There is no bypass, stub, or "warning and proceed" path in production mode.** This is an owner decision.

---

## 8. Expiry Policy (owner decision #3)

| Rule | Value |
|------|-------|
| Source of `expiresAt` | Server-supplied in envelope |
| Maximum envelope lifetime | 24 hours from `generatedAt` |
| Clock skew tolerance | 5 minutes (Desktop may treat an envelope as valid if `expiresAt` is within 5 minutes in the past) |
| Rejection condition | `expiresAt + 5min ≤ now()` |
| Missing `expiresAt` | Always rejected (`FINGERPRINT_EXPIRED`) |
| Cache eviction | Envelopes with `expires_at + 5min < now()` are treated as expired; background cleanup removes rows where `expires_at < now() - 1h` |

**Clock skew tolerance** applies only to the expiry check, not to `generatedAt`. An envelope with `generatedAt` in the future is suspicious but not independently rejected (only `expiresAt` drives rejection).

---

## 9. Offline Launch Policy (owner decision #4)

Offline launch with a cached envelope is **permitted** only when all of the following conditions are met:

1. `fingerprint_envelopes_cache` has a row for the profile.
2. Ed25519 signature is valid (verified against pinned key bundle).
3. Envelope is not expired (`expiresAt + 5min > now()`).
4. `targetEngine` matches the profile's engine.
5. `targetOs` matches the profile's OS.
6. `compatibleRuntimeRange` includes the browser version that will be launched (if runtime version is known).
7. Local license state permits launch (license check is outside the scope of this RFC; assumed to be enforced by the calling service).

**If any condition fails, the launch fails closed.** No degraded plain browser launch.

Phase 1 fetch strategy: always re-fetch from Cloud on launch; store result in cache. Cache hits (without re-fetch) are used only when Cloud is unreachable (offline mode). Phase 1 implementation may start with always-fetch and introduce cache-hit optimization in Phase 1b.

---

## 10. Provider Architecture

### 10.1 `IFingerprintProvider` Interface

```typescript
// Domain layer — no Playwright, no HTTP library imported
export interface IFingerprintProvider {
  getVerifiedEnvelope(options: {
    readonly targetEngine: 'chromium' | 'firefox';
    readonly targetOs: 'windows' | 'mac' | 'linux';
    readonly profileId: string;
  }): Promise<FingerprintEnvelope>;
}
```

The returned envelope has already had its signature verified by the provider. Callers in `BrowserApplicationService` still run the full content validation chain (§12.1) but do not re-verify the signature redundantly.

### 10.2 `ApplicationMode` (replaces bare `NODE_ENV` check)

```typescript
export type ApplicationMode = 'production' | 'development' | 'test' | 'integration_test';
```

Derived at startup from:
- `app.isPackaged` → always `production`.
- `process.env.NODE_ENV` if not packaged.
- Optional `DESKTOP_MODE` build flag for explicit override in integration test harness.

Injected into the factory; not read inside providers.

### 10.3 `CloudFingerprintProvider` (Production only)

- Calls the Cloud Fingerprint Issuance API (RFC-0027A endpoint).
- Authentication via injected `AuthenticatedTransportClient` — not hardcoded.
- Receives `FingerprintEnvelope` JSON in response body.
- Verifies Ed25519 signature before returning.
- On network error / 5xx: throws `FINGERPRINT_SERVICE_UNAVAILABLE`.
- On 4xx (profile-related): throws `FINGERPRINT_MISSING` or `FINGERPRINT_SCHEMA_UNSUPPORTED`.
- **Zero mock data paths.** Not configured → factory throws at startup.

### 10.4 `DevelopmentFingerprintProvider` (Dev/Test only)

- Calls local `FingerprintGenerator.getFingerprint({ browsers, operatingSystems })`.
- Wraps result in a `FingerprintEnvelope v2`.
- Signs it with the test Ed25519 keypair (test private key committed as test fixture).
- Logs a prominent `[DEV ONLY — not for production]` warning at every call.
- Secondary defensive guard: throws `LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION` if `mode === 'production'`.

### 10.5 Factory

```typescript
function createFingerprintProvider(
  mode: ApplicationMode,
  config: FingerprintProviderConfig,
): IFingerprintProvider {
  if (mode === 'production') {
    if (!config.cloudApiBaseUrl) {
      throw new Error(
        '[FATAL] FINGERPRINT_SERVICE_UNAVAILABLE: Cloud API not configured. ' +
        'Desktop cannot launch without a fingerprint source in production.'
      );
    }
    return new CloudFingerprintProvider(config.cloudApiBaseUrl, config.transport);
  }
  if (mode === 'development' || mode === 'test' || mode === 'integration_test') {
    return new DevelopmentFingerprintProvider(config.testKeyPair);
  }
  throw new Error(`Unknown ApplicationMode: ${mode satisfies never}`);
}
```

---

## 11. Validation Contract

### 11.1 Validation Pipeline (ordered; all run before process start)

```
1. validateSchemaVersion(envelope)         → FINGERPRINT_SCHEMA_UNSUPPORTED
2. validateSignature(envelope, keyBundle)  → FINGERPRINT_INTEGRITY_INVALID
   (signature step 2 — prevents tampering with subsequent fields)
3. validateExpiry(envelope, now)           → FINGERPRINT_EXPIRED
4. validateEngineMatch(envelope, profile)  → FINGERPRINT_ENGINE_MISMATCH
5. validateOsMatch(envelope, profile)      → FINGERPRINT_OS_MISMATCH
6. validateRuntimeRange(envelope, version) → FINGERPRINT_RUNTIME_INCOMPATIBLE (if version known)
7. validatePayloadShape(envelope.payload)  → FINGERPRINT_SCHEMA_UNSUPPORTED
```

Steps 1–7 all run before `acquireInProcessMutex()`. Validation failure does not acquire any lock and does not create a session record.

### 11.2 Error Codes

| Code | Trigger |
|------|---------|
| `FINGERPRINT_SERVICE_UNAVAILABLE` | Cloud provider not configured, unreachable, or returned 5xx |
| `FINGERPRINT_MISSING` | Provider returned null; no valid cached envelope |
| `FINGERPRINT_SCHEMA_UNSUPPORTED` | `schemaVersion` ≠ 2, payload shape invalid |
| `FINGERPRINT_INTEGRITY_INVALID` | Ed25519 failure, unknown keyId, test key in production, missing signature |
| `FINGERPRINT_EXPIRED` | `expiresAt + 5min ≤ now()`, or field absent |
| `FINGERPRINT_ENGINE_MISMATCH` | `targetEngine` ≠ profile engine |
| `FINGERPRINT_OS_MISMATCH` | `targetOs` ≠ profile OS |
| `FINGERPRINT_RUNTIME_INCOMPATIBLE` | Browser version outside `compatibleRuntimeRange` |
| `FINGERPRINT_INJECTION_FAILED` | Playwright adapter threw during `applyPrePageConfiguration()` |
| `FINGERPRINT_READINESS_FAILED` | `about:blank` probe returned unexpected values |
| `LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION` | `DevelopmentFingerprintProvider` called in production mode |

### 11.3 Failure Policy

**All paths fail closed.**

| Phase | Failure | Recovery Action |
|-------|---------|----------------|
| Before process start | Any validation error | Transition session → `error`, release in-process mutex. No durable lock. |
| After process start, before readiness | `FINGERPRINT_INJECTION_FAILED` or `FINGERPRINT_READINESS_FAILED` | Close `BrowserContext` → close `Browser` client → stop `BrowserServer` → release durable lock → release in-process mutex → transition session → `error`. |
| Stop/crash | — | Close context → release durable lock → transition → `stopped` / `crashed`. |

**No degraded mode.** No plain browser launch as fallback. No "try with no fingerprint". This is an owner decision.

---

## 12. Runtime Abstraction (owner decision #1)

### 12.1 Ownership Separation

```
BrowserProcessHandle
  (thin — PID + internal wsEndpoint + process lifecycle)
  Owned by: PlaywrightProcessLauncher

PlaywrightRuntimeAdapter
  (internal implementation; owns BrowserServer, Browser client, BrowserContext)
  Owned by: BrowserApplicationService (or injected for testing)
  Implements: BrowserRuntimeSession interface (domain layer)

BrowserRuntimeSession  ← domain interface, NO Playwright types
  Declared in: shared or main service contracts
  Used by: BrowserApplicationService (orchestration only)
```

### 12.2 `BrowserProcessHandle` (unchanged from current)

```typescript
// No change from current shape
export interface BrowserProcessHandle {
  readonly pid: number;
  readonly wsEndpoint: string;           // internal playwright WS URL (not exposed externally)
  stop(): Promise<void>;
  onExit(listener: (exitCode?: number) => void): () => void;
}
```

`wsEndpoint` is internal to the Main process. It is **never** sent to Renderer or Local API clients. External automation clients receive an `AutomationConnection` only after readiness is verified (§12.5).

### 12.3 `BrowserRuntimeSession` Interface (domain layer — no Playwright import)

```typescript
/**
 * Domain-level interface for an active browser runtime session.
 * Playwright types do not appear in this interface or any type it references.
 * This interface is the only surface BrowserApplicationService uses to interact
 * with the underlying browser process after launch.
 */
export interface BrowserRuntimeSession {
  /** Process ID of the browser process. */
  readonly pid: number;

  /**
   * Configure the browser context with fingerprint headers and init script.
   * Must be called before any user page is created.
   * Throws FINGERPRINT_INJECTION_FAILED on any error.
   */
  applyPrePageConfiguration(
    headers: Record<string, string>,
    initScript: string,
  ): Promise<void>;

  /**
   * Execute the readiness probe on an internal about:blank page.
   * Throws FINGERPRINT_READINESS_FAILED if expected values do not match.
   * The probe page is created and closed internally; never handed to external clients.
   */
  verifyReadiness(expected: FingerprintReadinessExpectation): Promise<void>;

  /**
   * Returns the automation connection endpoint for external clients.
   * MUST NOT be called before verifyReadiness() has completed successfully.
   * Throws if called before readiness is confirmed.
   */
  getAutomationEndpoint(): AutomationConnection;

  /** Graceful stop. Closes context, browser client, and kills server. */
  stop(): Promise<void>;

  /** Register process exit listener. Returns unsubscribe. */
  onExit(listener: (exitCode?: number) => void): () => void;
}

/**
 * Minimum fingerprint property values the probe must confirm.
 * Passed by BrowserApplicationService based on the resolved envelope.
 */
export interface FingerprintReadinessExpectation {
  readonly userAgent: string;
  readonly platform: string;
  readonly language: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly injectedMarker: string;   // e.g., envelope.generatorVersion
}
```

### 12.4 `PlaywrightRuntimeAdapter` (internal implementation)

- Implements `BrowserRuntimeSession`.
- Holds: `BrowserServer` (process), `Browser` (Playwright client connected to wsEndpoint), `BrowserContext`.
- `applyPrePageConfiguration()` calls `browserContext.setExtraHTTPHeaders()` + `browserContext.addInitScript()`.
- `verifyReadiness()` creates an `about:blank` page, evaluates the 6 probe fields, closes the page, then sets an internal `readinessConfirmed = true` flag.
- `getAutomationEndpoint()` throws `FINGERPRINT_READINESS_FAILED` if `readinessConfirmed === false`.
- `stop()` calls `browserContext.close()` → `browser.close()` → `server.close()`.
- **Playwright types (`Browser`, `BrowserContext`, `BrowserServer`) are confined to this class.** Not exported. Not referenced in `BrowserApplicationService` signatures.

### 12.5 `BrowserApplicationService` Orchestration

`BrowserApplicationService` depends on two interfaces only:
- `BrowserProcessLauncher` → returns `BrowserProcessHandle`.
- `BrowserRuntimeSession` → obtained by wrapping `BrowserProcessHandle` in a `PlaywrightRuntimeAdapter`.

The service does not import Playwright types. Test doubles implement `BrowserRuntimeSession` without Playwright.

---

## 13. Injection and Readiness Sequence

### 13.1 Full 20-Step Sequence

```
STEP  1  Load profile metadata
         ProfileRepository.findById(profileId)
         Fail: NOT_FOUND

STEP  2  Validate runtime compatibility
         Architecture: profile.architecture === hostArchitecture
                       else BROWSER_ARCHITECTURE_MISMATCH
         Engine: profile.engine ∈ {chromium, firefox} (phase 1; webkit/custom rejected)
                 else BROWSER_ENGINE_UNAVAILABLE

STEP  3  Resolve FingerprintEnvelope
         3a. Query fingerprint_envelopes_cache (§14)
             If row exists, signature valid, not expired, engine/OS match → use cached signedEnvelopeJson
             (Phase 1: always re-fetch from provider; cache hit used only when Cloud unreachable)
         3b. Call IFingerprintProvider.getVerifiedEnvelope({ targetEngine, targetOs, profileId })
             On failure → FINGERPRINT_SERVICE_UNAVAILABLE / FINGERPRINT_MISSING
         3c. Run full validation pipeline (§11.1 steps 1–7)
             On any failure → session in error state, no lock acquired

STEP  4  Acquire in-process mutex
         ProfileLockManager.acquireInProcessMutex(profileId)

STEP  5  Check for active session
         SessionRepository.getActiveForProfile(profileId)
         If exists → PROFILE_ALREADY_RUNNING, release mutex

STEP  6  Create session record (state: validating)
         Transition: validating → acquiring_lock

STEP  7  Acquire durable lock
         ProfileLockManager.acquireDurableLock(profileId, storageKey, sessionId)
         Transition: acquiring_lock → preparing

STEP  8  Start browser process
         launcher.launch({ descriptor, userDataDir, headless })
         Returns BrowserProcessHandle { pid, wsEndpoint, stop, onExit }
         On failure → LAUNCH_FAILED; release durable lock, release mutex; session → error

STEP  9  Connect internal Playwright adapter
         PlaywrightRuntimeAdapter.connect(handle.wsEndpoint)
         playwright.chromium.connect() or playwright.firefox.connect()
         On failure → LAUNCH_FAILED; kill process; release locks; session → error

STEP 10  Create isolated BrowserContext
         adapter internal: browser.newContext()
         No proxy options in Phase 1 (reserved for RFC-0028)
         No user-accessible pages created yet
         Transition: preparing → starting

STEP 11  Register headers (applyPrePageConfiguration — part 1)
         browserContext.setExtraHTTPHeaders(filteredHeaders)
         filteredHeaders derived from envelope.payload.headers via onlyInjectableHeaders()
         On failure → FINGERPRINT_INJECTION_FAILED; cleanup per §11.3

STEP 12  Register init script (applyPrePageConfiguration — part 2)
         browserContext.addInitScript({ content: injectableScript })
         injectableScript = FingerprintInjector.getInjectableScript(envelope.payload)
         On failure → FINGERPRINT_INJECTION_FAILED; cleanup per §11.3

STEP 13  Execute readiness probe
         Open internal page: context.newPage() → page.goto('about:blank')
         Evaluate 6 fields (see §13.2)
         Close probe page: page.close()
         On mismatch → FINGERPRINT_READINESS_FAILED; cleanup per §11.3

STEP 14  Confirm readiness
         adapter.readinessConfirmed = true
         Automation endpoint now accessible

STEP 15  Publish automation endpoint to session view
         AutomationConnection = adapter.getAutomationEndpoint()
         (CDP endpoint for Chromium; Marionette port for Firefox)

STEP 16  Store envelope in cache
         INSERT OR REPLACE INTO fingerprint_envelopes_cache ...
         Failure here does not abort the session; log error only

STEP 17  Register onExit handler (crash monitoring)
         handle.onExit(exitCode → handleUnexpectedExit(sessionId, exitCode))

STEP 18  Transition: starting → running
         Emit ProfileRuntimeEvent { state: 'running' }
         ← ONLY HERE does the session become externally visible as running

══ Browser session live. First user page created by Selenium/Local API client. ══

STEP 19  On stop() called:
         adapter.stop() → context.close() → browser.close() → server.stop()
         Release durable lock
         Transition: running → stopping → stopped

STEP 20  On unexpected exit (crash):
         adapter.stop() (best-effort close)
         Release durable lock
         Transition: running → crashed
```

### 13.2 Readiness Probe Fields

| Field | Source in envelope | Evaluation |
|-------|-------------------|-----------|
| `navigator.userAgent` | `payload.fingerprint.navigator.userAgent` | Must equal exactly |
| `navigator.platform` | `payload.fingerprint.navigator.platform` | Must equal exactly |
| `navigator.language` | `payload.fingerprint.navigator.language` | Must equal exactly |
| `screen.width` | `payload.fingerprint.screen.width` | Must equal exactly |
| `screen.height` | `payload.fingerprint.screen.height` | Must equal exactly |
| `window.__fingerprintVersion` | `envelope.generatorVersion` | Must equal exactly; injected as a marker by the init script |

**Logging rule:** The adapter logs only `{ field: 'userAgent', result: 'pass' }` or `{ field: 'userAgent', result: 'fail' }` per field. Raw values (the actual UA string, etc.) are **never** logged.

**No external network.** `about:blank` does not trigger any network request. No remote URL is navigated during steps 8–18.

### 13.3 State Ordering Invariants

1. `running` is emitted only at step 18 — never before step 13 (readiness probe) succeeds.
2. `getAutomationEndpoint()` is called only at step 15 — never before step 14.
3. No page is created by external clients before step 18.
4. The probe page (step 13) is created and closed entirely inside the adapter. External clients never receive a reference to it.
5. Raw fingerprint values from the probe are not logged.
6. Steps 19–20 call `adapter.stop()` which closes `BrowserContext` before closing `BrowserServer`.

---

## 14. Cache / Database Design (owner decisions #5)

### 14.1 Decision

**Separate `fingerprint_envelopes_cache` table.** No new fingerprint fields are added to `profiles_cache`.

Existing deprecated columns in `profiles_cache` (`fingerprint_payload`, `fingerprint_schema_version`, `fingerprint_generator_version`) remain nullable and are not written to. They may be dropped in a future cleanup migration.

### 14.2 Table Schema (proposed — pending schema owner review)

```sql
CREATE TABLE fingerprint_envelopes_cache (
  profile_id               TEXT NOT NULL PRIMARY KEY
                             REFERENCES profiles_cache(id) ON DELETE CASCADE,
  fingerprint_id           TEXT NOT NULL,
  schema_version           INTEGER NOT NULL DEFAULT 2,
  generator_version        TEXT NOT NULL,
  dataset_version          TEXT NOT NULL,
  target_engine            TEXT NOT NULL
                             CHECK (target_engine IN ('chromium', 'firefox')),
  target_os                TEXT NOT NULL
                             CHECK (target_os IN ('windows', 'mac', 'linux')),
  compatible_runtime_range TEXT NOT NULL,
  generated_at             TEXT NOT NULL,   -- ISO-8601 UTC
  expires_at               TEXT NOT NULL,   -- ISO-8601 UTC; server-supplied; max 24h
  signature_key_id         TEXT NOT NULL,
  cloud_revision           TEXT,
  signed_envelope_json     TEXT NOT NULL,   -- full FingerprintEnvelope JSON (signed)
  cached_at                TEXT NOT NULL    -- ISO-8601 UTC; time of local cache write
);

CREATE INDEX idx_fec_expires_at
  ON fingerprint_envelopes_cache(expires_at);

CREATE INDEX idx_fec_fingerprint_id
  ON fingerprint_envelopes_cache(fingerprint_id);
```

### 14.3 Column Notes

- `signed_envelope_json`: stores the complete, signed `FingerprintEnvelope` JSON as-is from the provider. Desktop re-verifies the signature when reading from cache (offline use path).
- `expires_at` is indexed for efficient background expiry cleanup.
- `ON DELETE CASCADE`: when a profile row is purged from `profiles_cache`, the fingerprint cache row is automatically deleted.
- The `fingerprint_id` column allows identifying if the same fingerprint has been recycled across profiles (audit use only; not used in business logic).

### 14.4 Cache Policies

| Policy | Rule |
|--------|------|
| Phase 1 strategy | Always fetch from Cloud on launch. Store result. |
| Cache hit (online) | Phase 1: not used. Phase 1b: use if signature valid + not expired + engine/OS match. |
| Cache hit (offline) | Use only if all 7 conditions in §9 are met. |
| Replace | `INSERT OR REPLACE` on successful provider response. |
| Expiry cleanup | Background or launch-time: DELETE WHERE `expires_at < datetime('now', '-1 hour')`. |
| Cascade delete | ON DELETE CASCADE from `profiles_cache`. |

### 14.5 At-Rest Protection (owner decision #10)

**Phase 1 at-rest protection:**
- The SQLite database file is stored in Electron's `userData` directory, protected by OS file permissions (user-private).
- `signed_envelope_json` is **not encrypted** in Phase 1.
- Log redaction (§15.3) ensures fingerprint data does not appear in any log file.
- The RFC does **not** claim Phase 1 cache is encrypted.

**Deferred to a separate security task:** SQLCipher database encryption or column-level AES-GCM. This is not part of RFC-0027.

**Accepted risk for Phase 1:** If the device is compromised and an attacker has filesystem access, `signed_envelope_json` blobs are readable. This risk is documented and accepted by the owner for Phase 1.

### 14.6 Migration Note

The migration adding `fingerprint_envelopes_cache` must be reviewed and approved by the database schema owner before it is committed. RFC-0027 proposes the schema; it does not approve the migration.

---

## 15. Compatibility Matrix (owner decision #6)

| Engine | Distribution | Phase 1 Status | Condition for Supported |
|--------|-------------|----------------|-------------------------|
| Chromium | `chromium` (bundled Playwright) | ✅ **Supported** | Playwright bundled Chromium; integration test must exist and pass in CI |
| Chromium | `chrome` (system install) | ✅ **Supported** | Executable resolver must pass AND integration test must pass in CI |
| Chromium | `edge` (system install) | ⚠️ **Conditional** | Executable resolver must pass AND integration test must pass in CI; if CI test infeasible, must be moved to DEFERRED before Phase 1 release |
| Chromium | `brave` | ❌ **DEFERRED** | No executable resolver; no integration test |
| Firefox | `firefox` | ❌ **DEFERRED** | `launchServer`+`connect` path unverified in Electron; injection not CI-proven; no Phase 1 integration test |
| WebKit | `webkit` | ❌ **DEFERRED** | Blocked by launcher |
| — | `custom` | ❌ **DEFERRED** | No launcher path |

**Rule (owner decision #1 — FINALIZE):** A runtime may appear as Supported only if its executable resolver works AND a CI integration test exists and passes for it. A "Supported" label without a passing CI test is not permitted.

**Edge acceptance criterion:** The implementation agent must confirm whether a CI-runnable `edge` integration test is feasible (requires Microsoft Edge installed in the build environment). If it is not feasible, `edge` must be reclassified as `DEFERRED` before the Phase 1 milestone is closed. This is not a blocking dependency on Phase 1 for `chromium` and `chrome`.

---

## 16. ASAR Packaging (owner decision #9)

`FingerprintInjector._loadUtils()` reads `utils.js` via `readFileSync(__dirname/../utils.js)`. In an ASAR-packaged Electron build:

**Required handling (owner decision #7 — FINALIZE):**
- No unsafe runtime path assumptions. The packaging configuration must explicitly handle `fingerprint-injector` assets.
- **Phase 1 decision (owner): Use explicit `asarUnpack`** for the injector runtime asset `utils.js`.
  - Add `packages/fingerprint-injector` (or specifically `utils.js`) to `asarUnpack` in the electron-builder configuration.
  - The file is extracted alongside the ASAR archive; `__dirname` resolves correctly at runtime.
- **Option B** (build-time string embed): Remains architecturally sound as a future alternative. If a subsequent audit provides evidence that the bundler already safely embeds the asset, the `asarUnpack` entry may be removed — but only with documented evidence attached to the implementation ticket.

**Mandatory verification:** A packaged-app smoke test must verify that `FingerprintInjector` instantiation does not throw when the app is run from a packaged ASAR. This test is **required** before the Phase 1 release is marked complete.

**The implementation RFC-0027B must not be marked complete until the packaged-app smoke test passes.**

---

## 17. Security Analysis

### 17.1 Trust Boundary

```
Renderer (untrusted) ──IPC──▶ Preload ──IPC──▶ Main Process (trusted)
                                                       │
                                           IFingerprintProvider
                                           FingerprintInjector (via adapter)
                                           BrowserApplicationService
```

**Renderer receives:** `ProfileRuntimeEvent` (state only), `BrowserSession` (sessionId, profileId, state, automation connection for display, startedAt). **Never** fingerprint data.

**Preload bridge must not expose:** Any method that returns fingerprint data or triggers fingerprint generation. This is an enforceable contract — no such IPC channel exists in the current preload.

### 17.2 Log Redaction

| Category | Redaction Rule |
|----------|---------------|
| `payload.fingerprint.*` | Never logged |
| `payload.headers.*` | Never logged |
| `signature.value` | Never logged |
| Probe field values (UA string, platform, etc.) | Never logged (log only `{field, result: pass/fail}`) |
| Safe to log | `fingerprintId`, `schemaVersion`, `generatorVersion`, `datasetVersion`, `targetEngine`, `targetOs`, `expiresAt`, `signature.keyId`, error codes |

### 17.3 Asymmetric Signature Rationale

Ed25519 chosen over HMAC-SHA256 because:
- Desktop holds only the 32-byte public key — cannot forge envelopes.
- Private key cannot be extracted from the binary.
- No shared-secret extraction attack.
- Fast verification (~50µs); no parameter confusion vulnerabilities.
- Pinned key bundle avoids DNS/CA trust at verification time.

### 17.4 At-Rest Risk Acknowledgement

Phase 1 cache is not encrypted. Risk accepted: an attacker with filesystem access can read `signed_envelope_json`. Mitigated by: OS file permissions, log redaction, and the fact that a fingerprint envelope is not a secret credential (it does not contain auth tokens or proxy passwords).

---

## 18. Rollback Policy

### 18.1 Valid Rollback Actions

| Scenario | Valid Action |
|----------|-------------|
| Injection pipeline bug | Roll back entire desktop client release |
| Cloud fingerprint service outage | `FINGERPRINT_SERVICE_UNAVAILABLE`; UI surfaces error; user waits for service recovery |
| Runtime incompatibility | `FINGERPRINT_RUNTIME_INCOMPATIBLE`; profile remains in `error` state until resolved |
| Controlled rollout via feature flag | Flag disabled → launch returns `FINGERPRINT_SERVICE_UNAVAILABLE`; profile in error state |

### 18.2 Prohibited Rollback Actions (owner decision #3)

- ❌ Opening a plain browser with no fingerprint injection as a "degraded mode".
- ❌ Falling back to a local generator in production.
- ❌ Falling back to a static User-Agent in production.
- ❌ Silently continuing without injection when injection fails.
- ❌ Re-enabling the pre-RFC-0027 code path where `running` is emitted without injection.

---

## 19. Testing Strategy

### 19.1 Unit Tests (no browser, no network required)

| Test | Assertion |
|------|-----------|
| `validateSchemaVersion` — v1 | Rejects with `FINGERPRINT_SCHEMA_UNSUPPORTED` |
| `validateSchemaVersion` — v2 | Passes |
| `validateSignature` — valid test keypair | Passes |
| `validateSignature` — tampered payload byte | Fails with `FINGERPRINT_INTEGRITY_INVALID` |
| `validateSignature` — unknown keyId | Fails with `FINGERPRINT_INTEGRITY_INVALID` |
| `validateSignature` — test keyId in production mode | Fails with `FINGERPRINT_INTEGRITY_INVALID` |
| `validateSignature` — missing signature field | Fails with `FINGERPRINT_INTEGRITY_INVALID` |
| Key rotation — old keyId still in bundle | Passes (old envelopes still valid while key in bundle) |
| Key rotation — removed keyId | Fails |
| Canonical serialization — extra whitespace | Fails (different bytes → different signature) |
| Canonical serialization — field order change | Fails |
| `validateExpiry` — past `expiresAt` | `FINGERPRINT_EXPIRED` |
| `validateExpiry` — within 5min skew | Passes |
| `validateExpiry` — beyond 5min skew | `FINGERPRINT_EXPIRED` |
| `validateExpiry` — missing field | `FINGERPRINT_EXPIRED` |
| `validateEngineMatch` — webkit | `FINGERPRINT_ENGINE_MISMATCH` |
| `validateOsMatch` — unknown value | `FINGERPRINT_OS_MISMATCH` |
| `DevelopmentFingerprintProvider` — production mode | Throws `LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION` |
| `DevelopmentFingerprintProvider` — dev mode | Returns valid signed v2 envelope |
| `createFingerprintProvider` — production + no URL | Factory throws at startup |
| Log redaction — payload fields | Absent from logger output |
| Log redaction — probe values | Absent; only `{field, result}` present |
| `getAutomationEndpoint()` before readiness | Throws |
| Injection sequence ordering | `running` event emitted after mock `verifyReadiness()` resolves |
| Cleanup — pre-start signature failure | No process started; no lock acquired; session → error |
| Cleanup — post-start injection failure | `adapter.stop()` called; durable lock released; session → error |

### 19.2 Integration Tests (Playwright headless, no external URLs)

| Test | Gated by | Acceptance |
|------|----------|-----------|
| Chromium: `navigator.userAgent` matches envelope | Always | ✅ Phase 1 |
| Chromium: `window.__fingerprintVersion` matches | Always | ✅ Phase 1 |
| Chromium: `running` only after readiness probe | Always | ✅ Phase 1 |
| Chromium: `getAutomationEndpoint()` after `running` | Always | ✅ Phase 1 |
| Expired envelope → `FINGERPRINT_EXPIRED`; session `error` | Always | ✅ Phase 1 |
| Invalid signature → `FINGERPRINT_INTEGRITY_INVALID`; no process started | Always | ✅ Phase 1 |
| Injection failure → cleanup (adapter.stop + lock released) | Always | ✅ Phase 1 |
| No external network during steps 8–18 | Always | ✅ Phase 1 |
| No raw payload values in log output | Always | ✅ Phase 1 |
| Expired cache → provider called | Always | ✅ Phase 1 |
| Packaged-app smoke: `FingerprintInjector` instantiation from ASAR | Release checklist | ✅ Phase 1 |
| Firefox: `navigator.userAgent` matches | `FIREFOX_INTEGRATION=1` | ❌ Not Phase 1 acceptance |

**CI constraints:** No `httpbin.org`, `browserscan.net`, or any public IP. No real proxy credentials. Test keypair (`test:dev-2026`) private key committed as test fixture.

---

## 20. Open Questions — All Resolved

All open questions have been resolved by owner decision as part of the Design Review (2026-07-18). No unresolved questions remain.

### Resolved by owner decisions (Revision 002)

| # | Question | Resolution |
|---|----------|-----------|
| OQ-1 | Key distribution and rotation | Pinned public key bundle shipped at build time; `keyId` rotation by adding entries; old entries kept until envelopes expire. |
| OQ-2 | Envelope lifetime | `expiresAt` server-supplied; maximum 24 hours; 5-minute clock skew tolerance. |
| OQ-3 | Cache table design | `fingerprint_envelopes_cache` separate table confirmed. No new columns in `profiles_cache`. |
| OQ-4 | Phase 1 distributions | `chromium` + `chrome` confirmed; `edge` conditional on resolver + integration test. Brave/Firefox/WebKit deferred. |
| OQ-5 | Firefox status | Deferred. Not in Phase 1 acceptance criteria. |
| OQ-6 | Offline launch | Permitted only with valid cached envelope meeting all 7 conditions (§9). Otherwise fail closed. |
| OQ-8 | ASAR packaging | Explicit `asarUnpack` for Phase 1; packaged-app smoke test required before Phase 1 complete. |
| OQ-9 | Encryption at rest | Phase 1: OS file permissions + log redaction. SQLite not encrypted. SQLCipher deferred. |
| OQ-10 | `compatibleRuntimeRange` enforcement | Validation runs if browser version is known at launch time. If version unknown, step 6 is skipped (logged as warning). |

### Resolved by owner decisions (Revision 003 — FINALIZE)

| # | Question | Resolution |
|---|----------|-----------|
| OQ-7 | RFC-0027A ownership and delivery timeline | Production enablement is blocked until RFC-0027A is deployed and integrated. Desktop development and integration tests use Ed25519-signed deterministic test fixtures with `test:` keypair. No owner timeline decision required for Desktop implementation to proceed — implementation may begin using test fixtures. RFC-0027A remains a separate backend deliverable. |
| OQ-ASAR-CHOICE | ASAR handling: Option A vs. Option B | **Resolved by owner**: Phase 1 uses explicit `asarUnpack` for `utils.js` (Option A). Option B may replace it only if a subsequent audit provides evidence the bundler already embeds the asset safely. |
| OQ-EDGE-TEST | `edge` integration test feasibility | The implementation agent must confirm CI feasibility at the implementation milestone. If Microsoft Edge is not available in CI, `edge` is reclassified as `DEFERRED` — this does not block Phase 1 for `chromium` and `chrome`. Owner decision: `edge` appears in the matrix as Conditional, not Supported, until the test passes. |
| OQ-CANONICAL | Canonical serialization approach | **Resolved by owner (decision #6)**: Use deterministic JCS per RFC 8785. Do not rely on field declaration order or insertion order. See §7.2. |

---

## 21. Approval Record

| Field | Value |
|-------|-------|
| **RFC Status** | **Approved** |
| **Approved by** | Project Owner |
| **Date** | 2026-07-18 |
| **Revision approved** | 003 |
| **Production enablement** | **Blocked** pending RFC-0027A (Cloud Fingerprint Issuance API). Approval of this RFC authorizes implementation (DESKTOP-CORE-006) to begin. It does not constitute production-readiness. |
| **Next task** | `DESKTOP-CORE-006 — Implement Browser Fingerprint Injection Adapter` |

> [!IMPORTANT]
> Production launch with real fingerprint injection requires RFC-0027A (Cloud Fingerprint Issuance API) to be deployed, integrated, and verified. Desktop implementation may proceed using signed test fixtures.

---

*This RFC is **Approved** — Revision 003 — 2026-07-18.*  
*Implementation may begin. Production enablement depends on RFC-0027A.*
