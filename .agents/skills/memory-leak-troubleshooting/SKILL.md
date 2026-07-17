---
name: Memory Leak & Resource Management in Browser Automation
description: Guidelines and checklists for identifying, diagnosing, and fixing memory leaks and resource exhaustion in Node.js, Puppeteer, and Playwright applications.
---

# Memory Leak & Resource Management in Browser Automation

This skill provides guidelines and checklists to diagnose, fix, and prevent memory leaks and resource accumulation inside Node.js applications, specifically those utilizing Puppeteer, Playwright, or statistical engines like Bayesian Networks.

## Key Sources of Memory Leaks

### 1. Browser & Context Lifetime Leakage

In browser automation (Playwright/Puppeteer), launching browser instances or creating contexts without explicit destruction will leak process memory and system handles.

- **Rule:** Every launched `Browser` must have a corresponding `await browser.close()` in a `finally` block.
- **Rule:** Every `BrowserContext` and `Page` must be closed (`await context.close()`, `await page.close()`) when no longer needed.
- **Rule:** Monitor the OS process list for orphaned Chromium/Firefox processes.

### 2. Event Listener Accumulation

Attaching event listeners (e.g., `page.on('request', ...)` or `browserContext.on('page', ...)`) to persistent objects will leak memory if not cleaned up.

- **Rule:** Avoid adding listeners inside loop blocks. If listeners must be added dynamically, remove them when the task completes using `.off(...)` or `.removeListener(...)`.
- **Rule:** Be cautious of closures inside listeners that capture and retain large variables (e.g., fingerprint data, response bodies).

### 3. Caching and Global Maps

In-memory caches used to speed up fingerprint generation or header calculation can grow indefinitely.

- **Rule:** All caching mechanisms must have an eviction policy (e.g., Least Recently Used (LRU), maximum size limits, or Time-To-Live (TTL)).
- **Rule:** Never use unbound global Arrays, Maps, or Sets.

### 4. Bayesian Network & Large JSON Datasets

Loading large JSON datasets (like Bayesian network definitions) into memory can consume significant heap space if multiple instances are instantiated.

- **Rule:** Share a single instantiated model definition across generation calls (Singleton pattern or shared references) rather than reading files and parsing JSON repeatedly.

---

## Diagnostics and Debugging Tools

### 1. Node.js Heap Profiling

When running tests or crawler simulations, analyze memory footprints using:

- Node Inspector: Start Node with `node --inspect` and use Chrome DevTools under `chrome://inspect` to take heap snapshots.
- `memwatch-next` or `heapdump`: Take programmatic snapshots before and after intensive automation tasks.

### 2. Automated Checking

- In test setups, use `process.memoryUsage().heapUsed` to assertion-test that memory consumption remains flat after running 100 consecutive fingerprint injections.
