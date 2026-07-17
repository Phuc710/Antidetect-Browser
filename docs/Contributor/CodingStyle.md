# Contributor: Coding Style & Naming Rules

Coding styles, variables casing, folder directory conventions, and linter check parameters.

---

## 1. Naming & Casing Conventions

To maintain consistency across monorepo packages, follow these rules:

*   **TypeScript / JavaScript**:
    *   *Variables, functions, class instances*: `camelCase`.
    *   *Classes, Interfaces, Types, Enums*: `PascalCase`.
    *   *Constants*: `UPPER_SNAKE_CASE`.
    *   *Filenames*: `kebab-case` (e.g. `fingerprint-injector.ts`).
*   **CSS / Styles**:
    *   *Class selectors*: `kebab-case` (e.g. `.profile-table-row`).
*   **SQL Schema**:
    *   *Database tables and columns*: `lower_snake_case` (e.g. `profile_id`).

---

## 2. Directory Layout Conventions

Packages under `packages/` must utilize this standard folder layout:
```text
package-name/
├── src/                ← Production code files
│   ├── index.ts        ← Export entry-point
│   └── utils.ts
├── tests/              ← Test suites files
│   └── index.test.ts
├── package.json
└── tsconfig.json
```

---

## 3. Linter Parameters (ESLint / Prettier)

The project includes strict ESLint checking:
*   **No Implicit Any**: Explicit typescript type signatures are required on all functions inputs.
*   **Double Quotes**: Use double quotes for strings inside TS/JS files.
*   **Semicolons**: Enforced on statement endings.
