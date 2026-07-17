# Browser Runtime Manager Specification

This specification documents the downloading, extraction, integrity check, and update cycles for custom browser binaries.

---

## 1. Multi-Engine Runtime Isolation

To support accurate fingerprint simulations, the application manages separate local browser binaries instead of relying on the host's globally installed Chrome or Playwright default paths:

```text
runtimes/
├── chromium-115/         ← Patched Chromium v115 binary
│   ├── chrome.exe
│   └── manifest.json     ← Version and build information
├── chromium-120/         ← Patched Chromium v120 binary
└── firefox-118/          ← Patched Firefox v118 binary
```

---

## 2. Binary Verification & Download Pipeline

To prevent corruption or execution crashes, downloading runtimes follows a strict checklist:

1.  **Request Download URL**: Fetches the CDN download path matching the local OS.
2.  **Download Stream**: Stream files directly to local temporary path `%TEMP%/runtimes/`.
3.  **Checksum Check**: Computes the **SHA-256** signature of the downloaded `.zip` or `.tar.gz` and verifies it against the CDN build manifest.
4.  **Extraction**: Unpacks files to the target runtime directory:
    *   Windows: `AppData/Local/MidnightBrowser/runtimes/`
    *   macOS: `Library/Application Support/MidnightBrowser/runtimes/`
5.  **Permission Mapping**: Assigns executable permissions (`chmod +x` or `chmod 755`) to the browser binary on UNIX-based systems (macOS/Linux).

---

## 3. Auto-Repair & Verifications

On application start, the Browser Manager runs audits:
*   **Presence Validation**: Checks if the target browser executable file exists at the expected path.
*   **Version Matches**: Reads the local `manifest.json` metadata. If files are missing or modified, it marks the runtime status as `corrupted` and forces an auto-repair download before the next profile launch.
