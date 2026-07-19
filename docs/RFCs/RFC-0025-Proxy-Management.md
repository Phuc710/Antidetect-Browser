# RFC-0025 — Proxy Management (Phase 1: BYOP)

- **Status**: Draft
- **Author**: Desktop Team
- **Reviewers**: Pending
- **Last updated**: 2026-07-18
- **Scope**: Desktop Client only (Electron main + Renderer). Cloud API integration deferred to Phase 2.

---

## 1. Problem

Người dùng cần tạo, chỉnh sửa, kiểm tra kết nối và xóa proxy của họ trong Desktop Client. Proxy sau khi lưu phải được gán cho browser profile để toàn bộ lưu lượng của Chromium đi qua proxy đó, **không** lộ IP thật của máy người dùng.

---

## 2. Goals

- CRUD proxy đầy đủ (tạo, đọc, sửa, xóa).
- Hỗ trợ HTTP, HTTPS, SOCKS5.
- Hai chế độ xác thực: `none` (IP Allowlist) và `username_password`.
- Test proxy từ Electron main process: trả về public IP, quốc gia, thành phố, timezone và latency.
- Hiển thị cờ quốc gia qua FlagCDN (`flagcdn.com`) — CDN ảnh tĩnh, không phải API động.
- Credential (username/password) được lưu trong **OS Secure Storage** (keytar), KHÔNG lưu plaintext trong SQLite.
- Renderer KHÔNG BAO GIỜ nhận lại password đã lưu qua IPC.
- Gán proxy cho profile chạy trong database transaction.
- Bulk test với concurrency limit và cancel.
- Hoạt động offline với data cache từ SQLite.

---

## 3. Non-Goals (Phase 1)

- Không có Proxy Marketplace (mua proxy trong app).
- Không xây proxy server.
- Không rotate proxy tự động.
- Không đồng bộ credential lên Cloud.
- Không test proxy từ cloud server.
- Không import proxy từ CSV (deferred to Phase 1.1).

---

## 4. Security Rules — MUST NOT VIOLATE

> [!CAUTION]
> Các rule sau là bất khả xâm phạm. Vi phạm bất kỳ rule nào là blocker.

1. **Không trả password trong bất kỳ IPC response nào** sau khi đã lưu.
2. **Không lưu password plaintext trong SQLite** — chỉ lưu `credential_key` (tham chiếu đến keytar entry).
3. **Không log proxy URL có chứa credential** (`socks5://user:pass@host:port` bị cấm trong log).
4. **Không copy password đã lưu vào clipboard** — chỉ copy `host:port` hoặc `protocol://host:port`.
5. **Chỉ cho reveal password trong form trước khi submit** — sau khi lưu, password field luôn empty.
6. **Khi edit proxy**, password field để trống = giữ credential cũ. Điền vào = thay thế.
7. **SSRF protection**: Test request bị chặn nếu host resolve về:
   - `127.0.0.0/8` (localhost)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private)
   - `169.254.0.0/16` (link-local / cloud metadata)
   - `::1`, `fc00::/7` (IPv6 private)
8. **Concurrency limit**: Tối đa 5 test proxy đồng thời.
9. **Timeout**: Mỗi test proxy timeout sau 15 giây.
10. **Response-size limit**: Geolocation API response bị truncate sau 64KB.
11. **IPC input validation**: Tất cả IPC input được validate bằng Zod schema trước khi xử lý.
12. **Credential bị xóa khỏi keytar** khi proxy bị xóa.

---

## 5. Proxy Status States

```typescript
type ProxyStatus =
  | 'unchecked'            // Mới tạo, chưa test
  | 'checking'             // Đang test
  | 'online'               // Test thành công
  | 'offline'              // Không kết nối được
  | 'authentication_error' // Sai username/password
  | 'timeout'              // Test quá 15 giây
  | 'configuration_error'; // Host/port không hợp lệ
```

---

## 6. Authentication Modes

```typescript
type ProxyAuthentication =
  | { mode: 'none' }
  | {
      mode: 'username_password';
      username: string;
      // password KHÔNG được có trong type này sau khi lưu
    };
```

Form phải thay đổi theo `mode`. Khi `mode = 'none'`, ẩn toàn bộ credential fields.

---

## 7. IPC Contract

```typescript
// src/shared/types/proxy.types.ts

// View trả về Renderer — KHÔNG có password
interface ProxyView {
  id: string;
  name: string;
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  authMode: 'none' | 'username_password';
  usernameMasked: string | null;   // "us****" — chỉ mask, không phải giá trị thật
  status: ProxyStatus;
  countryCode: string | null;      // ISO 3166-1 alpha-2 lowercase: "vn", "us"
  city: string | null;
  timezone: string | null;
  latencyMs: number | null;
  lastCheckedAt: string | null;    // ISO 8601
  createdAt: string;
  updatedAt: string;
}

interface ProxyTestResult {
  status: 'online' | 'offline' | 'timeout' | 'authentication_error' | 'configuration_error';
  publicIp: string | null;
  countryCode: string | null;     // Dùng để render flag từ flagcdn.com
  city: string | null;
  timezone: string | null;
  latencyMs: number | null;
  checkedAt: string;
}

// IPC API exposed qua preload
interface ProxyDesktopAPI {
  list(input: ListProxiesInput): Promise<{ items: ProxyView[]; total: number }>;
  create(input: CreateProxyInput): Promise<ProxyView>;
  update(input: UpdateProxyInput): Promise<ProxyView>;
  remove(input: { proxyId: string }): Promise<void>;
  testDraft(input: TestDraftProxyInput): Promise<ProxyTestResult>;    // Test trước khi lưu
  testStored(input: { proxyId: string }): Promise<ProxyTestResult>;   // Test proxy đã lưu
  cancelTest(input: { testId: string }): Promise<void>;
  onTestProgress(listener: (event: ProxyTestProgressEvent) => void): () => void;
}

// Input schemas (validated bằng Zod trong main process)
interface CreateProxyInput {
  name: string;
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;    // 1-65535
  authMode: 'none' | 'username_password';
  username?: string;
  password?: string;   // Chỉ có trong input, KHÔNG được persist trong React state
}

interface UpdateProxyInput {
  proxyId: string;
  name?: string;
  protocol?: 'http' | 'https' | 'socks5';
  host?: string;
  port?: number;
  authMode?: 'none' | 'username_password';
  username?: string;
  password?: string;   // undefined = giữ credential cũ
}

interface TestDraftProxyInput {
  testId: string;      // UUID từ renderer để cancel
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  authMode: 'none' | 'username_password';
  username?: string;
  password?: string;
}
```

---

## 8. SQLite Schema (Migration v2)

```sql
-- Migration version 2: create_proxies
CREATE TABLE proxies (
  id               TEXT PRIMARY KEY,           -- UUID v4
  name             TEXT NOT NULL,
  protocol         TEXT NOT NULL,              -- 'http' | 'https' | 'socks5'
  host             TEXT NOT NULL,
  port             INTEGER NOT NULL
                     CHECK (port BETWEEN 1 AND 65535),
  auth_mode        TEXT NOT NULL DEFAULT 'none', -- 'none' | 'username_password'
  username         TEXT,                        -- Plaintext OK (không sensitiv)
  credential_key   TEXT,                        -- keytar key: "proxy-{id}"
  status           TEXT NOT NULL DEFAULT 'unchecked',
  country_code     TEXT,                        -- ISO 3166-1 alpha-2 lowercase
  city             TEXT,
  timezone         TEXT,
  latency_ms       INTEGER,
  last_checked_at  TEXT,                        -- ISO 8601
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE profile_proxy_assignments (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proxy_id    TEXT REFERENCES proxies(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (profile_id)   -- Mỗi profile chỉ 1 proxy tại một thời điểm
);

CREATE INDEX idx_proxies_status ON proxies(status);
```

> [!IMPORTANT]
> `credential_key` = `"proxy-{id}"`. Password thật lưu tại:
> `keytar.setPassword("antidetect-browser", "proxy-{id}", password)`
> Khi xóa proxy → phải gọi `keytar.deletePassword(...)` TRƯỚC khi xóa DB row.

---

## 9. FlagCDN Integration

FlagCDN là CDN ảnh tĩnh theo URL convention — **không phải API JSON động.**

URL pattern: `https://flagcdn.com/{width}x{height}/{countryCode}.{format}`

Ví dụ cờ Việt Nam 20x15px WebP: `https://flagcdn.com/20x15/vn.webp`

```typescript
// Component dùng chung — đặt tại:
// src/renderer/components/CountryFlag/CountryFlag.tsx

interface CountryFlagProps {
  code: string;          // ISO 3166-1 alpha-2 lowercase từ ProxyTestResult.countryCode
  name: string;          // Alt text
  size?: 16 | 20 | 24 | 32 | 40 | 48;  // width
}

export function CountryFlag({ code, name, size = 20 }: CountryFlagProps) {
  const w = size;
  const h = Math.round(size * 0.75);  // Tỷ lệ 4:3
  const c = code.trim().toLowerCase();

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`https://flagcdn.com/${w}x${h}/${c}.webp, https://flagcdn.com/${w*2}x${h*2}/${c}.webp 2x`}
      />
      <img
        src={`https://flagcdn.com/${w}x${h}/${c}.png`}
        width={w}
        height={h}
        alt={name}
        loading="lazy"
        className="country-flag"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </picture>
  );
}
```

---

## 10. Architecture & Data Flow

```
Renderer                  Preload           Main Process
───────────────────────── ──────────────── ────────────────────────────────────
ProxyFormDialog ──────────── ipc.invoke ──> proxy:create
  (input + password)                         |-- ZodValidation
                                             |-- SSRFCheck(host)
                                             |-- db.insert(proxies) <- NO password
                                             `-- keytar.setPassword("proxy-{id}", pw)
                           <-- ProxyView --
                              (NO password)

ProxyTable ───────────────── ipc.invoke ──> proxy:testStored
  (proxyId only)                             |-- db.getProxy(id)
                                             |-- keytar.getPassword("proxy-{id}")
                                             |-- SSRFCheck(resolved_ip)
                                             |-- Tunnel --> ip-api.com/json
                                             `-- ProxyTestResult
                           <-- result --
                              (IP, countryCode, city, latency)
```

---

## 11. File Structure (post-implementation)

```
src/
|-- main/
|   |-- services/
|   |   `-- proxy-service.ts          # Singleton: CRUD + keytar + SSRF guard
|   |-- ipc/handlers/
|   |   `-- proxy-handlers.ts         # IPC registration, gọi ProxyService
|   `-- database/
|       |-- repositories/
|       |   `-- proxy-repository.ts   # Knex queries only, no business logic
|       `-- migrations.ts             # + Migration v2: create_proxies
|
|-- shared/
|   `-- types/
|       `-- proxy.types.ts            # ProxyView, ProxyTestResult, IPC inputs
|
`-- renderer/
    |-- features/proxies/
    |   |-- api/
    |   |   `-- proxy-ipc.ts          # Thin wrapper: window.desktop.proxy.*
    |   |-- components/
    |   |   |-- ProxyTable.tsx / .css
    |   |   |-- ProxyFormDialog.tsx / .css
    |   |   |-- ProxyTestResultPanel.tsx
    |   |   `-- ProxyBulkToolbar.tsx
    |   |-- hooks/
    |   |   |-- useProxies.ts
    |   |   |-- useCreateProxy.ts
    |   |   |-- useUpdateProxy.ts
    |   |   `-- useTestProxy.ts
    |   `-- schemas/
    |       `-- proxy-schema.ts       # Zod schema client-side validation
    |
    |-- components/
    |   `-- CountryFlag/
    |       |-- CountryFlag.tsx
    |       `-- CountryFlag.css
    |
    `-- pages/proxies/
        |-- ProxiesPage.tsx           # Compose only: <ProxyTable> + <ProxyFormDialog>
        `-- ProxiesPage.css
```

---

## 12. Acceptance Criteria

- [ ] CRUD proxy hoàn chỉnh, mỗi operation test độc lập.
- [ ] Password KHÔNG xuất hiện trong renderer sau khi đã lưu.
- [ ] SSRF guard chặn request tới localhost và private IP range.
- [ ] Test proxy từ main process trả đủ: status, publicIp, countryCode, city, timezone, latencyMs.
- [ ] CountryFlag render cờ từ flagcdn.com với graceful fallback khi code không hợp lệ.
- [ ] Concurrency limit: tối đa 5 test đồng thời; cancel hoạt động.
- [ ] Gán proxy cho profile trong database transaction (rollback nếu lỗi).
- [ ] Loading, empty, error, offline state UI.
- [ ] SQLite migration v2 idempotent.
- [ ] `keytar.deletePassword` được gọi khi xóa proxy (unit test verify).
- [ ] Audit log ghi khi create/update/delete proxy.
- [ ] Không có field `password` trong bất kỳ TypeScript type nào được trả về Renderer.

---

## 13. Open Questions (Cần quyết định trước khi implement)

> [!WARNING]
> Các câu hỏi sau ảnh hưởng trực tiếp đến implementation.

1. **Geolocation endpoint**: Dùng `http://ip-api.com/json` (free, HTTP only) hay endpoint riêng? `ip-api.com` free tier chỉ hỗ trợ HTTP — cần quyết định chấp nhận HTTP hay tự host.
2. **Keytar fallback trên Linux headless**: Nếu không có D-Bus Secret Service, credential lưu ở đâu? Chấp nhận "no-op" hay fail hard?
3. **Audit log**: Ghi trong `ProxyService` hay tách thành `AuditService` riêng?
4. **Proxy assignment UX**: Gán proxy cho profile thực hiện trên ProxiesPage hay trong ProfileFormDialog?

---

## 14. References

- RFC-0005 Profile Management
- RFC-0012 Local Proxy Authentication Tunnel
- RFC-0015 SQLite Database
- RFC-0020 Security
- [FlagCDN Documentation](https://flagpedia.net/flagcdn)
