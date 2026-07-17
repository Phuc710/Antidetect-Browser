---
name: TypeScript Code Review & Quality Standards
description: Comprehensive checklist and guidelines for conducting code reviews, maintaining API stability, writing clean TypeScript, and ensuring test coverage in the fingerprint-suite repository.
---

# TypeScript Code Review & Quality Standards

This skill provides code quality, architecture, and review checklists for the `fingerprint-suite` codebase. Use this skill when reviewing pull requests or drafting modifications to codebase modules.

## Code Review Checklist

### 1. Type Safety and Expressiveness

- **Strict Types:** Avoid using `any` where a concrete type, interface, or `unknown` can be used. Define explicit interfaces for browser fingerprint schemas (e.g., `ScreenFingerprint`, `NavigatorFingerprint`).
- **Optional Fields:** Mark properties that do not exist on all browsers as optional (e.g., `deviceMemory` is absent in Firefox).
- **Return Types:** Public functions and class methods must have explicit return type annotations to ensure IDE auto-completion and type safety.

### 2. API Design & Backwards Compatibility

Since this is a multi-package library published to npm and consumed by developers, breaking changes must be minimized:

- **Preserve Signatures:** Do not change existing parameter positions or types of exported functions/classes. Use optional configuration objects (e.g., `FingerprintGeneratorOptions`) to extend functionality.
- **Deprecation Notice:** Mark obsolete APIs with `@deprecated` in JSDoc comments to warn consumers before actual removal in a major version bump.

### 3. Error Handling and Resilience

- **Defensive Coding:** Injected scripts run in third-party website contexts. Errors inside `utils.js` (injector script) must be isolated so they do not crash the target web page.
- **Quiet Fallbacks:** Use try-catch blocks for non-critical features (like scheme preference emulation) and fall back gracefully if browser properties are read-only.
- **Diagnostics:** Provide a way to enable detailed logging or debugging of fingerprint injection when troubles arise.

### 4. Tests and Coverage

- **Unit Tests:** Any bug fix or new feature must be accompanied by matching unit tests inside the test suite (`packages/*/test` or root `test`).
- **Browser Integration Tests:** For evasions in `fingerprint-injector`, verify against actual automated browser instances (Playwright and Puppeteer).

### 5. Formatting and Linting

- Enforce formatting by running `pnpm prettier --check .` (configured in `.prettierrc` and `.prettierignore`).
- Enforce rules by running `pnpm lint` (configured in `eslint.config.mjs` and `.eslintrc.json`).
- Ensure code builds successfully before submitting changes by running `pnpm build`.
