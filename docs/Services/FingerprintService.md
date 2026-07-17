# Fingerprint Service Specification

This service manages the probability network generator, script injection, and browser faked variables.

---

## 1. README (Purpose)
Integrates `generative-bayesian-network` and `fingerprint-injector` to construct and inject faked platform variables inside browser sessions.

---

## 2. Architecture
```text
FingerprintService Controller
 ├── Bayesian Network Sampler (Calculates joint probabilities)
 ├── Evasion Script Compiler (Combines utils.js with faked config parameters)
 └── CDP Injector (Pushes overrides into Puppeteer/Playwright pages)
```

---

## 3. API (Interfaces)
```typescript
interface FingerprintService {
  generateFingerprint(constraints?: FingerprintConstraints): BrowserFingerprintWithHeaders;
  compileInjectionScript(fingerprint: BrowserFingerprintWithHeaders): string;
  injectIntoContext(context: any, fingerprint: BrowserFingerprintWithHeaders): Promise<void>;
}
```

---

## 4. Sequence (Compilation & Injection Flow)
```mermaid
sequenceDiagram
    participant LS as Launcher Service
    participant FS as Fingerprint Service
    participant PI as Playwright Context

    LS->>FS: generateFingerprint({ os: 'windows' })
    FS-->>LS: BrowserFingerprintWithHeaders
    LS->>FS: injectIntoContext(context, fingerprint)
    FS->>FS: compileInjectionScript(fingerprint)
    FS->>PI: context.addInitScript(compiledScript)
    PI-->>LS: Context loaded with overrides
```

---

## 5. Testing
*   **Coherency Check**: Assert that the output configuration does not combine incompatible operating systems and font rendering widths.
*   **Verification Check**: Verify that CreepJS yields a high trust score on browser initialization.
