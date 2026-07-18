# Design Report — RFC-0027-FINALIZE (Revision 003)

**Task**: RFC-0027-FINALIZE — Apply Owner Decisions  
**Date**: 2026-07-18  
**Branch**: `docs/rfc-0027-approved`

---

## 1. Status

**COMPLETE — RFC-0027 Revision 003 produced. RFC is Approved.**

RFC status: **Approved**  
Approved by: **Project Owner — 2026-07-18**  
Production enablement: **Blocked** pending RFC-0027A (Cloud Fingerprint Issuance API).

> This approval authorizes implementation of DESKTOP-CORE-006 to begin using Ed25519-signed test fixtures.  
> It does **not** constitute production-readiness. Production launch requires RFC-0027A.

No production source code modified.

---

## 2. Owner Decisions Applied

All 11 owner decisions from the Design Review (2026-07-18) have been applied to RFC-0027 Revision 003. All open questions are resolved.

| Owner Decision | RFC Section | Resolution Applied |
|----------------|-------------|-------------------|
| #1 — Phase 1 acceptance: Playwright bundled Chromium; Chrome/Edge only if resolver + CI test pass; Brave/Firefox/WebKit/custom deferred | §15 | Compatibility matrix updated. `chromium` = Supported. `chrome` = Supported (resolver required). `edge` = Conditional. Others = Deferred. |
| #2 — Ed25519; Cloud holds private key; Desktop pins public key bundle; no bypass | §7.3, §7.4, §11.1 | Confirmed. `test:` keyId rejected in production. Missing/invalid signature → `FINGERPRINT_INTEGRITY_INVALID`. |
| #3 — Envelope lifetime: max 24h; clock skew 5min; expired → fail closed | §8 | `expiresAt + 5min ≤ now()` → rejected. Missing field → rejected. |
| #4 — Offline: valid signature + unexpired + runtime compatible + local license; else fail closed | §9 | 7-condition offline launch rule. All must pass or launch fails closed. |
| #5 — Cache: separate `fingerprint_envelopes_cache` table; GPT/Core = schema owner; Cloud PostgreSQL = source of truth; SQLite = operational cache only | §14 | Table schema confirmed. `signed_envelope_json` column. `ON DELETE CASCADE`. No new columns in `profiles_cache`. |
| #6 — Canonical serialization: deterministic JCS (RFC 8785); not declaration order / insertion order; signature covers full unsigned envelope | §7.2 | **Old field-order approach removed.** JCS (RFC 8785) specified. RFC 8785-compliant library required. Pseudocode added. |
| #7 — ASAR: Phase 1 uses explicit `asarUnpack` for `utils.js`; packaged-app smoke test required; Option B only with audit evidence | §16 | Phase 1 = `asarUnpack`. Smoke test mandatory before Phase 1 complete. |
| #8 — Runtime compatibility: resolver provides version before launch; if post-connect, validate before user page; mismatch → stop + release lock + emit error | §13 | 20-step sequence formalizes this. Steps 2, 6, 9 cover version check. |
| #9 — At-rest: Phase 1 no SQLCipher; OS permissions + redaction; residual risk documented; no encrypted-storage claim | §14.5, §17.4 | Phase 1 at-rest protection documented as non-encrypted. Risk explicitly accepted. |
| #10 — Cloud: Desktop uses Ed25519-signed test fixtures; production blocked on Cloud issuance API; no mock/fallback in CloudFingerprintProvider | §6, §10.3 | `CloudFingerprintProvider` has zero mock paths. `DevelopmentFingerprintProvider` uses test keypair. Production enablement blocked on RFC-0027A. |
| #11 — Reuse: no duplicate/move of fingerprint-generator, header-generator, fingerprint-injector; Desktop adds adapter/orchestration only | §5, §10 | RFC explicitly states packages are reused in place. Desktop adds wiring layer only. |

---

## 3. Open Questions — All Resolved

All open questions have been resolved by owner decision.

| ID | Question | Resolution |
|----|----------|-----------|
| OQ-1 | Key distribution and rotation | Pinned public key bundle at build time; rotation via `keyId` addition. |
| OQ-2 | Envelope lifetime | `expiresAt` server-supplied; max 24h; 5-min clock skew. |
| OQ-3 | Cache table design | `fingerprint_envelopes_cache` confirmed; no new columns in `profiles_cache`. |
| OQ-4 | Phase 1 distributions | `chromium` + `chrome` confirmed; `edge` conditional; Brave/Firefox/WebKit deferred. |
| OQ-5 | Firefox status | Deferred. Not Phase 1 acceptance. |
| OQ-6 | Offline launch | 7-condition rule; all must pass or fail closed. |
| OQ-7 | RFC-0027A ownership | Production enablement blocked until RFC-0027A deployed. Desktop uses test fixtures. No owner timeline required for implementation to start. |
| OQ-8 | ASAR packaging | Phase 1: `asarUnpack` (Option A). Packaged-app smoke test required. |
| OQ-9 | At-rest encryption | Phase 1: OS permissions + log redaction. SQLite not encrypted. SQLCipher deferred. |
| OQ-10 | `compatibleRuntimeRange` enforcement | Validates if version known. Skips with warning if unknown. |
| OQ-ASAR-CHOICE | ASAR Option A vs B | Resolved by owner: Phase 1 = `asarUnpack`. Option B only with audit evidence. |
| OQ-EDGE-TEST | `edge` integration test | Implementation agent confirms CI feasibility at milestone. If Edge unavailable in CI → reclassify as Deferred. Does not block `chromium`/`chrome`. |
| OQ-CANONICAL | Canonical serialization | Resolved by owner decision #6: JCS per RFC 8785. No field-order dependency. |

---

## 4. Key Architecture Changes (Revision 003 vs 002)

### 4.1 Canonical Serialization — Breaking Change from Prior Draft

**Revision 002** specified `JSON.stringify()` in interface declaration order — this was incorrect and has been removed.

**Revision 003** mandates **JCS (RFC 8785)**:
- Object keys sorted lexicographically by Unicode code point.
- No whitespace.
- `signature` field excluded before canonicalization.
- Optional fields (`coherence`, `cloudRevision`) omitted (not `null`) when absent.
- Both Cloud (signer) and Desktop (verifier) must use the same RFC 8785-compliant library.

This is an interoperability-critical change. Any implementation already using field-order serialization must be updated.

### 4.2 ASAR Decision — Phase 1 Explicit

Owner has selected **Option A (`asarUnpack`)** for Phase 1. The implementation RFC-0027B is no longer "choose Option A or B" — it must implement `asarUnpack`. Option B requires subsequent audit evidence.

### 4.3 Edge Status — Conditional, Not Supported

`edge` is now marked **Conditional** (⚠️) in the compatibility matrix, not Supported (✅). The implementation agent must confirm CI feasibility before closing Phase 1. This aligns with the owner decision that "Supported" requires a passing CI integration test.

---

## 5. Integrity Design (confirmed — no changes from Rev 002)

**Algorithm**: Ed25519 (RFC 8032)

**Canonical sign_input**: JCS (RFC 8785) applied to envelope minus `signature` field. Optional absent fields omitted entirely.

**Key bundle**: `Record<keyId, base64url-public-key>`. Bundled at build time. Rotation by adding entries.

**Test keypairs**: `test:` prefix. Test private key committed as test fixture. Production mode rejects `test:` keyId.

**Fail-closed invariants** (no exceptions):
- Unknown keyId → `FINGERPRINT_INTEGRITY_INVALID`
- `test:` keyId in production → `FINGERPRINT_INTEGRITY_INVALID`
- Verification failure → `FINGERPRINT_INTEGRITY_INVALID`
- Missing `signature` field → `FINGERPRINT_INTEGRITY_INVALID`

---

## 6. Compatibility Matrix (final — Phase 1)

| Engine | Distribution | Phase 1 Status | Condition |
|--------|-------------|----------------|-----------|
| Chromium | `chromium` | ✅ Supported | Playwright bundled; CI integration test required |
| Chromium | `chrome` | ✅ Supported | Resolver must pass; CI integration test required |
| Chromium | `edge` | ⚠️ Conditional | Resolver + CI test; reclassified Deferred if CI infeasible |
| Chromium | `brave` | ❌ Deferred | No resolver; no integration test |
| Firefox | `firefox` | ❌ Deferred | Unverified in Electron; no CI test |
| WebKit | `webkit` | ❌ Deferred | Blocked by launcher |
| — | `custom` | ❌ Deferred | No launcher path |

---

## 7. Provider and Environment Policy (confirmed)

| Mode | Provider | On Failure |
|------|----------|-----------| 
| `production` (`app.isPackaged` = true) | `CloudFingerprintProvider` | `FINGERPRINT_SERVICE_UNAVAILABLE`; no fallback |
| `development` / `test` / `integration_test` | `DevelopmentFingerprintProvider` | Dev-only; logs `[DEV ONLY]` |

`CloudFingerprintProvider`: zero mock paths. Not configured → startup exception.  
`DevelopmentFingerprintProvider`: secondary guard throws `LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION`.

---

## 8. Cache / Database (confirmed)

- Table: `fingerprint_envelopes_cache` (separate from `profiles_cache`)
- Schema owner: GPT/Core
- Source of truth: Cloud PostgreSQL
- SQLite role: operational cache only
- Key column: `signed_envelope_json` — full signed envelope JSON
- `expires_at` indexed for background cleanup
- `ON DELETE CASCADE` from `profiles_cache`
- Phase 1: always re-fetch on launch; cache used only offline
- Phase 1: SQLite not encrypted; OS file permissions + log redaction
- Migration requires schema-owner approval before commit

---

## 9. Cloud Dependency

```
RFC-0027A  Cloud Fingerprint Issuance API   ← separate backend RFC, separate owner
  └── Must be deployed before production enablement of RFC-0027B
RFC-0027B  Desktop Injection Pipeline       (this RFC — Approved)
  └── Implementation proceeds using Ed25519-signed deterministic test fixtures
  └── Production launch blocked until RFC-0027A deployed and integrated
```

Desktop may begin implementation (DESKTOP-CORE-006) immediately using the `test:dev-2026` keypair.

---

## 10. Security Properties

| Property | Status |
|----------|--------|
| Ed25519 asymmetric signature | Specified; canonical JCS (RFC 8785); no bypass |
| Renderer never receives fingerprint data | Enforced by IPC contract |
| Probe values not logged | Adapter logs only pass/fail per field |
| `signed_envelope_json` and `signature.value` not logged | Redaction rules stated |
| Production envelopes require valid signature | Fail-closed; no stub; no warning-and-proceed |
| SQLite not encrypted in Phase 1 | Documented risk; accepted by owner |
| `CloudFingerprintProvider` has no mock paths | Confirmed |
| No duplicate/move of generator/injector packages | Desktop adds adapter layer only |

---

## 11. Verification Strategy (unchanged)

**Unit tests**: 25 tests — signature (JCS byte-exact), expiry, provider mode guards, sequence ordering, redaction, capability discrimination.

**Integration tests**: 12 tests — 11 mandatory (Chromium headless + packaged smoke), 1 optional (Firefox).  
No external URLs. No proxy credentials. Payload-absence-in-logs is a test assertion.

**Packaged-app smoke test**: mandatory before Phase 1 release. Verifies `FingerprintInjector` instantiation from ASAR using `asarUnpack`.

---

## 12. Files Changed

| File | Action |
|------|--------|
| [`RFC-0027-Browser-Fingerprint-Injection.md`](file:///C:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0027-Browser-Fingerprint-Injection.md) | Overwritten — Revision 003 (Approved) |
| [`RFC-0027-DESIGN-REPORT.md`](file:///C:/Users/Phucx/Desktop/fingerprint-suite/docs/reports/RFC-0027-DESIGN-REPORT.md) | Overwritten — this report |

No source code modified. No migrations changed. No `apps/**` or `packages/**` files touched.

---

## 13. RFC Status

**Approved**  
**Approved by Project Owner — 2026-07-18**

Production enablement: **Blocked** pending RFC-0027A (Cloud Fingerprint Issuance API).  
Implementation: **Authorized to begin** — DESKTOP-CORE-006.

---

## 14. Suggested Next Task

**`DESKTOP-CORE-006 — Implement Browser Fingerprint Injection Adapter`**

Implementation may now begin. The implementation agent should:
1. Implement `BrowserRuntimeSession` interface and `PlaywrightRuntimeAdapter`.
2. Wire `FingerprintInjector` (from `packages/fingerprint-injector`) as adapter in `BrowserApplicationService`.
3. Implement `DevelopmentFingerprintProvider` with `test:dev-2026` keypair.
4. Implement `fingerprint_envelopes_cache` table migration (pending schema-owner approval).
5. Implement JCS (RFC 8785) canonical serialization for signature verification.
6. Configure `asarUnpack` for `utils.js` in electron-builder.
7. Run packaged-app smoke test before marking Phase 1 complete.
8. Confirm `edge` CI feasibility; reclassify to Deferred if infeasible.
