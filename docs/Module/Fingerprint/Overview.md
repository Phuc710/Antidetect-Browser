# Fingerprint Module Overview

This document provides a domain-level overview, functional boundaries, and interfaces of the Browser Fingerprint Module.

---

## 1. Why (Domain Goal)
Websites use device fingerprinting (tracking fonts, canvas, WebGL, battery, screen dimensions) to identify automated browser engines and link accounts. This module is responsible for:
*   Generating high-coherency fingerprints that mimic real physical machines.
*   Injecting these configs into browser sessions (Chromium/Firefox) invisibly.

---

## 2. What (Functional Scope)
*   **Coherent Fingerprint Generation**: Samples coordinates, fonts, and WebGL cards logically (no macOS configurations running on Windows system fonts).
*   **stealth Injection**: Modifies Javascript global properties on the prototype chain (`Navigator.prototype`, `Screen.prototype`, `WebGLRenderingContext.prototype`) at the document initialization phase.
*   **Anti-Detection checks**: Redefines functions while matching native `.toString()` patterns and sanitizing thrown errors.

---

## 3. Interfaces & Contracts

The module is exposed to other developer teams via two clean interfaces:

### A. Generator Interface
```typescript
interface FingerprintGenerator {
    getFingerprint(options?: FingerprintGeneratorOptions): BrowserFingerprintWithHeaders;
}
```

### B. Injector Interface
```typescript
interface FingerprintInjector {
    attachFingerprintToPlaywright(context: BrowserContext, fingerprint: BrowserFingerprintWithHeaders): Promise<void>;
    attachFingerprintToPuppeteer(page: Page, fingerprint: BrowserFingerprintWithHeaders): Promise<void>;
}
```

---

## 4. Known Issues & Limitations

*   **Execution Timing**: If the site runs detection checks *instantly* in inline scripts before Playwright finishes executing `addInitScript` (or if it tests prototype references inside a custom iframe context during early layout loading), the injection trace might be exposed.
*   **Chromium Engine Hardcoded Traps**: Certain internal properties (like `navigator.plugins` length) are difficult to modify reliably via standard Javascript redefinition because Chromium’s engine returns native getters that can override the proxy when queried in specific layouts.
