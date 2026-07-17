# 📚 Midnight Browser Documentation Hub

Welcome to the centralized documentation index for the Anti-Detect Browser project. This system is structured into 5 logical tiers to act as the single source of truth for engineering teams (Product, Backend, Desktop, Browser Stealth, QA, and DevOps).

---

## 🗺️ Documentation Directory Map

```text
fingerprint-suite/
├── CLAUDE.md         ← Developer & AI Agent Behavior Guidelines
└── docs/
    ├── Product/          ← Level 1: Business Specs & Team Roles
    ├── System/           ← Level 2: Core System Architecture & Security
    ├── Module/           ← Level 3: Component Specifications
    ├── Implementation/   ← Level 4: JavaScript API Hook Overrides
    ├── Desktop/          ← Desktop Application Container Specs
    ├── Services/         ← 15 Core Service-Oriented Specifications
    ├── Backend/          ← Cloud Database & API Gateway Specs (Identity, Operations...)
    ├── Frontend/         ← Web Portal & Landing Page UI Specs
    ├── API/              ← 13 REST API & Webhooks Specifications
    ├── Security/         ← Security & Cryptography Spec Files
    ├── Runbooks/         ← Operations & Disaster Recovery Specs
    ├── Contributor/      ← Contributor & Coding Guidelines Specs
    ├── SDK/              ← Client SDKs & CLI Specification
    └── RFCs/             ← 24 Engineering Proposals (20-section template)
```

---

## 📂 Core Levels Directory Index

### 1. Level 1: Product Specifications (`docs/Product/`)
*   📄 [Vision.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Product/Vision.md) — Target market definition, out-of-scope parameters, business workflow.
*   📄 [Roadmap.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Product/Roadmap.md) — 4 core development milestones and timelines.
*   📄 [Roles.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Product/Roles.md) — 11 team roles and strict ownership boundaries.

### 2. Level 2: System Architecture (`docs/System/`)
*   📄 [Architecture.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/System/Architecture.md) — Component layout diagrams and session startup sequence charts.
*   📄 [Security.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/System/Security.md) — Argon2id KDF key derivation, SQLCipher, and profile data sandboxing.

### 3. Level 3: Module Specifications (`docs/Module/`)
*   📂 [Fingerprint Spec](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Module/Fingerprint/):
    *   📄 [Overview.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Module/Fingerprint/Overview.md) — Core fuzzer goals and interfaces.
    *   📄 [Requirements.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Module/Fingerprint/Requirements.md) — Functional (FR) and Non-Functional (NFR) constraints.

### 4. Level 4: Implementation Specifications (`docs/Implementation/`)
*   📂 [measureText overrides](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Implementation/measureText/):
    *   📄 [README.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Implementation/measureText/README.md) — Detailed spec for font width fuzzing with sinusoidal noise offsets.
*   📂 [getParameter overrides](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Implementation/getParameter/):
    *   📄 [README.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Implementation/getParameter/README.md) — Overriding WebGL GPU details.

### 5. Level 5: Code Package Specifications
*   Refer to each package's README files inside the [packages/](file:///c:/Users/Phucx/Desktop/fingerprint-suite/packages/) directory.

---

## 🏛️ Service-Oriented Platforms Index

### ⚙️ 15 Core Services Specifications (`docs/Services/`)
*   📄 [UIService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/UIService.md) — React Dashboard Layout.
*   📄 [ProfileService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/ProfileService.md) — Local profile CRUD hooks.
*   📄 [BrowserService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/BrowserService.md) — Chromium downloader.
*   📄 [LauncherService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/LauncherService.md) — Browser process spawner.
*   📄 [ProxyService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/ProxyService.md) — Basic auth tunnels.
*   📄 [FingerprintService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/FingerprintService.md) — Bayesian generator script injections.
*   📄 [CookieService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/CookieService.md) — Cookies SQLite decryption.
*   📄 [StorageService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/StorageService.md) — Knex SQLite pools connection.
*   📄 [SyncService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/SyncService.md) — Incremental encryption sync.
*   📄 [UpdateService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/UpdateService.md) — Auto updater.
*   📄 [LoggerService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/LoggerService.md) — logs Winston rotation.
*   📄 [LicenseService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/LicenseService.md) — Grace validation check clocks.
*   📄 [TeamService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/TeamService.md) — Profile locks WS heartbeats.
*   📄 [ExtensionService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/ExtensionService.md) — CRX parser.
*   📄 [SettingsService.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Services/SettingsService.md) — Global config.

### 🖥️ Desktop Client Modules (`docs/Desktop/`)
*   📄 [README.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/README.md) — IPC maps and folder structures.

### ☁️ Cloud Backend & UI Platforms (`docs/Backend/`, `docs/Frontend/`)
*   📄 [Backend README.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Backend/README.md) — NestJS servers, PostgreSQL schema, R2 buckets integration.
*   📄 [Frontend README.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Frontend/README.md) — Next.js portal, landing, and Stripe checkout page.

---

## 🛠️ RFCs (Request for Comments) — 20-section Proposals

*   📄 [RFC-0001 (Product Vision)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0001-Product-Vision.md)
*   📄 [RFC-0002 (System Architecture)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0002-System-Architecture.md)
*   📄 [RFC-0003 (Desktop App)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0003-Desktop-Application.md)
*   📄 [RFC-0004 (Browser Engine)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0004-Browser-Engine.md)
*   📄 [RFC-0005 (Profile Management)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0005-Profile-Management.md)
*   📄 [RFC-0006 (Workspace Management)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0006-Workspace-Management.md)
*   📄 [RFC-0007 (Fingerprint Engine)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0007-Fingerprint-Engine.md)
*   📄 [RFC-0008 (Canvas Evasion)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0008-Canvas-Fingerprinting.md)
*   📄 [RFC-0009 (Font Evasion)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0009-Font-Fingerprinting.md)
*   📄 [RFC-0010 (ClientRects Evasion)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0010-ClientRects-Evasion.md)
*   📄 [RFC-0011 (Audio Evasion)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0011-Audio-Fingerprinting.md)
*   📄 [RFC-0012 (Proxy Tunnel)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0012-Proxy-Authentication.md)
*   📄 [RFC-0013 (Cookie Sync)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0013-Cookie-Sync.md)
*   📄 [RFC-0014 (Cloud Sync)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0014-Cloud-Sync.md)
*   📄 [RFC-0015 (SQLite Local DB)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0015-SQLite-Database.md)
*   📄 [RFC-0016 (Licensing)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0016-License.md)
*   📄 [RFC-0017 (Auto Update)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0017-Auto-Update.md)
*   📄 [RFC-0018 (Browser Extensions)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0018-Browser-Extensions.md)
*   📄 [RFC-0019 (Playwright Launcher)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0019-Playwright-Launcher.md)
*   📄 [RFC-0020 (Security Architecture)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0020-Security.md)
*   📄 [RFC-0021 (WebRTC Leaks)](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/RFCs/RFC-0021-WebRTC-Leaks.md)
