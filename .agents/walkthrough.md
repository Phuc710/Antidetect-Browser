# Walkthrough — Design Review Remediations & Architectural Alignment

Toàn bộ 12 điểm phản biện từ Design Review và giao diện Form Tạo Profile mới đã được khắc phục và tích hợp đầy đủ:

---

## 1. Các điểm đã khắc phục (Remediations)

1. **Trạng thái Khóa (Locking Scope)**: Minh bạch trạng thái: Layer 1 (In-process Mutex) & Layer 2 (Durable Lockfile) đã implement; Layer 3 (Cloud Lease) được xác nhận policy là Out-of-scope cho pha Local-only MVP.
2. **Từ vựng Trạng thái Runtime (`ProfileRuntimeState`)**: Đồng nhất 11 trạng thái runtime từ DB, Event, Snapshot tới UI (`validating`, `waiting`, `acquiring_lock`, `preparing`, `starting`, `running`, `stopping`, `stopped`, `locked`, `crashed`, `error`).
3. **Snapshot Contract & Reconcile**: Bổ sung `browserSessionId`, `sequence`, `state: ProfileRuntimeState`, `occurredAt` vào `ProfileRuntimeSnapshot`.
4. **Hydration Race Condition**: Hook `useProfiles.ts` áp dụng cơ chế lọc `sequence` cũ out-of-order.
5. **Bảo toàn Dữ liệu Migration v3**: Viết lại Migration v3 di tản dữ liệu từ bảng `profiles` cũ sang `profiles_cache` mới để không làm thất thoát các gán proxy (`profile_proxy_assignments`).
6. **Kiểm tra `PRAGMA foreign_key_check`**: Thực thi `db.prepare('PRAGMA foreign_key_check').all()`, throw `MigrationIntegrityError` và rollback nếu phát hiện bất kỳ ràng buộc khóa ngoại nào bị vi phạm.
7. **Tách biệt Mô hình Trình duyệt (Browser Taxonomy)**: Tách riêng 4 thuộc tính: `engine` (chromium/firefox/webkit), `distribution` (chromium/chrome/edge/brave/firefox/custom), `channel` (stable/beta/dev/canary/custom), và `browser_version`.
8. **Tách biệt Vòng đời Xóa (`deletion_state`)**: Thêm cột `deletion_state` (`active`, `pending_delete`, `trashed`, `purge_pending`, `purged`) thay vì dùng chồng lấn với `sync_status`.
9. **UI Form Tạo Profile**: Thiết kế lại giao diện Form theo đúng mockup yêu cầu: Radio chọn Browser family (Chromium / Firefox / WebKit disabled), Select chọn Distribution, Channel, và Version.

---

## 2. Kết quả Kiểm thử & Biên dịch

*   `pnpm run typecheck`: **0 errors** (Kiểm tra kiểu dữ liệu TypeScript thành công tuyệt đối).
*   `pnpm run build`: Electron-Vite build bundle sản xuất thành công 100%.
*   Đã viết bộ Unit test cho `ProfileStorageResolver` kiểm tra bảo mật path traversal.
