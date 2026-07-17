# Local SQLite Database Specification

This specification documents the local database engine, migrations setup, and database file encryption.

---

## 1. Local Storage Stack

The application uses an embedded database to manage settings and configuration history on the host machine:

```text
Electron App Core  ➔  Knex.js Query Builder  ➔  better-sqlite3 Driver  ➔  SQLCipher Engine (.db file)
```

*   **Database Engine**: SQLite v3, using the high-performance `better-sqlite3` native Node.js driver.
*   **Query Builder**: `Knex.js` is used to build SQL queries, manage database connections, and run migration scripts.
*   **Encryption at Rest**: Databases are encrypted using **SQLCipher (AES-256-GCM)**. The encryption key is derived on application startup from the user's master password.

---

## 2. Schema Migrations Lifecycle

Migrations are stored under `apps/desktop-client/db/migrations/` and managed programmatically:

*   **Startup Verification**: On launch, the database manager checks the current schema version against available migrations:
    ```javascript
    const knex = require('knex')(config);
    await knex.migrate.latest();
    ```
*   **Atomic Updates**: Every migration runs inside a transaction block. If an update fails mid-run, it rolls back automatically to prevent database corruption.

---

## 3. Database Encryption Keys

*   **Key Derivation**: The database password key is derived using **Argon2id** (m=65536, t=3, p=4) from the user's local master password.
*   **PRAGMA Decryption**: Immediately after establishing the database connection, the application sends the key check query:
    ```javascript
    db.serialize(() => {
        db.run(`PRAGMA key = "x'${hexEncodedDerivedKey}'"`);
    });
    ```
*   **Memory Management**: The derived key is zeroed out from memory buffers after opening the connection.
