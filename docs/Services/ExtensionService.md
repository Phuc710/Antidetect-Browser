# Extension Service Specification

This service manages Chrome extension CRX downloads, unpacking, and profile injection paths.

---

## 1. README (Purpose)
Enables importing standard Chrome Web Store extensions into browser profiles by downloading, unpacking, and passing extension load arguments to Playwright Chromium launch sequences.

---

## 2. Architecture
```text
CWS extension ID ➔ CRX Downloader (Fetch CRX zip file)
                    ➔ Unpack stream (Extracts files to profile directory)
                    ➔ Manifest check (Validates MV3 / permissions)
                    ➔ Appends arg path (`--load-extension=...`)
```

---

## 3. API (Interfaces)
```typescript
interface ExtensionService {
  downloadExtension(extensionId: string): Promise<string>;
  unpackExtension(zipPath: string, targetPath: string): Promise<void>;
  getProfileExtensions(profileId: string): Promise<Extension[]>;
  addExtensionToProfile(profileId: string, extensionId: string): Promise<void>;
  removeExtensionFromProfile(profileId: string, extensionId: string): Promise<void>;
}
```

---

## 4. Sequence (Extension Load Flow)
```mermaid
sequenceDiagram
    participant UI as Electron UI
    participant ES as Extension Service
    participant CWS as Chrome Web Store CDN
    participant Disk as Local FileSystem

    UI->>ES: addExtensionToProfile(profileId, "ext_abc")
    ES->>CWS: GET /extension/ext_abc.crx
    CWS-->>ES: Return CRX binary file
    ES->>ES: Verify ZIP signature
    ES->>Disk: Extract folder to /profiles/id/extensions/ext_abc/
    ES-->>UI: Status (Installed)
```

---

## 5. Testing
*   **Launch verification**: Verify browser profiles open with installed extensions active.
*   **Corrupt check**: Verify CRX unpacking handles extraction errors without locking browser startup.
