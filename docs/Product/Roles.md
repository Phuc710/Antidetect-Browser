# Team Roles & Responsibilities Matrix

This document defines the 11 roles in the product organization and specifies their clear boundaries of concern.

---

## 1. Role Matrix & Team Structure

To prevent project breakdown, each sub-team operates within strict domains. Developers should focus exclusively on their relevant technical documents:

```text
                  Tech Lead (Architect)
                           │
             ┌─────────────┴─────────────┐
             │                           │
       Backend Lead                Desktop Lead
             │                           │
     ┌───────┼───────┐           ┌───────┼───────┐
     │       │       │           │       │       │
    API     DB    Security   Electron Chromium Playwright
    Team   Team     Team       Team     Team     Team
```

---

## 2. Responsibilities & Boundaries

### Technical Leadership
*   **CEO / Product Owner**: Focuses on requirements, roadmap prioritizing, milestones tracking, and release notes. Does not read or write codebase files.
*   **Product Manager**: Translates business requirements into Functional Specifications.
*   **Architect / Tech Lead**: Focuses on global layouts, system design diagrams, ERDs, sequence diagrams, and interfaces/contracts interfaces.

### Desktop Division
*   **Desktop Dev (Electron Team)**: Focuses on GUI panels, IPC bridges, local SQLite databases, browser launches, and session crash recovery. *Does not need to know NestJS cloud APIs details.*
*   **Browser Dev (Chromium & Stealth Team)**: Focuses on script injections, prototype hooks, browser custom flags, and faking hardware variables. *Does not need to know UI layouts details.*
*   **Playwright Dev**: Configures browser contexts, automation scripts, and custom cookie injectors.

### Backend Division
*   **Backend Dev (API / DB / Cloud Teams)**: Focuses on OAuth2, REST endpoints, database schemas, migration queries, and profile storage. *Does not need to know Playwright contexts details.*
*   **Security Dev**: Focuses on cryptographic protocols, SQLite encryption, credential security, threat modeling, and code audit loops.

### Supporting Operations
*   **QA Dev**: Manages unit tests, regression tests, and benchmarking against live services (CreepJS, Pixelscan).
*   **DevOps Dev**: Focuses on Docker configurations, CI/CD runners, packaging (Electron-Builder), and CDN distribution.
*   **Support Agent**: Diagnoses client execution errors and tracks local log records.
