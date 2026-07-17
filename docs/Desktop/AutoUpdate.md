# Auto-Update System Specification

This specification documents the update check cycles, background download pipelines, and differential blockmap updates.

---

## 1. Background Updates Pipeline

To keep browser stealth overrides up to date without interrupting usage, updates are executed in a non-blocking background queue:

```text
Check Updates  ➔  Download blockmap  ➔  Background Delta Download  ➔  Quit & Install
 (Every 24 hours)   (Compare signatures)     (Download only changes)     (App restart)
```

*   **Check Cycle**: Checks for updates on application startup and periodically every 24 hours using a background timer.
*   **Asset Storage**: Compiled packages, release executables, and update manifests (`latest.yml`) are hosted on an S3-compatible object storage bucket behind a global CDN.

---

## 2. Differential NSIS / DMG Updates

To optimize user bandwidth, we use differential updates instead of downloading the full installer:

*   **Blockmap Generation**: When compiling Windows (`.exe`) or macOS (`.dmg`) builds, `electron-builder` generates a corresponding `.blockmap` file containing hash lists of different file blocks.
*   **Delta Download**: `electron-updater` requests the target blockmap. It reads the local installation blocks, compares them against the remote manifest, and downloads only the modified file blocks (reducing typical update size from **150MB** down to **< 30MB**).

---

## 3. Configuration & Installer Triggers

### Config setup (`electron-builder.yml`)
```yaml
publish:
  provider: s3
  bucket: midnight-browser-releases
  region: us-east-1
```

### Apply Update Trigger
Once downloading is completed:
1.  Fires the `update-downloaded` event to the renderer.
2.  Displays a Toast popup in the UI: *"A new version is ready. Click here to restart."*
3.  On user click, runs `autoUpdater.quitAndInstall()` to apply the update cleanly.
