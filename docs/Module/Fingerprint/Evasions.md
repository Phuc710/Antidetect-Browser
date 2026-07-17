# Advanced Browser Evasions Specification

This document details the spoofing, monkey-patching, and prototype-redefinition logic for all 25+ browser and OS hardware identity indicators.

---

## 🗺️ Evasion Variables Blueprint

| Variable | Override Target | Spoofing Mechanics |
|---|---|---|
| **Navigator** | `navigator.userAgent`, `navigator.platform`, `navigator.languages` | Redefined on `Navigator.prototype` using custom getters. |
| **Screen** | `window.screen`, `window.innerWidth`, `window.innerHeight` | Spoofs dimensions to match the simulated device grid. |
| **WebGL & GPU** | `WebGLRenderingContext.getParameter` | Returns faked vendor/renderer GPU cards. |
| **MediaDevices** | `navigator.mediaDevices.enumerateDevices` | Returns mock lists of Webcams, Microphones, and Speakers. |
| **Permissions** | `navigator.permissions.query` | Restores standard headful state queries. |
| **Timezone** | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Spoofs time zone location strings matching the proxy location. |
| **Locale** | `navigator.language`, `Intl.NumberFormat` | Aligns numbers, date formats, and locales with proxy geolocation. |
| **Battery** | `navigator.getBattery` | Resolves a mock battery status object with consistent values. |
| **Speech** | `window.speechSynthesis.getVoices` | Mocks synthetic voices available on the target OS. |
| **Bluetooth & USB**| `navigator.bluetooth`, `navigator.usb` | Spoofs presence to match native client OS. |
| **Touch** | `navigator.maxTouchPoints`, `TouchEvent` | Set to 0 on Desktop profiles and >0 on mobile profiles. |
| **Gamepad** | `navigator.getGamepads` | Mocks standard controller connection arrays. |
| **Sensor** | `window.DeviceOrientationEvent` | Disabled on Desktop profiles, spoofed on mobile device templates. |
| **WebRTC** | `RTCPeerConnection` | Filters out host network local IP candidates. |
| **Network** | `navigator.connection` | Returns faked cellular (mobile) or ethernet/wifi values. |
| **Intl** | `Intl` API | Modifies locale collators, calendar, and numbering systems. |
| **CSS** | Media Queries (color-gamut, resolution) | Injects style overrides matching screen capabilities. |
| **SVG** | SVG text rendering width measurements | Deterministically fuzzes text widths inside SVG tags. |
| **Performance** | `performance.now()`, `performance.mark` | Adds monotonic clock jitter to block execution timing attacks. |
| **Hardware** | `navigator.hardwareConcurrency` | Set to realistic threads count (e.g. `2`, `4`, `8`, `12`). |
| **DeviceMemory** | `navigator.deviceMemory` | Spoofs RAM size (in gigabytes, matching standard floats). |
