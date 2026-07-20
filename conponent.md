Kiến trúc mới — dùng chung, dễ mở rộng


ProfilesDataTable.tsx

Thêm TableEmptyState — 1 component dùng chung cho tất cả 5 tab. Mỗi tab chỉ truyền { icon, title, description, action? } vào, không cần tạo riêng
Xóa cách cũ render empty state trong <tr><td> — vừa bị giới hạn bởi height: 48px của cell, vừa không thể center thật sự
Empty state giờ render ngoài <table> như một <div> riêng với flex: 1 để lấp đầy phần còn lại sau sticky header → tự động căn giữa hoàn hảo


ProfilesPage.css

.ptable-wrap → đổi thành display: flex; flex-direction: column để empty state có thể dùng flex: 1 fill chiều cao còn lại
Thêm .ptable-empty + các modifier BEM: __icon-wrap, __icon, __title, __desc, __action, __btn — 1 block CSS duy nhất cho mọi trạng thái trống
Cách mở rộng: Muốn thêm tab mới với empty state riêng → chỉ thêm config { icon, title, description } vào profileTabConfigs.ts. Không cần chạm vào component hay CSS.