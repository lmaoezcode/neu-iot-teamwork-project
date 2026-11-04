# Vận hành máy chủ cục bộ

## Chuẩn bị

1. Chạy `pnpm install` ở thư mục gốc.
2. Khởi tạo broker và tài khoản theo `infrastructure/mqtt/README.md`.
3. Chạy `Initialize-Server.ps1`; công cụ hỏi kín mật khẩu chủ phòng và mật khẩu MQTT của tài khoản `smartroom-backend`, sau đó tạo `config/server.local.env`.
4. Chạy `Start-Server.ps1`.

`config/server.local.env` chứa bí mật, bị loại khỏi quản lý mã nguồn và không được chụp/đưa vào báo cáo. Máy chủ từ chối khởi động nếu còn giá trị mẫu, thiếu mã băm mật khẩu hoặc bí mật phiên ngắn.

Ở Giai đoạn 14, repository đang là bộ nhớ tạm để kiểm thử API/MQTT. Dữ liệu mất khi tiến trình dừng; không dùng bản này để tuyên bố lịch sử 30 ngày hoặc cấu hình bền vững. SQLite ở Giai đoạn 15 sẽ thay implementation mà không đổi hợp đồng API.
