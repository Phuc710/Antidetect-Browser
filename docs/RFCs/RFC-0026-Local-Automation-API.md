# RFC-0026: Browser Application Service and Local Automation API

- **Status**: Proposed
- **Author**: Desktop & Platform Lead
- **Decided**: 2026-07-18
- **Scope**: Electron Main Process (Service Layer) & Renderer (Settings UI)

---

## 1. Background

Các công cụ automation như Playwright, Selenium, và Puppeteer thường khó quản lý trình duyệt trực tiếp nếu phải chạy cơ chế bypass, injection vân tay hoặc kết nối proxy đòi hỏi xác thực hệ thống. Mẫu thiết kế chuẩn (như AdsPower) là chạy một Local API Server bên cạnh Desktop client để nhận lệnh điều khiển trình duyệt, chuẩn bị môi trường vân tay, và trả lại connection endpoints (CDP/Webdriver/Marionette) để script ngoài đính (attach) vào session đã chạy.

---

## 2. Problem Statement

Chúng ta cần một dịch vụ ứng dụng duy nhất (`BrowserApplicationService`) trong Electron Main quản lý vòng đời trình duyệt cho cả yêu cầu từ giao diện người dùng (GUI) và từ máy khách tự động hóa bên ngoài (Local API), tránh tình trạng trùng lặp logic khởi chạy hoặc lỗi rò rỉ cổng điều khiển.

---

## 3. Goals

- Thiết lập `BrowserApplicationService` để quản lý các tiến trình trình duyệt Chromium và Firefox.
- Triển khai Local API HTTP Server chạy trên `127.0.0.1:50325` (mặc định tắt, bật qua Settings).
- Xác thực bằng Bearer token (`Authorization: Bearer <key>`) cấu hình động.
- Trả về thông tin kết nối tự động hoá (`CDP`, `WebDriver`, `Marionette`) phù hợp với từng engine.
- Quản lý hàng đợi khởi chạy (Launch Queue) và khóa phiên (Per-profile launch locks).
- Tích hợp trang Developer Settings trong giao diện máy tính.

---

## 4. Non-Goals

- Không hỗ trợ điều khiển API từ xa qua Internet (chỉ chấp nhận localhost `127.0.0.1`).
- Không đóng vai trò như một Selenium Grid trung gian.

---

## 5. Security Rules

- **Localhost Only**: Server bắt buộc chỉ được bind vào `127.0.0.1`. Không bao giờ bind vào `0.0.0.0` hoặc IP mạng nội bộ (LAN).
- **API Key Entropy**: API Key được tạo ngẫu nhiên sử dụng secure cryptographical entropy, lưu trữ dưới dạng hash (SHA-256) trong SQLite local database.
- **Credential Protection**: Các đường dẫn hệ thống nội bộ, token cá nhân, hoặc credentials không bao giờ được trả về trong payload của các status/session endpoints.
- **Process Locks**: Một profile chỉ được chạy tối đa 1 session cùng lúc. Gửi lệnh trùng sẽ trả lỗi `409 Conflict`.

---

## 6. API Interface Contracts

### 6.1 Status Endpoint
`GET /local/v1/status`
Trả về thông tin trạng thái hoạt động của Local API:
```json
{
  "status": "ready",
  "version": "0.1.0",
  "protocolVersion": "1.0",
  "deviceId": "device_masked",
  "services": {
    "database": "ready",
    "launcher": "ready",
    "cloud": "connected"
  },
  "runningBrowserCount": 2,
  "timestamp": "2026-07-18T04:00:00.000Z"
}
```

### 6.2 Start Browser Session
`POST /local/v1/browser-sessions`
Khởi chạy profile trình duyệt:
```json
{
  "profileId": "profile_uuid_here",
  "automationProtocol": "cdp",
  "headless": false
}
```
**Response (201 Created):**
```json
{
  "data": {
    "sessionId": "session_uuid_here",
    "profileId": "profile_uuid_here",
    "engine": "chromium",
    "status": "running",
    "automation": {
      "protocol": "cdp",
      "endpoint": "http://127.0.0.1:49182"
    },
    "startedAt": "2026-07-18T04:00:00.000Z"
  }
}
```

### 6.3 Stop Browser Session
`DELETE /local/v1/browser-sessions/:sessionId`
Đóng phiên và dọn dẹp tài nguyên. Trả về `204 No Content`.

---

## 7. Data Models

```typescript
type BrowserEngine = 'chromium' | 'firefox';

export type AutomationConnection =
  | {
      protocol: 'cdp';
      endpoint: string; // ws/http address
    }
  | {
      protocol: 'webdriver';
      driverPath: string;
      endpoint: string;
    }
  | {
      protocol: 'marionette';
      driverPath: string;
      port: number;
    };

export interface BrowserSession {
  sessionId: string;
  profileId: string;
  engine: BrowserEngine;
  status: 'running' | 'stopping';
  pid: number;
  automation: AutomationConnection;
  startedAt: string;
}
```

---

## 8. Implementation Structure

- `BrowserApplicationService`: Quản lý danh sách active sessions, spawn Playwright/Chromium processes, cấp cổng CDP/Marionette ngẫu nhiên.
- `LocalApiService`: HTTP server dùng Node.js `http` module.
- Preload & IPC bridge: Cho phép giao diện hiển thị trạng thái Local API và thực hiện xoay khóa.
