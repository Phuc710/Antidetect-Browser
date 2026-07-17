# Crash Recovery & Session Safety Spec

This specification documents the detection of browser process failures, session auto-saving hooks, and resource cleanup.

---

## 1. Browser Process Exit Monitoring

When launching Chromium, the Electron main process captures the child process descriptor:

```text
Playwright Chromium Process  ➔  Monitors exit code  ➔  Non-zero exit?  ➔  Emit status & clean zombie
```

*   **Exit Code Audit**: If a browser process exits with code `0`, it is treated as a clean user shutdown. If it exits with a non-zero code (e.g. `1` or `SIGKILL`), it is treated as a crash.
*   **Action triggers**:
    1.  Emits `profile:crashed` IPC event to update the React Dashboard UI.
    2.  Kills any orphan `local-proxy-tunnel` socket listeners associated with the session.

---

## 2. Session Auto-Saving Hooks

To prevent profile data corruption or session loss:

*   **Active Sync**: The launcher periodically scans the `--user-data-dir` (specifically cookie SQLite files and LocalStorage logs) for modifications while the browser is running.
*   **Incremental Snapshots**: Writes a local session metadata snapshot into `profile_session_backup.json` every **5 minutes**.
*   **Dirty State Recovery**: If the host PC shuts down abruptly, the Electron app detects the presence of the backup file on the next startup and prompts: *"The previous session closed unexpectedly. Do you want to restore tabs?"*

---

## 3. Zombie Process Cleanups

*   **Watcher Daemon**: If Chromium crashes, helper processes (like proxy tunnels or GPU sub-processes) might keep running as zombie processes.
*   **Targeted Kill**: The application verifies that all child process IDs mapped to the profile are stopped using:
    *   Windows: `taskkill /F /PID [pid]`
    *   UNIX: `kill -9 [pid]`
*   **File Locks**: Clears lock files (`SingletonLock` or `lockfile` files inside the profile directory) to ensure the user can launch the profile again without getting "browser is already running" error alerts.
