# Packaging & Code Signing Specification

This specification documents the Electron application compilation, code signing, macOS notarization, and installer configurations.

---

## 1. Compilation & Bundling Stack

The application is compiled from source and packaged using `electron-builder`:

```text
TypeScript / React source  ➔  Vite Build  ➔  Electron Shell Packaging  ➔  electron-builder output
```

*   **Vite**: Compiles the React GUI code, resolving assets paths.
*   **electron-builder**: Bundles the compiled source, the local Node.js launcher, and the target browser runtimes into OS-specific installers.

---

## 2. Code Signing & Notarization

To prevent Windows SmartScreen alerts or macOS "unidentified developer" warnings:

### A. Windows Code Signing
*   **Requirement**: Signs the `.exe` installer and all internal binaries (including custom chromium files) using an **EV (Extended Validation) Code Signing Certificate**.
*   **Command Tool**: Done using `signtool.exe` integrated into the build pipeline.

### B. macOS Notarization
*   **Requirement**: Signs using an **Apple Developer ID Certificate**.
*   **Notarization**: Submits the compiled `.dmg` or `.pkg` application to Apple's notarization servers:
    ```bash
    xcrun notarytool submit MidnightBrowser.dmg --keychain-profile "Developer-Account" --wait
    ```
*   **Stapling**: Staples the ticket to the `.dmg` so the OS can verify the signature offline.

---

## 3. Installer Scripts Configuration

### Windows Installer (NSIS)
*   **Custom Setup**: Generates a quiet, user-space installer that does not require Administrator privileges.
*   **Configuration (`electron-builder.yml`)**:
    ```yaml
    nsis:
      oneClick: true
      perMachine: false
      allowToChangeInstallationDirectory: false
      createDesktopShortcut: true
      createStartMenuShortcut: true
      shortcutName: "Midnight Browser"
    ```

### macOS Installer (DMG)
*   **Layout**: Displays a drag-and-drop installer window putting the application icon into the `/Applications` folder shortcut.
