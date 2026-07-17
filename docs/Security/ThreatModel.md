# Security Specification: Threat Model

Threat model, attack vectors mapping, and mitigation checklist for the anti-detect ecosystem.

---

## 1. Attack Vector Registry

| Threat | Target | Vector | Mitigation |
|---|---|---|---|
| **Memory Extraction** | Client | Dumping RAM to extract decrypted session cookies. | Zero-out key variables from buffers immediately after database connection opens. |
| **Prototype Pollution** | Browser | JS running on web pages traps prototype getters to detect spoofing scripts. | Traps isolated via `Object.defineProperty` on prototypes instead of instance variables. |
| **CDP Leakage** | Browser | Websites query debugging ports or parameters (e.g. `navigator.webdriver`). | Compile custom Chromium engine with CDP port listener disabled. |
| **IPC Injection** | Client | Compromised UI Renderer process executes arbitrary Node code on host OS. | Enable `contextIsolation: true` and enforce `sandbox: true` on browser windows. |

---

## 2. Defensive Checklist

*   **Runtime Audits**: Verify execution context does not expose global Node namespaces (`process`, `require`) to the renderer.
*   **Wipe Files**: Enforce secure file delete logic (overwriting file sectors with zero bytes before unlinking) for deleted profile caches.
*   **Signature Lock**: Launcher service verifies the signed hash of local browser runtimes before spawning processes.
