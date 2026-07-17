# Contributor: Git Workflow & Commit Rules

This guide specifies git branch formats, conventional commits structures, and PR reviews guidelines.

---

## 1. Branch Naming Strategy

We follow a structured branch naming convention to clarify team domains:

```text
feature/[team-scope]/[ticket-number]-[description]
bugfix/[team-scope]/[ticket-number]-[description]
```

*   **Scopes**:
    *   `stealth`: Browser fingerprint evasion patches.
    *   `desktop`: Electron/React client modules.
    *   `cloud`: NestJS cloud services APIs.
*   *Example*: `feature/stealth/webrtc-candidate-fuzzing`

---

## 2. Conventional Commits Standard

Commits must follow structured messages formats:

```text
<type>(<scope>): <subject>
```

*   **Types**:
    *   `feat`: A new feature implementation.
    *   `fix`: A bug fix.
    *   `docs`: Documentation changes.
    *   `test`: Adding or updating tests.
*   *Example*: `feat(stealth): inject canvas fuzzer on getBoundingClientRect`

---

## 3. Pull Request Checklists

Before opening a PR to merge into `develop`:
1.  Verify linting passes: `pnpm lint`.
2.  Verify test execution succeeds: `pnpm test`.
3.  Ensure coverage on new methods is **> 85%**.
4.  Attach corresponding issue numbers (e.g. `Resolves #142`).
