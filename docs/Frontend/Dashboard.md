# Frontend Spec: Dashboard & User Portal

This document details the React portal state architecture, component states, and workspace layouts.

---

## 1. Zustand Global State Store

We use **Zustand** to manage application states without performance bottlenecks:

```text
Dashboard View  ➔  Zustand Profile Store (Actions)  ➔  Zustand API Hooks
                       ├── profiles: Profile[]
                       ├── activeId: string | null
                       └── fetchProfiles() / startProfile()
```

*   **Profiles State**: Cache list of current profiles, loading states, and active lock states.
*   **Heartbeat Hooks**: Triggers WebSocket heartbeats automatically when launching profile states change.

---

## 2. Layout Grid & Responsiveness

The interface is built using responsive CSS grid parameters:

*   **Grid Specs**: Max page width container set to `1440px`. Layout scales down to `960px` layout (minimum width).
*   **Carbon Panels Style**: Card containers use `#0f1011` background voids with subtle `1px solid #23252a` hairlines to separate columns.
*   **Profile Row States**:
    *   `IDLE`: Display "START" action in Green.
    *   `LAUNCHING`: Spinners active, buttons disabled.
    *   `RUNNING`: Display "STOP" in Orange/Red.

---

## 3. Preload IPC Bridging Integration

The web UI communicates with Electron main thread via preload APIs:

```typescript
interface DashboardPreloads {
  launchProfile: (id: string) => Promise<{ success: boolean; pid?: number }>;
  stopProfile: (id: string) => Promise<{ success: boolean }>;
}
```
Exposed to portal pages via `window.electronAPI`.
