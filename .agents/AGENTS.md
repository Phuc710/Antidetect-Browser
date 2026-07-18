# UI DESIGN SYSTEM & COLOR RULES

This document serves as the UI Design System source of truth for the desktop client of the Antidetect Browser. All components and features must adhere to these rules strictly.

## 1. DESIGN PHILOSOPHY
* **Dark Desktop Workspace**: Professional dark mode by default, data-dense, focused on utility, legibility, and high-density information display.
* **Consistency & Clarity**: Use designated color palettes, spacing systems, and radius sizes. No arbitrary margins, paddings, or inline colors.
* **No Utility Frameworks**: Strictly React + vanilla CSS. No TailwindCSS utility classes, inline styling, CSS-in-JS, or `@apply` directives.
* **BEM Class Naming**: HTML elements must use strict BEM (Block-Element-Modifier) class naming (e.g. `profile-toolbar`, `profile-toolbar__action--active`).

## 2. THEME & COLOR TOKENS
All color variables are defined in CSS custom properties and must be imported/used via `var()`.

### A. Dark Theme (`[data-theme='dark']` / `:root`)
```css
color-scheme: dark;

/* Background layers */
--color-bg-app: #0b0f17;
--color-bg-sidebar: #0e1420;
--color-bg-header: #111827;
--color-bg-content: #111722;
--color-bg-surface: #161e2b;
--color-bg-surface-raised: #1b2534;
--color-bg-surface-hover: #202c3d;
--color-bg-surface-active: #263449;
--color-bg-overlay: rgba(2, 6, 14, 0.76);

/* Borders */
--color-border-subtle: #202b3a;
--color-border-default: #2a3749;
--color-border-strong: #3a4a60;
--color-border-focus: #4f8cff;

/* Text */
--color-text-primary: #f3f6fb;
--color-text-secondary: #b7c0ce;
--color-text-muted: #7f8b9d;
--color-text-disabled: #536071;
--color-text-inverse: #07101f;

/* Brand / Accent Colors */
--color-brand-50: #edf5ff;
--color-brand-100: #d9eaff;
--color-brand-200: #bcd9ff;
--color-brand-300: #8ec0ff;
--color-brand-400: #5ca2ff;
--color-brand-500: #367ff5;
--color-brand-600: #2563dd;
--color-brand-700: #214fb4;
--color-brand-800: #223f8e;
--color-brand-900: #21386f;

--color-accent: var(--color-brand-500);
--color-accent-hover: var(--color-brand-400);
--color-accent-active: var(--color-brand-600);
--color-accent-soft: rgba(54, 127, 245, 0.14);
--color-accent-border: rgba(92, 162, 255, 0.42);
--color-focus-ring: rgba(92, 162, 255, 0.72);

/* Semantic Diagnostics */
--color-success: #31c48d;
--color-success-hover: #48d6a1;
--color-success-soft: rgba(49, 196, 141, 0.14);
--color-warning: #f5b942;
--color-warning-hover: #ffc95f;
--color-warning-soft: rgba(245, 185, 66, 0.14);
--color-error: #ef5b67;
--color-error-hover: #ff717c;
--color-error-soft: rgba(239, 91, 103, 0.14);
--color-info: #52a8ff;
--color-info-soft: rgba(82, 168, 255, 0.14);

/* Browser Profile States */
--color-status-stopped: #7f8b9d;
--color-status-starting: #f5b942;
--color-status-running: #31c48d;
--color-status-stopping: #f59e5b;
--color-status-syncing: #52a8ff;
--color-status-locked: #a78bfa;
--color-status-error: #ef5b67;

/* Form & Input Components */
--color-input-bg: #111925;
--color-input-border: #2a3749;
--color-table-header: #121b28;
--color-table-row: transparent;
--color-table-row-hover: rgba(92, 162, 255, 0.055);
--color-table-row-selected: rgba(54, 127, 245, 0.13);
--color-scrollbar-thumb: #35445a;
--color-scrollbar-hover: #465a74;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.24);
--shadow-md: 0 8px 24px rgba(0, 0, 0, 0.26);
--shadow-lg: 0 18px 48px rgba(0, 0, 0, 0.38);
--shadow-dialog: 0 28px 80px rgba(0, 0, 0, 0.52);
```

### B. Light Theme (`[data-theme='light']`)
```css
color-scheme: light;

--color-bg-app: #eef2f7;
--color-bg-sidebar: #f7f9fc;
--color-bg-header: #ffffff;
--color-bg-content: #f4f7fb;
--color-bg-surface: #ffffff;
--color-bg-surface-raised: #ffffff;
--color-bg-surface-hover: #f1f5fa;
--color-bg-surface-active: #e8eef7;
--color-bg-overlay: rgba(15, 23, 42, 0.42);

--color-border-subtle: #e4eaf1;
--color-border-default: #d6dee9;
--color-border-strong: #bbc7d6;
--color-border-focus: #367ff5;

--color-text-primary: #172033;
--color-text-secondary: #46536a;
--color-text-muted: #748198;
--color-text-disabled: #a0aabc;
--color-text-inverse: #ffffff;

--color-accent: #2f72df;
--color-accent-hover: #2563c8;
--color-accent-active: #1f54ad;
--color-accent-soft: rgba(47, 114, 223, 0.1);
--color-accent-border: rgba(47, 114, 223, 0.32);
--color-focus-ring: rgba(47, 114, 223, 0.48);

--color-success: #16865f;
--color-success-hover: #117350;
--color-success-soft: rgba(22, 134, 95, 0.1);
--color-warning: #b87908;
--color-warning-hover: #9c6505;
--color-warning-soft: rgba(184, 121, 8, 0.1);
--color-error: #d43d4c;
--color-error-hover: #b82f3d;
--color-error-soft: rgba(212, 61, 76, 0.1);
--color-info: #2677cc;
--color-info-soft: rgba(38, 119, 204, 0.1);

--color-input-bg: #ffffff;
--color-input-border: #ccd6e3;
--color-table-header: #f6f8fb;
--color-table-row: #ffffff;
--color-table-row-hover: #f3f7fc;
--color-table-row-selected: #eaf2ff;
--color-scrollbar-thumb: #c2ccd9;
--color-scrollbar-hover: #aab6c6;

--shadow-sm: 0 1px 2px rgba(17, 32, 55, 0.07);
--shadow-md: 0 8px 24px rgba(17, 32, 55, 0.1);
--shadow-lg: 0 18px 48px rgba(17, 32, 55, 0.14);
--shadow-dialog: 0 28px 80px rgba(17, 32, 55, 0.2);
```

## 3. SPACING & LAYOUT TOKENS
Spacing values must strictly map to:
* `--space-0`: `0`
* `--space-1`: `4px`
* `--space-2`: `8px`
* `--space-3`: `12px`
* `--space-4`: `16px`
* `--space-5`: `20px`
* `--space-6`: `24px`
* `--space-8`: `32px`
* `--space-10`: `40px`
* `--space-12`: `48px`

Layout Dimension Properties:
* `--titlebar-height`: `40px`
* `--topbar-height`: `56px`
* `--statusbar-height`: `28px`
* `--sidebar-width`: `224px`
* `--sidebar-collapsed-width`: `64px`
* `--control-height-sm`: `28px`
* `--control-height-md`: `34px`
* `--control-height-lg`: `40px`
* `--table-row-height`: `48px`
* `--dialog-width-sm`: `420px`
* `--dialog-width-md`: `600px`
* `--dialog-width-lg`: `840px`

Border Radii:
* `--radius-xs`: `4px`
* `--radius-sm`: `6px`
* `--radius-md`: `8px`
* `--radius-lg`: `12px`
* `--radius-xl`: `16px`
* `--radius-pill`: `999px`

## 4. TYPOGRAPHY
* UI Font Family: `Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`
* Mono Font Family: `JetBrains Mono, Cascadia Code, Consolas, monospace`
* Font Sizes:
  * `xs`: `11px`
  * `sm`: `12px`
  * `md`: `13px`
  * `base`: `14px`
  * `lg`: `16px`
  * `xl`: `20px`
  * `2xl`: `24px`
* Weights:
  * `normal`: `400`
  * `medium`: `500`
  * `semibold`: `600`
  * `bold`: `700`

## 5. CODE REUSABILITY & SERVICE RULES (DRY & OOP)
* **CSS Component Unification**: UI components used across multiple pages (e.g., buttons, input controls, loaders, status badges) must be placed in a shared `components.css` stylesheet and imported globally rather than duplicated inside local CSS.
* **Service Encapsulation (OOP)**: Business logic, database interactions, process spawning, and API requests must be encapsulated within Singleton Service classes (e.g., `AuthService`, `ProfileService`, `DatabaseService`). Components should invoke methods on these services rather than executing queries or APIs directly.
* **DTO and Schema Safety**: Leverage strong TypeScript types and schemas (DTOs) for IPC data exchange. Any data structure sent across boundary processes must be explicitly validated.
* **Keep Code DRY**: Abstract common algorithms, date formatting, and string manipulation helpers into a central `utils/` or `shared/` library. Avoid inline helper functions inside component hooks.

