# Inter-Process Communication (IPC) Channels

This document specifies the exact IPC channels, event naming schemes, payloads, and response interfaces.

---

## 1. IPC Channels Design & Contracts

All communication passes through Electron's `ipcRenderer.invoke()` (Renderer ➔ Main) returning a Promise, or `ipcRenderer.on()` (Main ➔ Renderer) for push notifications.

### A. Profile Actions (`ipc/profile`)
*   **`profile:list`**: Returns a list of profiles.
    *   *Payload*: `{ page?: number, limit?: number, workspaceId?: string }`
    *   *Response*: `Promise<{ profiles: Profile[], totalCount: number }>`
*   **`profile:create`**: Writes a new profile config.
    *   *Payload*: `ProfileCreateDTO` (Name, proxy link, target OS, canvas seed)
    *   *Response*: `Promise<{ success: boolean, profile?: Profile, error?: string }>`
*   **`profile:delete`**: Wipes the profile row and caches.
    *   *Payload*: `{ id: string }`
    *   *Response*: `Promise<{ success: boolean }>`

### B. Browser Execution (`ipc/browser`)
*   **`profile:launch`**: Triggers Playwright engine startup.
    *   *Payload*: `{ id: string, targetUrl?: string }`
    *   *Response*: `Promise<{ success: boolean, pid?: number, error?: string }>`
*   **`profile:stop`**: Shuts down the targeted browser process.
    *   *Payload*: `{ id: string }`
    *   *Response*: `Promise<{ success: boolean }>`

### C. Proxy Verification (`ipc/proxy`)
*   **`proxy:test`**: Verifies proxy credentials, latency, and geographic resolution.
    *   *Payload*: `ProxyConfigDTO`
    *   *Response*: `Promise<{ success: boolean, latencyMs?: number, country?: string, ip?: string }>`

### D. Licensing Gates (`ipc/license`)
*   **`license:check`**: Requests subscription tiers and validation times.
    *   *Payload*: None (uses stored client license key)
    *   *Response*: `Promise<{ valid: boolean, tier: string, expiryTimestamp: number }>`

### E. Auto Update notifications (`ipc/update`)
*   **`update:check`**: Forces update check.
    *   *Payload*: None
    *   *Response*: `Promise<{ updateAvailable: boolean, version?: string }>`

---

## 2. Event Listeners (Push Events)

The Renderer process listens for these events to update the UI status reactively:

```typescript
// IPC Event Listeners registration in renderer
window.electronAPI.onProfileStatusChange((event, data: { profileId: string, status: string, pid?: number }) => {
    // Updates Zustand dashboard state
});
```

*   **`profile:status-change`**: Emitted by Main process when a browser changes state (e.g., `launching`, `running`, `stopped`).
*   **`profile:crashed`**: Emitted when a Playwright child process terminates with a non-zero exit code.
*   **`update:download-progress`**: Emitted by the Auto-Update manager during background updates.
