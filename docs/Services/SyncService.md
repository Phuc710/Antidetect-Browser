# Sync Service Specification

This service manages local-to-cloud profile database synchronizations, compression, and encryption.

---

## 1. README (Purpose)
Syncs profile cookies, localStorage metadata, and settings to cloud database servers using zero-knowledge client-side encryption.

---

## 2. Architecture
```text
Storage Changes ➔ Diff Manifest Scanner ➔ Brotli / Gzip Compressor
                     ➔ AES-GCM-256 Encrypter ➔ HTTPS Upload to Cloud S3/R2
```

---

## 3. API (Interfaces)
```typescript
interface SyncService {
  syncProfile(profileId: string, key: Buffer): Promise<SyncResult>;
  downloadProfile(profileId: string, key: Buffer): Promise<void>;
  checkLocalDiff(profileId: string): Promise<FileDiff>;
}
```

---

## 4. Sequence (Cloud Sync Flow)
```mermaid
sequenceDiagram
    participant App as Electron App
    participant SS as Sync Service
    participant API as Cloud API Server
    participant R2 as Cloudflare R2 Bucket

    App->>SS: syncProfile(id, key)
    SS->>SS: Scan profile cache files and calculate hashes
    SS->>API: POST /sync/check { fileHashes }
    API-->>SS: Return list of modified files (diff)
    SS->>SS: Gzip and Encrypt modified files using AES-GCM key
    SS->>API: POST /sync/upload-urls { files }
    API-->>SS: Return presigned R2 upload URLs
    SS->>R2: PUT /file-blobs (Stream encrypted bytes directly)
    R2-->>SS: Upload completed
    SS->>API: POST /sync/confirm { manifest }
    API-->>SS: 200 OK
```

---

## 5. Testing
*   **Zero-Knowledge validation**: Verify that S3 logs contain only ciphertext and verify that no decryption keys are sent to the Cloud API server.
*   **Resume verification**: Verify syncing recovers correctly from network interrupts.
