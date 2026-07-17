3. Quy trình trước khi sửa code

Trước khi code:

Đọc cấu trúc repository.
Đọc package.json, workspace config và TypeScript config.
Tìm implementation hiện có trước khi tạo mới.
Xác định rõ luồng dữ liệu và dependency.
Kiểm tra thay đổi đang tồn tại trong Git.
Không ghi đè thay đổi không liên quan.
Không đoán API, schema, dependency hoặc version.
Nếu yêu cầu chưa rõ và có thể làm sai kiến trúc, phải hỏi lại.

Luôn sửa ít nhất có thể nhưng phải giải quyết tận gốc vấn đề.

4. Nguyên tắc code
Viết code ngắn gọn, rõ nghĩa và trực tiếp.
Mỗi function chỉ thực hiện một trách nhiệm.
Ưu tiên early return.
Tránh nested condition quá sâu.
Không dùng magic number hoặc magic string.
Không copy-paste logic.
Không tạo abstraction khi chưa có nhu cầu thực tế.
Không tạo class, interface hoặc wrapper thừa.
Không viết comment để giải thích code khó hiểu; hãy viết lại code cho dễ hiểu.
Chỉ comment về lý do hoặc constraint không thể hiện được bằng code.
Không giữ dead code hoặc code đã comment.
Không dùng tên viết tắt khó hiểu.
Tên biến, function và file phải thể hiện đúng trách nhiệm.
Không để file quá lớn; tách theo domain và trách nhiệm.
Ưu tiên composition thay vì inheritance.
Dependency phải đi theo một chiều rõ ràng.
Không để business logic nằm trong controller hoặc UI component.
5. TypeScript

Bắt buộc:

{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}

Quy tắc:

Không dùng any.
Không dùng @ts-ignore.
Chỉ dùng unknown khi dữ liệu chưa được kiểm chứng.
Validate dữ liệu runtime trước khi ép kiểu.
Không dùng type assertion để che lỗi.
Ưu tiên union type thay cho boolean khó hiểu.
Dùng exhaustive checking cho state quan trọng.
Tách DTO, domain model và database model.
Shared contract đặt trong packages/shared.
Không import code nội bộ xuyên package bằng relative path.
Public API của package phải export qua entry point.

Ví dụ state:

type ProfileStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';
6. Dependency và package
Không cài dependency mới nếu thư viện hiện tại đã giải quyết được.
Trước khi cài phải kiểm tra package hiện có.
Không dùng hai thư viện cho cùng một nhiệm vụ.
Không import toàn bộ package nếu có thể import phần cần dùng.
Không dùng dependency không được bảo trì hoặc có lỗ hổng nghiêm trọng.
Không tự ý nâng major version.
Native dependency phải tương thích Electron ABI.
Mỗi package chỉ export API cần thiết.
Không tạo circular dependency.

Dependency direction:

renderer
    -> preload contract
    -> Electron main
    -> application services
    -> repositories/adapters
    -> SQLite, filesystem, Playwright, Cloud API

Không cho phép:

renderer -> Node.js
renderer -> filesystem
renderer -> SQLite
renderer -> Playwright
renderer -> ipcRenderer trực tiếp
cloud-api -> fingerprint-injector
shared -> application implementation
7. Electron

Renderer chỉ chịu trách nhiệm giao diện.

Renderer không được truy cập:

Node.js
filesystem
database
child process
Playwright
Electron IPC trực tiếp
secret hoặc credential

BrowserWindow bắt buộc:

webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: preloadPath,
}

Preload:

Chỉ expose API tối thiểu qua contextBridge.
Không expose ipcRenderer.
Không cho renderer truyền tên IPC channel tùy ý.
Mỗi API phải có input và output type rõ ràng.
Phải có chức năng unsubscribe event.
Không trả stack trace hoặc thông tin nhạy cảm cho renderer.

IPC handler:

Dùng danh sách channel cố định.
Validate toàn bộ input.
Kiểm tra quyền truy cập.
Kiểm tra ownership của resource.
Giới hạn kích thước payload.
Chuẩn hóa error trả về.
Không thực thi path, URL hoặc command chưa kiểm tra.
Không dùng eval, shell string hoặc dynamic code execution.
8. React
Dùng function component.
Component chỉ xử lý UI và tương tác người dùng.
Business logic đặt trong feature service hoặc hook.
Không tạo component quá lớn.
Không đặt mọi thứ vào global state.
Không lưu derived state nếu có thể tính từ state gốc.
Không dùng useEffect cho dữ liệu có thể xử lý bằng event hoặc query.
Mỗi effect phải có cleanup nếu đăng ký listener hoặc timer.
Không tạo callback/memoization nếu không có lợi ích đo được.
Không gọi IPC trực tiếp trong component.
Không dùng index làm key cho danh sách thay đổi.
Dialog và form phải xử lý loading, error và disabled state.
Mọi thao tác nguy hiểm phải yêu cầu xác nhận.
Giữ accessibility của shadcn/ui và Radix UI.

Cấu trúc feature:

features/profiles/
├── api/
├── components/
├── hooks/
├── schemas/
├── types/
└── utils/
9. State management

Zustand chỉ dùng cho client state:

UI state
dialog state
selected rows
sidebar state
theme
temporary preferences

TanStack Query dùng cho:

Cloud API data
SQLite data lấy qua IPC
asynchronous state
mutation
caching
invalidation
background refresh

Không lưu cùng một dữ liệu trong cả Zustand và TanStack Query.

Query key phải được quản lý tập trung:

export const profileKeys = {
  all: ['profiles'] as const,
  lists: () => [...profileKeys.all, 'list'] as const,
  list: (filters: ProfileFilters) =>
    [...profileKeys.lists(), filters] as const,
  detail: (id: string) =>
    [...profileKeys.all, 'detail', id] as const,
};
10. Backend NestJS

Controller chỉ:

Nhận request.
Validate DTO.
Gọi application service.
Trả response.

Service xử lý use case.

Repository xử lý database.

Không đặt query database trực tiếp trong controller.

Bắt buộc:

Validation toàn bộ input.
Authentication.
Authorization.
Rate limiting cho endpoint nhạy cảm.
Timeout cho external request.
Transaction cho thao tác nhiều bước.
Pagination cho danh sách.
Structured logging.
Không trả database entity trực tiếp.
Không trả password hash, token, secret hoặc internal error.
Idempotency cho thao tác có thể gửi lại.
Audit log cho thao tác quan trọng.
11. Database
Mọi thay đổi schema phải có migration.
Không sửa migration đã chạy production.
Query phải parameterized.
Không nối chuỗi tạo SQL.
Dùng transaction cho thao tác cần tính toàn vẹn.
Tạo index dựa trên query thực tế.
Không dùng SELECT * trong query quan trọng.
Có pagination cho bảng lớn.
Không thực hiện N+1 query.
Không lưu file browser lớn trong SQLite.
SQLite chỉ lưu metadata và trạng thái cần thiết.
Credential nhạy cảm phải mã hóa.
Backup trước migration có rủi ro.
Migration phải có chiến lược rollback hoặc recovery.
12. Launcher và browser process

Launcher chạy trong Electron main process hoặc utility process.

Launcher phải:

Validate profile.
Kiểm tra license và permission.
Kiểm tra profile lock.
Chuẩn bị userDataDir.
Khởi chạy browser.
Theo dõi process.
Gửi trạng thái về renderer.
Ghi log.
Dọn tài nguyên khi browser đóng.
Phục hồi trạng thái khi app crash.

Không cho hai process ghi cùng một profile directory.

State hợp lệ:

stopped -> starting -> running -> stopping -> stopped
                     -> error

Không chuyển state tùy ý.

Không log:

Cookie
Token
Proxy password
Authorization header
Session data
Encryption key
13. Bảo mật
Validate mọi dữ liệu đi qua trust boundary.
Không tin renderer, client hoặc dữ liệu cloud.
Áp dụng nguyên tắc least privilege.
Không hard-code secret.
Secret chỉ lấy từ environment hoặc secure storage.
Token desktop lưu bằng secure storage của hệ điều hành.
Password phải hash bằng thuật toán phù hợp.
Credential phải được che trong UI và log.
Không mở URL tùy ý bằng system browser.
Chỉ cho phép protocol và domain hợp lệ.
Chống path traversal.
Không giải nén file chưa kiểm tra path.
Kiểm tra MIME type, extension và dung lượng upload.
Không sử dụng shell command nếu có API trực tiếp.
Nếu bắt buộc dùng process execution, truyền argument array; không nối shell string.
Auto-update phải kiểm tra chữ ký.
Production build không bật DevTools mặc định.
Không để source map chứa secret.
Không gửi telemetry khi chưa có sự đồng ý.
14. Error handling
Không nuốt lỗi.
Không dùng catch {} rỗng.
Phân biệt lỗi người dùng, lỗi hệ thống và lỗi tạm thời.
Error phải có code ổn định.
UI hiển thị thông báo dễ hiểu.
Log giữ đủ context để debug nhưng không chứa dữ liệu nhạy cảm.
Không trả raw error hoặc stack trace cho client.
External call phải có timeout.
Chỉ retry lỗi tạm thời.
Retry phải có giới hạn và backoff.
Không retry thao tác không idempotent một cách mù quáng.

Ví dụ:

type AppErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_ALREADY_RUNNING'
  | 'PROXY_CONNECTION_FAILED'
  | 'LICENSE_LIMIT_REACHED'
  | 'DATABASE_ERROR';
15. Hiệu năng
Đo trước khi tối ưu.
Không load toàn bộ bảng lớn vào memory.
Dùng pagination hoặc virtualization cho Profile Table.
Không block Electron main process bằng tác vụ CPU nặng.
Tác vụ CPU nặng phải chuyển sang worker hoặc utility process.
Batch database writes khi phù hợp.
Debounce search.
Hủy request không còn cần thiết.
Lazy-load route hoặc feature lớn.
Tránh re-render không cần thiết.
Không đọc/ghi file đồng bộ trong luồng nóng.
Giới hạn số browser chạy đồng thời.
Dọn event listener, timer, process và temporary file.
16. Testing

Mọi thay đổi phải có mức kiểm thử tương xứng.

Bắt buộc kiểm tra:

Typecheck.
Lint.
Unit test.
Integration test cho database và IPC.
Build package bị ảnh hưởng.
E2E cho luồng quan trọng khi cần.

Ưu tiên test:

Business rule.
Validation.
State transition.
Permission.
Database transaction.
IPC contract.
Launch/stop lifecycle.
Error recovery.

Không viết test chỉ để tăng coverage.

17. Cách thực hiện thay đổi

Khi nhận task:

Tóm tắt mục tiêu.
Xác định file và package bị ảnh hưởng.
Tìm code liên quan.
Chọn giải pháp đơn giản nhất.
Thực hiện minimal diff.
Thêm hoặc cập nhật test.
Chạy kiểm tra.
Xem lại security và performance.
Báo rõ kết quả và phần chưa xác minh.

Không:

Refactor phần không liên quan.
Đổi format toàn repository.
Đổi tên hàng loạt không cần thiết.
Xóa code khi chưa xác định usage.
Che lỗi bằng fallback giả.
Tạo mock trong production code.
Báo hoàn thành khi chưa chạy kiểm tra.
18. Chuẩn đầu ra

Khi trả lời:

Tập trung vào kết quả.
Không emoji.
Không văn phong quảng cáo.
Không giải thích dài dòng.
Không lặp lại yêu cầu.
Nêu rõ file đã sửa.
Nêu rõ kiểm tra đã chạy.
Nêu rõ lỗi hoặc giới hạn còn lại.
Không tuyên bố thành công nếu build hoặc test chưa chạy.
Không tạo tài liệu thừa nếu người dùng không yêu cầu.

Mẫu:

Đã thực hiện:
- ...
- ...

Kiểm tra:
- pnpm typecheck: pass
- pnpm test: pass
- pnpm build: pass

Còn lại:
- Không có.
19. Definition of Done

Task chỉ hoàn thành khi:

Đúng yêu cầu.
Không phá kiến trúc.
Không có lỗi TypeScript.
Không có lỗi lint.
Test liên quan chạy thành công.
Build package bị ảnh hưởng thành công.
Input được validate.
Không lộ secret.
Không tạo dependency thừa.
Không có dead code.
Không có thay đổi ngoài phạm vi.
Code đủ rõ để người khác tiếp tục sửa mà không cần giải thích riêng.
Quy tắc bắt buộc khi viết giao diện React:

1. Không sử dụng Tailwind utility class trong JSX.
2. Không viết JSX kiểu:
   className="flex h-full items-center justify-center..."
3. JSX chỉ được dùng class semantic, ngắn gọn và mô tả đúng vai trò:
   className="auth-loading"
   className="auth-loading__spinner"
   className="auth-loading__message"
4. Toàn bộ layout, màu sắc, spacing, animation, responsive và state phải đặt trong file CSS riêng.
5. Sử dụng CSS variables từ design tokens; không hard-code màu nếu đã có token.
6. Áp dụng BEM hoặc CSS Modules nhất quán.
7. Mỗi component import đúng một file style tương ứng.
8. Không dùng inline style, CSS-in-JS, styled-components hoặc chuỗi utility class.
9. Không dùng @apply để giấu Tailwind utility trong CSS.
10. Ưu tiên CSS thuần dễ đọc, dễ tìm kiếm và dễ bảo trì.