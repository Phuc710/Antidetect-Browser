# Fingerprint Module Requirements

This document specifies the functional and non-functional requirements for the Fingerprint module.

---

## 1. Functional Requirements

### FR-1: High Coherency Check
The system must generate cohesive fingerprints. A macOS User-Agent must NEVER be paired with a Windows Direct3D GPU or Windows system fonts (e.g. Segoe UI). The generator must sample properties from a trained joint probability distribution (Bayesian Network).

### FR-2: Javascript Prototype Redefinition
Overrides must be executed at the prototype level (e.g., `Navigator.prototype.webdriver` set to `false` via custom property descriptor), leaving the instance properties untouched unless standard browser standards dictate otherwise.

### FR-3: Stringification Protection
Every overridden function must mimic native behavior:
*   Calling `fn.toString()` on a spoofed function must return `function [name]() { [native code] }`.
*   Direct prototype manipulation checks must not expose the proxy wrapper.

### FR-4: Stack Trace Hiding
If an error is thrown within an overridden function, all internal injection frames (e.g. references to `utils.js` or `handler.apply`) must be stripped from the error's `.stack` trace.

---

## 2. Non-Functional Requirements

### NFR-1: Low Execution Latency
*   Generating a fingerprint must take less than **5 milliseconds** in standard mode.
*   Generating a fingerprint with constraint propagation (screen size constraints) must take less than **50 milliseconds**.
*   Injecting the script must add less than **2 milliseconds** of overhead to page loading times.

### NFR-2: Compatibility
The injected script must support:
*   Chromium-based browsers (Chrome, Edge).
*   Firefox.
*   WebKit (Safari).

### NFR-3: Memory Leak Prevention
The script injection must not leak references to the parent context. When a page is closed, all allocated proxies, listeners, and frame sniffer handlers must be garbage-collected cleanly.
