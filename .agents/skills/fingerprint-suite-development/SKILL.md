---
name: Fingerprint Suite Development & Troubleshooting
description: Guidelines and instructions for working on the fingerprint-suite repository, including fingerprint generation, headers, injection into Playwright/Puppeteer, and troubleshooting bot detection.
---

# Fingerprint Suite Development & Troubleshooting Skill

This skill provides guidelines and procedures for working with the `fingerprint-suite` codebase. Use this skill when modifying, debugging, or expanding any package within the workspace.

## Workspace Architecture

The workspace is managed using a `pnpm` monorepo structure with the following key packages:

1. `header-generator`: Generates HTTP request headers based on real-world queries.
2. `fingerprint-generator`: Combines headers and browser fingerprints via a Bayesian generative network.
3. `fingerprint-injector`: Handles proxying and overriding Javascript APIs inside Playwright/Puppeteer pages.
4. `generative-bayesian-network`: Implements the network generation engine.

---

## Development Workflow

### Running Tests

To run tests across all workspace packages, use the following commands:

- Run all unit tests: `pnpm test`
- Run test for a specific package: `pnpm --filter <package-name> test`

### Modifying the Injector Script

Evasions are implemented in `packages/fingerprint-injector/src/utils.js`. This script is injected into the target browser context and runs before any other script executes.
When modifying `utils.js`:

- Ensure that property descriptors are preserved or properly mimicked (e.g., using `Object.defineProperty`).
- Ensure no trace is left in stack traces (`Error.prepareStackTrace` should not leak automation wrappers).
- Test using Puppeteer and Playwright configurations in both headful and headless modes.

### Updating Bayesian Network Definitions

The fingerprint network definitions are zipped inside `packages/fingerprint-generator/src/data_files/fingerprint-network-definition.zip`.

- If you update the dataset or network definitions, make sure to rebuild/re-zip this file.
- Verify the Bayesian network outputs using `generative-bayesian-network` tests to check for consistency.

---

## Evasion Testing and Verification

To verify that the injector successfully evades bot detection, run tests against anti-bot services or mock pages:

1. Use the live-testing templates under `test/antibot-services/live-testing/`.
2. Inspect the generated fingerprint output properties to ensure they match real-world distributions.
3. Test against common detectors:
    - `navigator.webdriver` must be overridden to `false` or deleted.
    - Chrome PDF viewer plugin presence.
    - Screen properties (`innerWidth` / `innerHeight` vs `screen.width` / `screen.height`).
