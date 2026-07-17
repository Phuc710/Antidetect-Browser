# RFC-0001 — Authentication and Session Management

**Trạng thái:** Approved
**Tác giả:** Phuc710
**Ngày tạo:** 2026-07-16
**Phiên bản:** 1.0

## 1. Background
Hệ thống Antidetect Browser cần xác thực người dùng trước khi cho phép truy cập bất kỳ tính năng nào. Session phải được quản lý an toàn giữa Desktop App (Electron) và Cloud API (NestJS), đảm bảo token không bao giờ lộ ra renderer process.

## 2. Goals
- Xác thực người dùng bằng email/password.
- Phát hành access token (ngắn hạn) và refresh token (xoay vòng).
- Lưu refresh token trong OS Credential Store (Windows Credential Manager / macOS Keychain).
- Electron main process quản lý toàn bộ session; renderer không bao giờ thấy token.
- Hỗ trợ đăng xuất khỏi tất cả phiên và quên mật khẩu qua email.

## 3. Non-Goals
OAuth, 2FA TOTP, SSO Enterprise (MVP). Device activation (RFC-0003).

## 4. Architecture
Renderer → Preload (contextBridge) → Main (AuthService) → Cloud API → OS Credential Store + SQLite cache.
Renderer KHÔNG BAO GIỜ nhận được token.

## 5. IPC Contract
```typescript
interface AuthAPI {
  login(input: { email: string; password: string }): Promise<{ user: User; expiresAt: string }>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  getMe(): Promise<User | null>;
  isAuthenticated(): Promise<boolean>;
  forgotPassword(email: string): Promise<void>;
}
interface User { id: string; email: string; name: string; createdAt: string; }
```

## 6. Security
- Argon2id password hash phía server.
- Refresh token lưu hash SHA-256 trong cloud DB.
- Refresh token reuse detection: thu hồi toàn bộ token family.
- Access token TTL: 15 phút. Refresh token TTL: 30 ngày.
- Rate limit: 5 lần/phút/IP.
- contextIsolation: true, sandbox: true.

## 7. Acceptance Criteria
- Đăng nhập thành công → vào Dashboard.
- Renderer không nhận được token ở bất kỳ dạng nào.
- Session khôi phục tự động khi restart app.
- Refresh token reuse → force logout + cảnh báo.
- Tất cả UI tiếng Việt.
- Unit test + Integration test pass.

## 8. Definition of Done
- [ ] UI: Login, Register, Forgot Password (tiếng Việt)
- [ ] IPC contract triển khai
- [ ] AuthService (Main)
- [ ] Cloud API endpoints
- [ ] OS Credential Store (keytar)
- [ ] SQLite migration
- [ ] Tests pass
- [ ] Code review OK
