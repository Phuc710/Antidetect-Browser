# Application Logging Specification

This specification documents the logging levels, log file directory structures, rotation policies, and security sanitization rules.

---

## 1. Log Classifications & Outputs

To simplify debugging for Support agents, logs are split into four separate file streams:

```text
logs/
├── app.log          ← Electron Client UI and database events
├── launcher.log     ← Playwright browser startup and execution arguments
├── proxy.log        ← Local tunnel routing, handshakes, and errors
└── crash.log        ← Unhandled errors and process crash stack traces
```

*   **Log Level Rules**:
    *   *Development*: `DEBUG` level active (logs all IPC payloads and raw proxy headers).
    *   *Production*: `INFO` level active (logs events and errors only).

---

## 2. File Rotation Policies

To prevent the application from consuming too much disk space:

*   **Rotation Size**: Files are rotated using a file stream writer (e.g. `winston-daily-rotate-file`) once they reach **10MB** in size.
*   **Max Storage Age**: Rotated logs are compressed into `.gz` files and retained for a maximum of **14 days**. Older files are deleted automatically.

---

## 3. Security & Sanitization Rules

Logs must never contain sensitive user data:

*   **Proxy Credentials**: All usernames and passwords inside proxy URL logs are replaced with `[REDACTED]`.
*   **Decryption Keys**: Master keys, SQLite passwords, and AES-GCM tags are never written to the logs.
*   **User Sessions**: Active cookies and local storage tokens are omitted from all logs.
