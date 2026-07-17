# Security Specification: Compliance & Integrity

Supply chain security, automated dependency analysis, and release integrity checking.

---

## 1. Supply Chain Protection (Lockfiles)

*   **Lockfile Verification**: `pnpm-lock.yaml` is treated as a security artifact. PR reviews verify new dependency additions.
*   **Vulnerability Scans**: Nightly runs audit vulnerabilities:
    ```bash
    pnpm audit --audit-level=high
    ```
*   **Renovate Bot**: Automatically opens PRs for minor/patch dependency updates to keep libraries patched.

---

## 2. EV Code Signing Integration

To satisfy operating system security checks:

*   **Windows Release Signing**: App executables must be signed with an Extended Validation (EV) certificate. Built via GitHub Actions runner using hardware-security modules:
    ```bash
    signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a MidnightBrowser.exe
    ```
*   **macOS Notarization**: Binaries must be submitted to Apple's notarization service to prevent security gatekeeper warnings.

---

## 3. Custom Runtime Signature Verification

On browser profile launch, the launcher validates custom Chromium builds:
1.  Calculates the **SHA-256** checksum of the browser binary.
2.  Compares it against the signed hashes file downloaded from the secure CDN.
3.  Aborts launch if the binary signature does not match expected values.
