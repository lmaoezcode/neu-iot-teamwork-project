# Kiểm thử máy chủ và cơ sở dữ liệu

Giai đoạn 14–15 có kiểm thử tự động cho:

- băm/xác minh mật khẩu bằng `scrypt`;
- kiểm tra chặt tải tin MQTT, giới hạn 2.048 byte và cấm trường `ppm`;
- cửa sổ phát lại SSE;
- xác thực phiên, cookie và CSRF;
- kiểm tra cấu hình nguyên tử;
- vòng đời lệnh `pending → commands/result` và cấu hình ghép.
- migration có checksum, WAL, khóa ngoại và kiểm tra toàn vẹn SQLite;
- lưu bền snapshot, chống trùng, tổng hợp mẫu một phút và mở lại tiến trình;
- giao dịch nguyên tử giữa lệnh/cấu hình với MQTT outbox;
- phục hồi outbox và phiên đăng nhập sau khi khởi động lại;
- chỉ lưu digest phiên, không lưu cookie token rõ;
- retention bảo vệ lệnh chờ, cảnh báo đang hoạt động và cấu hình hiện hành;
- đọc đồng thời trong WAL và sao lưu/khôi phục nhất quán.

Chạy bằng `pnpm --filter super-iot-server test` sau khi cài phụ thuộc. Hiện có 22 kiểm thử trong 6 file, trong đó 9 kiểm thử chuyên biệt cho SQLite. Đây là kiểm thử phần mềm trên dữ liệu tạm, không phải kết quả phần cứng hoặc ca chấp nhận đầu-cuối `KTxx`.
