# Security Specification: Key Management

Local data encryption, credentials storage, and OS keychain integration.

---

## 1. Operating System Keychains

To secure the derived master key locally without prompting the user for password entry on every launch:

```text
Host Login ➔ Electron Shell ➔ Read OS safeStorage ➔ Unlock SQLite DB
                                  ├── Windows DPAPI
                                  ├── macOS Keychain
                                  └── Linux Gnome Keyring
```

*   **macOS Keychain**: Electron calls Apple's native Keychain API via `safeStorage` to retrieve the key securely.
*   **Windows DPAPI**: Encrypts database password keys using standard DPAPI bounds, guaranteeing only the active OS profile user can decrypt files.

---

## 2. Key Derivation Mechanics (Argon2id)

When setting the user's master password:
1.  **Salt Generation**: Create a secure random 32-byte salt.
2.  **Argon2id calculation**:
    *   `memoryCost`: 65536 KB (64 MB)
    *   `timeCost`: 3 iterations
    *   `parallelism`: 4 threads
    *   `hashLength`: 32 bytes (256 bits)
3.  **Application**: Use the resulting key to open the local SQLite SQLCipher database.

---

## 3. Key Rotation Policies

*   **Local DB Key Rotation**: Users can rotate the master database key from Settings. The application re-encrypts the SQLCipher database pages in a single transaction block:
    ```javascript
    db.run("PRAGMA rekey = 'new_password'");
    ```
