# Contributor: Architectural Decisions Records (ADRs)

Template, structure, and history database for critical architecture choices.

---

## 1. ADR Template Format

All architectural shifts must be proposed via an ADR document following this format:

```text
ADR-[sequential_number]: [Title]

*   **Status**: Proposed | Accepted | Rejected | Superseded
*   **Decided**: [Date]
*   **Context**: What problem are we solving? What are the constraints?
*   **Decision**: What is the chosen solution? Why?
*   **Consequences**: What are the trade-offs, overhead, or requirements?
```

---

## 2. Accepted Decisions Registry

| ADR | Title | Decision | Status |
|---|---|---|---|
| **ADR-0001** | SQLCipher Encryption | Use SQLCipher instead of plain JSON files to secure local user profiles. | **Accepted** |
| **ADR-0002** | Playwright Integration | Choose Playwright over raw Puppeteer as the default Chromium browser spawner. | **Accepted** |
| **ADR-0003** | Redux to Zustand | Migrate Desktop UI global state from Redux to Zustand for simplicity. | **Accepted** |
| **ADR-0004** | Cloudflare R2 | Use R2 storage instead of AWS S3 to eliminate egress network charges. | **Accepted** |
