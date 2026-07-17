# Local Browser Launcher Specification

This document specifies the launch sequence loop, process monitoring, and environment setup for spawning anti-detect Chromium sessions.

---

## 1. Launch Loop Sequence

The local launcher coordinates multiple systems to mount an isolated, spoofed browser context:

```text
1. Prepare Profile   ➔   2. Start Proxy   ➔   3. Build Flags   ➔   4. Spawn Process   ➔   5. Apply Injections
 (Read SQLite config)     (Bind Local Tunnel)  (Blink stealth args)    (Playwright launch)    (Run context script)
```

1.  **Prepare Profile**: Reads config settings from SQLite. Creates isolated `--user-data-dir` folder path for profile.
2.  **Start Proxy**: Binds local tunnel port if proxy requires credentials.
3.  **Build Flags**: Gathers core browser arguments, setting proxy server to localhost tunnel.
4.  **Spawn Process**: Spawns headful Chromium through Playwright.
5.  **Apply Injections**: Serializes and pushes `utils.js` (Evasions code) using `context.addInitScript()`.

---

## 2. Process Monitoring & Exit Code Auditing

Once the browser starts, the launcher retains a process handle mapping the child PID:

*   **Process Watchdog**: Periodically checks browser status via Node's `child_process` hooks or process listeners.
*   **Crash Handlers**:
    ```javascript
    browser.on('disconnected', () => {
        // Shuts down the local proxy tunnel allocated to this session
        tunnel.stop();
        
        // Emits status update via IPC
        ipcMain.emit('profile:status-change', { id: profileId, status: 'stopped' });
    });
    ```
*   **Forced Termination**: If a user clicks "Stop Browser" in the UI, the launcher sends a `SIGTERM` or `SIGKILL` to the process tree, cleanly releasing locking resources of the database profile.
