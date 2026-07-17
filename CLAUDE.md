# CLAUDE.md — Antidetect Browser Project

## 1. Mục tiêu

Viết code production-ready, bảo mật, hiệu năng tốt, dễ đọc, dễ kiểm thử, dễ mở rộng và bảo trì.

Ưu tiên: **Đúng chức năng → Bảo mật → Đơn giản → Dễ bảo trì → Hiệu năng → Mở rộng**

Không thêm code, dependency, abstraction hoặc tính năng ngoài yêu cầu.

---

## 2. Golden Rule

```
RFC → Design Review → Implementation → Unit Test → Integration Test
→ Code Review → Documentation Update → Merge → Tag Release → Feature Closed
```

**Chưa xong một bước thì không được sang bước tiếp theo.**
**Không code nếu chưa có RFC được approve.**

---

## 3. Tech Stack

**Monorepo:** pnpm workspace, TypeScript strict mode

**Desktop (apps/desktop-client):**
- Shell: Electron
- UI: React + TypeScript
- Build renderer: Vite (qua electron-vite)
- CSS: TailwindCSS v4
- UI components: shadcn/ui + Radix UI
- Routing: React Router v7
- Local UI state: Zustand
- Remote/server state: TanStack Query
- Icons: lucide-react
- Desktop packaging: electron-builder
- Local database: better-sqlite3 + Knex
- Browser control: Playwright
- OS credential store: keytar

**Backend (apps/cloud-api):** NestJS + PostgreSQL

**Packages dùng chung:**
```
packages/
├── shared/              — Types, IPC contracts, constants
├── sqlite/              — Local DB module
├── launcher/            — Browser lifecycle engine
├── fingerprint-generator/
├── fingerprint-injector/
├── header-generator/
└── generative-bayesian-network/
```

---

## 4. Cấu trúc thư mục Desktop App

```
apps/desktop-client/src/
├── main/
│   ├── bootstrap/
│   ├── ipc/handlers/    — IPC handlers (validate, call service, return IpcResult)
│   ├── services/        — AuthService, DatabaseService, LauncherService...
│   ├── security/
│   └── windows/         — WindowService
├── preload/
│   └── index.ts         — contextBridge expose DesktopAPI
└── renderer/
    ├── app/             — App.tsx, ProtectedRoute, AuthRoute
    ├── pages/           — Tổ chức theo route
    ├── layouts/         — AppLayout, Sidebar, TitleBar, StatusBar
    ├── features/        — Tổ chức theo domain (auth, profiles, proxies...)
    ├── store/           — Zustand stores (UI state only)
    ├── hooks/           — Custom hooks
    ├── components/ui/   — Shared UI components
    └── styles/
```

---

## 5. Quy tắc Electron Security

BrowserWindow **bắt buộc**:
```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: preloadPath,
}
```

Preload **không được** expose:
- `ipcRenderer` trực tiếp
- `window.require`
- `fs`, `path`, `child_process`
- Token hoặc secret bất kỳ

IPC handlers **bắt buộc**:
- Validate toàn bộ input trước khi xử lý
- Trả về `IpcResult<T>` — không throw raw error về renderer
- Không log credential, token, cookie, password

---

## 6. TypeScript Rules

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true
}
```

- Không dùng `any` — dùng `unknown` khi chưa kiểm chứng
- Không dùng `@ts-ignore`
- Public API phải có explicit return type
- Không import xuyên package bằng relative path — dùng package entry point

---

## 7. State Management Rules

**Zustand** — chỉ UI state:
- `authStore`: user, isAuthenticated, isLoading, error
- `uiStore`: sidebar collapsed, dialog state
- `selectionStore`: selected profile IDs
- **Không lưu token, không lưu danh sách dữ liệu lớn**

**TanStack Query** — dữ liệu async:
- Tất cả data từ Cloud API hoặc SQLite qua IPC
- Cache, invalidation, background refetch
- Query keys quản lý tập trung trong `queryKeys.ts`

---

## 8. Auth Security Rules

- Access token: sống trong **memory của Main process** — không ghi ra disk
- Refresh token: **OS Credential Store** (keytar) — không trong SQLite, không trong file
- Renderer **không bao giờ** nhận được token dưới bất kỳ dạng nào
- Refresh token reuse → thu hồi toàn bộ token family → force logout
- Auto-refresh khi còn < 2 phút trước khi hết hạn

---

## 9. Database Rules

- Mọi thay đổi schema phải có migration — không sửa migration đã chạy
- Query phải parameterized — không nối chuỗi SQL
- Dùng transaction cho thao tác nhiều bước
- SQLite chỉ lưu metadata và cache — không lưu browser data lớn
- Credential nhạy cảm phải mã hóa

---

## 10. RFC List (theo thứ tự ưu tiên)

| RFC | Tên | Trạng thái |
|-----|-----|------------|
| RFC-0001 | Authentication and Session Management | **Approved** |
| RFC-0002 | Workspace, Membership and RBAC | Draft |
| RFC-0003 | License and Device Activation | Draft |
| RFC-0004 | Profile Data Model and Cloud API | Draft |
| RFC-0005 | Desktop Local Store and Sync Protocol | Draft |
| RFC-0006 | Browser Lifecycle IPC | Draft |
| RFC-0007 | Proxy Management | Draft |
| RFC-0008 | Audit Logging | Draft |
| RFC-0009 | Billing | Draft |
| RFC-0010 | Realtime Events and Notifications | Draft |

---

## 11. Definition of Done

Task chỉ hoàn thành khi:
- Đúng yêu cầu theo RFC
- Không có lỗi TypeScript
- Không có lỗi lint
- Test liên quan pass
- Build thành công
- Input được validate
- Không lộ secret
- Tất cả UI text bằng **tiếng Việt**
