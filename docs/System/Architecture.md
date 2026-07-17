# System Architecture Specification

This document defines the structural architecture, component mapping, and interface boundaries of the overall system.

---

## 1. System Components Layout

The product system is partitioned into independent components, each communicating via strict contracts:

```mermaid
graph TD
    subgraph ClientPC [Desktop Client Environment]
        GUI[Electron GUI Manager]
        Launcher[Playwright Local Launcher]
        Tunnel[Local Proxy Auth Tunnel]
        Cache[(Local sqlite / Browser profiles)]
    end

    subgraph CloudEnv [Cloud Backend Environment]
        API[NestJS API Gateway]
        CDN[Cloudflare CDN - Fingerprints Distribution]
        CloudDB[(PostgreSQL Database)]
    end

    GUI <-->|IPC Invokes| Launcher
    Launcher -->|Reads / Writes| Cache
    Launcher -->|Launches| Tunnel
    GUI <-->|REST API / Profile Sync| API
    API <--> CloudDB
    Launcher -->|Downloads newest network config| CDN
```

### Components Definitions
*   **Cloud API**: Stateless service handling users subscription checks (License) and encrypted cookie/localStorage synchronization.
*   **Desktop Client (Electron)**: Visual interface (Midnight theme) managing profiles.
*   **Local Launcher (Node/Playwright)**: Launches browsers locally, applying header orders and browser fingerprint overrides.
*   **Proxy Tunnel**: A local SOCKS5/HTTP tunnel handling proxy credentials to feed Playwright.
*   **CDN (Assets Distribution)**: Distributes compiled Bayesian Network CPT definitions zipped files.

---

## 2. Sequence Diagram (Full Session Lifecycle)

The sequence diagram below traces the communication from profile launch to page navigation:

```mermaid
sequenceDiagram
    autonumber
    participant GUI as Electron GUI (React)
    participant Engine as Main Process (Launcher)
    participant LocalProxy as Local Proxy Tunnel
    participant CDN as Assets CDN
    participant API as Cloud API
    participant Browser as Custom Chromium

    GUI->>Engine: Click Launch (profileId)
    activate Engine
    Engine->>API: GET /license/validate
    API-->>Engine: License Validated
    Engine->>Engine: Fetch local profile SQLite config
    Engine->>CDN: Download latest fingerprint-network-definition.zip (if outdated)
    
    Engine->>LocalProxy: Start tunnel (upstream proxy configuration)
    activate LocalProxy
    LocalProxy-->>Engine: Tunnel active on localhost:port
    deactivate LocalProxy
    
    Engine->>Browser: Launch Chromium with args (--user-data-dir, --proxy-server=localhost:port)
    activate Browser
    Engine->>Browser: Inject Fingerprint Overrides (utils.js)
    Browser->>GUI: Browser Opened Status
    deactivate Engine
    deactivate Browser
```

---

## 3. Tech Stack
*   **Backend Server**: Node.js (NestJS) / Postgres / Redis (caching and queues).
*   **Desktop App**: Electron (v28.0.0+) / React / SQLite (via Knex.js).
*   **Stealth Engine**: Playwright / Puppeteer / generative-bayesian-network CPT files.
