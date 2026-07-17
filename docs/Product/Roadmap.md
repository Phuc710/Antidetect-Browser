# Product Roadmap

This document outlines the development milestones and release goals for the Browser Product.

---

## 1. Roadmap Overview & Milestones

The product timeline is divided into 4 key phases targeting high reliability and evasion stealth:

```text
Milestone 1 (Engine Core)    ➔    Milestone 2 (Stealth Launch)    ➔    Milestone 3 (Sync & UI)    ➔    Milestone 4 (Enterprise)
       [Completed]                       [In Progress]                      [Q3 2026]                     [Q4 2026]
```

---

## 2. Milestone Breakdown

### Milestone 1: Engine Core & Evasions [Completed]
*   **Deliverables**:
    *   Trained Bayesian Network models containing headers and device fingerprints.
    *   `FingerprintGenerator` API wrapping Bayesian node logic.
    *   `FingerprintInjector` API supporting basic overrides (`navigator`, WebGL, codecs, audio).

### Milestone 2: Stealth Launcher Integration [In Progress]
*   **Deliverables**:
    *   Implement **Font Fingerprinting** measurement fuzzer using `measureText` hooks.
    *   Implement **ClientRects** sub-pixel jitter.
    *   Build Local HTTP/Socks proxy authentication tunnel in the backend.

### Milestone 3: Database & Cloud Synchronization [Q3 2026]
*   **Deliverables**:
    *   Setup SQLite local storage using Knex/TypeORM for profile config saving.
    *   Build NestJS Cloud Sync server.
    *   Create zero-knowledge client-side encryption modules (AES-GCM-256) to sync cookies and caches.

### Milestone 4: Electron App & Auto Updates [Q4 2026]
*   **Deliverables**:
    *   Integrate React frontend panel into Electron main/renderer processes.
    *   Setup automated software update delivery using `electron-updater` and CDN.
