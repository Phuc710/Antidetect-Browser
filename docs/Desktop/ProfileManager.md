# Browser Profile Manager Specification

This specification documents the local CRUD operations, cloning parameters, and JSON backup export/import configurations.

---

## 1. Local Database CRUD Lifecycle

The profile manager interacts directly with the local SQLite database to create, read, update, and delete profile rows:

```text
Create Profile  ➔  Generate UUID  ➔  Write Default Config  ➔  Allocate Cache Folder
```

*   **Create**: Validates inputs (name constraints, proxy formatting). Generates a unique UUID v4. Creates the empty folder structure: `profiles/[uuid]/cache/`. Writes default configuration variables into the profiles table.
*   **Read**: Queries profile lists, filtering by user status or workspace folders.
*   **Update**: Edits individual metadata fields (e.g. name, proxy configs, tag arrays).
*   **Delete**: Performs a secure wipe:
    1.  Validates that the profile status is `stopped` (blocks deleting active processes).
    2.  Deletes the SQLite configuration row.
    3.  Recursively deletes the `profiles/[uuid]/` folder structure from the disk.

---

## 2. Cloning Configuration (Duplication)

Cloning enables rapid creation of identical profile templates without copying underlying cache directories:

*   **Config Duplication**: Copies all metadata settings (browser configuration, WebGL details, User-Agent settings, Screen sizes).
*   **Uniqueness Overrides**:
    *   Generates a new UUID v4.
    *   Creates a clean, empty `--user-data-dir` cache path.
    *   Generates a new, unique `canvasSeed` and `audioSeed` to ensure the cloned profile has a distinct fingerprint canvas hash.
*   **Storage Isolation**: Active login sessions (cookies, localStorage) are **never** copied during a standard profile clone to prevent account linkage.

---

## 3. Configuration Import / Export

*   **Export DTO**: Serializes the profile configuration variables (fingerprint settings, OS details, Proxy links) into a JSON backup file. Session cookies are omitted by default unless the user explicitly requests an encrypted backup.
*   **Import validation**: Validates JSON formatting against the profiles DB schema. Verifies that the imported settings contain realistic fingerprint combinations (high-coherency verification check).
