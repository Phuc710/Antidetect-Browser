# Team Service Specification

This service manages workspace sharing configurations, user role validation, and profile locks.

---

## 1. README (Purpose)
Enables multi-user operations in shared workspaces, checking access roles, and preventing concurrent runs of identical profile sessions.

---

## 2. Architecture
```text
TeamService Controller
 ├── Permissions gate (Checks role mappings)
 ├── Heartbeat manager (Pings profile active status via WebSockets)
 └── Profile locks auditor (Releases locks when browser closes)
```

---

## 3. API (Interfaces)
```typescript
interface TeamService {
  getWorkspaceMembers(workspaceId: string): Promise<Member[]>;
  updateMemberRole(workspaceId: string, userId: string, role: string): Promise<void>;
  acquireProfileLock(profileId: string): Promise<boolean>;
  releaseProfileLock(profileId: string): Promise<void>;
  startHeartbeat(profileId: string): void;
  stopHeartbeat(profileId: string): void;
}
```

---

## 4. Sequence (Lock Acquisition Flow)
```mermaid
sequenceDiagram
    participant App as Electron App
    participant TS as Team Service
    participant API as Cloud API WebSockets
    participant Redis as Redis Lock Cache

    App->>TS: acquireProfileLock("profile_123")
    TS->>API: WS request 'lock:acquire' { profileId }
    API->>Redis: SETNX lock:profile_123 (Check lock)
    Redis-->>API: Status (1 = Success)
    API-->>TS: WS response 'lock:acquired' { success: true }
    TS->>TS: startHeartbeat(profileId)
    TS-->>App: Lock granted, browser launch allowed
```

---

## 5. Testing
*   **Conflict test**: Assert that concurrent launch attempts from separate client machines block the second client.
*   **Heartbeat timeout test**: Verify that if a client crashes without releasing a lock, the cloud lock is released after 3 minutes of heartbeat silence.
