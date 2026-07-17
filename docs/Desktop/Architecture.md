# Desktop App Shell Architecture Spec

This document specifies the Electron process configuration, main window constraints, and security isolation layers.

---

## 1. Process Separation & Sandbox Enforcements

To comply with high-grade security audits, Node integration is restricted strictly to the Main process:

```text
+------------------------------------------+
|  Main Process (Node.js Environment)      |
|  - SQLite DB access                      |
|  - Playwright process spawning           |
|  - Upstream network socket tunnel        |
+------------------------------------------+
                    ▲
                    │ contextBridge IPC
                    ▼
+------------------------------------------+
|  Preload Script (Sandboxed Context)      |
|  - window.electronAPI method bindings    |
+------------------------------------------+
                    ▲
                    │ Render loops
                    ▼
+------------------------------------------+
|  Renderer Process (Chromium View - React)|
|  - Material Dashboard / Settings Forms   |
|  - Zero direct node access               |
+------------------------------------------+
```

*   **Main Process**: Enforces `sandbox: true` on window creation to prevent browser rendering engine bugs from escaping into OS privilege levels.
*   **Context Isolation**: `contextIsolation: true` isolates preload JS scope from the web page's scope, avoiding prototype pollution attacks.

---

## 2. Window Configurations

### Main Window Sizes
*   **Default Sizing**: Width `1200px` | Height `800px` (Designed for optimal list rendering).
*   **Window Constraints**: Min Width `960px` | Min Height `640px` (Enforces responsive CSS layout).
*   **Background Void Color**: `#08090a` (Sets default page canvas to Midnight theme before UI content mounts).

### System Tray & Notifications
*   **Tray Menu**: Minimizes to system tray instead of closing when running browser profiles exist. Tray options include:
    *   `Show App`
    *   `Profile Status List` (Shows active browser count)
    *   `Stop All Profiles`
    *   `Exit`
*   **Desktop Notifications**: Fires OS level notifications when an active browser context crashes or when a cloud synchronization finishes successfully.
