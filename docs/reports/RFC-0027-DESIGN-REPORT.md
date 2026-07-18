# Design Report — RFC-0027-FINAL-ERRATA

**Task**: RFC-0027-FINAL-ERRATA — Apply Owner Errata to Approved RFC  
**Date**: 2026-07-18  
**Branch**: `docs/rfc-0027-approved`  
**Base**: RFC-0027 Revision 003 (Approved)

---

## 1. Status

**COMPLETE — Three errata applied. RFC-0027 remains Approved.**

RFC status: **Approved**  
Approved by: **Project Owner — 2026-07-18**  
Revision: **003-E** (RFC-0027-FINAL-ERRATA applied to Rev 003)  
Implementation status: **Approved for DESKTOP-CORE-006 development**  
Production enablement: **Blocked** pending RFC-0027A (Cloud Fingerprint Issuance API).

> This approval authorizes DESKTOP-CORE-006 to begin immediately using Ed25519-signed test fixtures.  
> Production launch requires RFC-0027A to be deployed, integrated, and verified.  
> Approval ≠ production-ready.

No production source code modified.

---

## 2. Errata Applied

### Errata 1 — Canonical JSON (§7.2)

**What was wrong:** The previous text noted that Cloud and Desktop must use "the same RFC 8785 algorithm" but did not require canonicalization test vectors to be cross-validated, and did not explicitly reject non-representable data.

**What was changed:**

- Added requirement: Before shipping, Cloud signer and Desktop verifier must independently canonicalize an agreed set of test envelopes and confirm **byte-identical output**. Both sides must share and validate the same canonicalization test vectors.
- Added rejection rule: Data that cannot be faithfully represented under RFC 8785 (e.g., non-finite floats, duplicate object keys) must be rejected as `FINGERPRINT_SCHEMA_UNSUPPORTED`.
- Confirmed: No `JSON.stringify` field-order language remains in the document.
- Confirmed: Canonical serialization does not depend on TypeScript interface order or JavaScript object insertion order.

**RFC 8785 canonical algorithm summary (as specified in §7.2):**
- Delete `signature` field before canonicalization.
- Omit absent optional fields entirely (not `null`).
- Apply JCS (RFC 8785): lexicographic key sort by Unicode code point, compact, recursive.
- Sign/verify the UTF-8 bytes of the canonical output.
- Use an audited RFC 8785-compliant library on both sides.

---

### Errata 2 — Shared Contract Dependency (§7.1, §7.1a)

**What was wrong:** The text stated: _"Fingerprint type is imported from packages/fingerprint-generator. This is the correct dependency direction."_ This is incorrect. The shared contract must be an independent transport/domain DTO boundary. Importing implementation types from `packages/fingerprint-generator` into `packages/shared` creates an unacceptable coupling that violates the package architecture.

**What was changed:**

- **Removed** the claim that `Fingerprint` from `fingerprint-generator` is imported in the shared contract.
- **Removed** the claim that this is "the correct dependency direction."
- **Added §7.1a** defining `FingerprintPayloadDto` as a data-only structural DTO in `packages/shared`:
  ```typescript
  export interface FingerprintPayloadDto {
    readonly fingerprint: Record<string, unknown>; // opaque; validated at adapter layer
    readonly headers: Record<string, string>;
  }
  ```
- **Updated** `FingerprintEnvelope.payload` to reference `FingerprintPayloadDto` instead of the inline generator type.
- **Established dependency boundary rules:**
  - `packages/shared` does not import from `fingerprint-generator`, `fingerprint-injector`, or Playwright.
  - The Electron Main process adapter performs the mapping: `FingerprintPayloadDto` → `BrowserFingerprintWithHeaders` (injector-compatible type). This mapping fails closed.
  - Adapter may import implementation packages; shared contracts may not.
  - No duplicate of generator algorithm. No copy/move of package code.

---

### Errata 3 — Timestamp Validation (§8.2, §11.1, §11.2)

**What was wrong:** The expiry section only validated `expiresAt` against the current time. It did not reject envelopes with future `generatedAt`, non-positive lifetime (`expiresAt ≤ generatedAt`), or lifetime exceeding the 24-hour policy maximum. It also stated that a `generatedAt` in the future was "suspicious but not independently rejected."

**What was changed:**

- **Added §8.2 — Timestamp Validation Rules** with four new rejection conditions:

  | Condition | Error |
  |-----------|-------|
  | `generatedAt > now + 5 minutes` | `FINGERPRINT_TIMESTAMP_INVALID` |
  | `expiresAt ≤ generatedAt` | `FINGERPRINT_TIMESTAMP_INVALID` |
  | `expiresAt − generatedAt > 24 hours` | `FINGERPRINT_TIMESTAMP_INVALID` |
  | Either field missing or unparseable | `FINGERPRINT_TIMESTAMP_INVALID` |

- **Added step 3** to the validation pipeline (§11.1): `validateTimestamps()` runs after signature verification and before expiry check.
- **Added error code** `FINGERPRINT_TIMESTAMP_INVALID` to §11.2 error codes table.
- **Removed** the incorrect statement that `generatedAt` in the future is "suspicious but not independently rejected."
- **Clarified** that 5-minute clock skew tolerance applies to both the expiry check (§8.1) and the `generatedAt` future check (§8.2).
- All invalid timestamp conditions fail closed — no warning-and-proceed path.

---

## 3. Files Changed

| File | Action |
|------|--------|
| [`RFC-0027-Browser-Fingerprint-Injection.md`](file:///C:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0027-Browser-Fingerprint-Injection.md) | Errata 1, 2, 3 applied — Revision 003-E |
| [`RFC-0027-DESIGN-REPORT.md`](file:///C:/Users/Phucx/Desktop/fingerprint-suite/docs/reports/RFC-0027-DESIGN-REPORT.md) | Updated — this report |

No source code modified. No `apps/**` or `packages/**` files touched.

---

## 4. Scope Audit

- `apps/**` changes: **0**
- `packages/**` changes: **0**
- `.agents/**` changes: **0**
- `note.md` changes: **0**
- Untracked files introduced: **0**
- Files committed: **2** (docs only)

---

## 5. Validation Pipeline (post-errata, final)

```
1. validateSchemaVersion(envelope)           → FINGERPRINT_SCHEMA_UNSUPPORTED
2. validateSignature(envelope, keyBundle)    → FINGERPRINT_INTEGRITY_INVALID
3. validateTimestamps(envelope, now)         → FINGERPRINT_TIMESTAMP_INVALID   ← NEW (Errata 3)
4. validateExpiry(envelope, now)             → FINGERPRINT_EXPIRED
5. validateEngineMatch(envelope, profile)    → FINGERPRINT_ENGINE_MISMATCH
6. validateOsMatch(envelope, profile)        → FINGERPRINT_OS_MISMATCH
7. validateRuntimeRange(envelope, version)   → FINGERPRINT_RUNTIME_INCOMPATIBLE
8. validatePayloadShape(envelope.payload)    → FINGERPRINT_SCHEMA_UNSUPPORTED
```

---

## 6. Dependency Architecture (post-errata)

```
packages/shared
  └── FingerprintEnvelope (uses FingerprintPayloadDto)
  └── FingerprintPayloadDto (data-only DTO, no implementation imports)
  
apps/desktop-client (Main process adapter)
  └── imports packages/shared (FingerprintPayloadDto)
  └── imports packages/fingerprint-generator (BrowserFingerprintWithHeaders)
  └── imports packages/fingerprint-injector (FingerprintInjector)
  └── maps: FingerprintPayloadDto → BrowserFingerprintWithHeaders (fail-closed)
```

No reverse dependency. No duplicate code. No copy/move of packages.

---

## 7. RFC Status (Final)

| Field | Value |
|-------|-------|
| **RFC Status** | **Approved** |
| **Approved by** | Project Owner — 2026-07-18 |
| **Revision** | 003-E (RFC-0027-FINAL-ERRATA) |
| **Implementation Status** | Approved for DESKTOP-CORE-006 development |
| **Production Enablement** | Blocked pending RFC-0027A |

---

## 8. Suggested Next Task

**`DESKTOP-CORE-006 — Implement Browser Fingerprint Injection Adapter`**

Implementation may begin immediately. Key implementation notes from errata:

1. **JCS (RFC 8785)**: Use `canonicalize` npm package or equivalent. Cross-validate with Cloud team using shared test vectors before shipping.
2. **`FingerprintPayloadDto`**: Implement in `packages/shared`. Do not import generator types there.
3. **Adapter mapping**: Implement in Main process only. Map `FingerprintPayloadDto` → `BrowserFingerprintWithHeaders` with fail-closed structural validation.
4. **Timestamp validation**: Implement `validateTimestamps()` with all four conditions from §8.2.
