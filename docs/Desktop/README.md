# Desktop Client Architecture Overview

This directory contains the engineering specifications for the **Desktop Client App** (Electron + React UI container), which functions as the user-facing command center.

---

## 1. Desktop Team Structure & Alignment

The Desktop client is built by three primary sub-teams operating under strict separation rules:
*   **Electron Shell & IPC Team**: Manages preload context bridges, window lifecycles, SQLite database queries, local proxy bindings, and auto-updates.
*   **React UI/UX Team**: Builds visual components (dashboard, profile editor, settings panel) using our Midnight Design System tokens. Communication with Node.js APIs is strictly routed through the context bridge IPC channels.
*   **Runtime & Stealth Integration Team**: Integrates Playwright and manages the execution environment, loading JS evasions, and routing client traffic securely.

---

## 2. Directory Layout Specs

The desktop workspace is located under `apps/desktop-client/` and maps its dependencies to local shared packages:

```text
fingerprint-suite/
├── apps/
│   └── desktop-client/        ← Core Desktop App
│       ├── src/
│       │   ├── main.js        ← Electron Main Process
│       │   ├── preload.js     ← Preload Context Bridge
│       │   └── index.html     ← React Dashboard entry-point
│       └── package.json
└── packages/
    ├── browser-engine/        ← Custom Chromium management API
    ├── launcher/              ← Browser execution & proxy wrapper
    ├── sqlite/                ← SQLCipher database connection
    └── shared/                ← Types and common helper functions
```

---

## 3. Modular Separation Index

| Specification | Description |
|---|---|
| 📄 [Architecture.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/Architecture.md) | Shell window and process isolation design. |
| 📄 [IPC.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/IPC.md) | Channels contract mapping between Renderer and Main process. |
| 📄 [Launcher.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/Launcher.md) | Browser spawn, arg generation, and process mapping sequence. |
| 📄 [BrowserManager.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/BrowserManager.md) | Downloader, checksum verifier, and path mapper for browser runtimes. |
| 📄 [ProfileManager.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/ProfileManager.md) | Profile SQLite CRUD, duplication (cloning), and export/import helpers. |
| 📄 [LocalDatabase.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/LocalDatabase.md) | Knex migrations and SQLCipher password derivation keys. |
| 📄 [LocalProxy.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/LocalProxy.md) | Dynamically routed authenticated local proxy tunnel. |
| 📄 [AutoUpdate.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/AutoUpdate.md) | electron-updater configuration and S3 CDN connection. |
| 📄 [CrashRecovery.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/CrashRecovery.md) | Exit code sniffers and session recovery files. |
| 📄 [Logging.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/Logging.md) | Logging rules and file rotation sizes. |
| 📄 [Packaging.md](file:///c:/Users/Phucx/Desktop/fingerprint-suite/docs/Desktop/Packaging.md) | Code signing, EV certificates, and electron-builder configurations. |
