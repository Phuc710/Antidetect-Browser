# Anti-Detect Browser Technical Implementation Details

This reference document contains concrete code patterns, configuration parameters, and implementation designs for the core parts of the product.

---

## 1. Electron IPC Bridge Pattern (Frontend-to-Backend)

In an Electron desktop application, the Frontend (Renderer Process) cannot launch browser processes directly due to security sandboxing. You must bridge commands through the Main Process via Inter-Process Communication (IPC).

### Renderer Process (React/Frontend)
```javascript
// Triggering a profile to start from the UI
async function startProfile(profileId) {
    console.log(`Requesting Main process to launch profile: ${profileId}`);
    const result = await window.electronAPI.launchProfile(profileId);
    if (result.success) {
        console.log("Browser opened successfully");
    } else {
        alert(`Launch failed: ${result.error}`);
    }
}
```

### Preload Script (`preload.js`)
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    launchProfile: (profileId) => ipcRenderer.invoke('launch-profile', profileId),
});
```

### Main Process (`main.js` - Backend)
```javascript
const { app, ipcMain } = require('electron');
const { BrowserLauncher } = require('./packages/browser-launcher');

ipcMain.handle('launch-profile', async (event, profileId) => {
    try {
        // 1. Fetch profile configuration and proxy details from Local DB
        const profile = await fetchProfileFromDB(profileId);

        // 2. Launch the browser instance using browser-launcher engine
        const launcher = new BrowserLauncher();
        const instance = await launcher.launch(profile);
        
        // Save the running browser instance reference to close it later
        activeInstances.set(profileId, instance);
        
        return { success: true };
    } catch (error) {
        console.error("Failed to launch profile:", error);
        return { success: false, error: error.message };
    }
});
```

---

## 2. Dynamic Canvas Noise Implementation (JS Override)

To prevent websites from calculating a unique Canvas Hash of your browser context, add slight, deterministic noise to drawing functions. The noise should be different for each profile, but **always the same for a single profile** during its lifetime (so it looks like a real hardware device).

```javascript
function injectCanvasNoise(profileNoiseSeed) {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    CanvasRenderingContext2D.prototype.getImageData = function (x, y, width, height) {
        const imageData = originalGetImageData.apply(this, arguments);
        const data = imageData.data;

        // Apply a deterministic noise based on the profile seed
        for (let i = 0; i < data.length; i += 4) {
            // Modify red, green, or blue color values slightly
            const pixelIndex = i / 4;
            const noise = Math.sin(pixelIndex + profileNoiseSeed) * 2; // Offset value between -2 and +2
            
            data[i] = Math.min(255, Math.max(0, data[i] + Math.round(noise)));
        }

        return imageData;
    };
}
```

---

## 3. Sandboxed Browser Launch Configurations

When launching Chromium instances via Playwright/Puppeteer, always pass the following flags to disable standard automation traces and isolate local storage:

```javascript
const browser = await playwright.chromium.launch({
    executablePath: '/path/to/custom/chromium', // Or standard chrome binary
    headless: false,
    args: [
        `--user-data-dir=${profileCacheDir}`, // Essential: separate profile storage
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Hides navigator.webdriver (MVP)
        '--use-automation-extension=false',
        '--disable-infobars', // Hides "Chrome is being controlled by automated software"
        `--proxy-server=${profileProxyAddress}`, // Route profile through private proxy
    ],
});
```
