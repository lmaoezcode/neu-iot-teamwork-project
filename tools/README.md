# Công cụ dự án

Nơi đặt công cụ kiểm tra khung COBS/CRC, mô phỏng firmware, tạo bản tin MQTT, nạp dữ liệu mô phỏng, kiểm tra schema và tạo báo cáo. Công cụ phải gắn nhãn `MÔ PHỎNG` khi không dùng phần cứng thật.

- `check-stage10.mjs`: kiểm tra cây dự án và đường cơ sở Giai đoạn 10.
- `check-stage11.mjs`: kiểm tra cấu trúc, cờ an toàn, ranh giới và truy vết firmware UNO.
- `check-stage12.mjs`: kiểm tra cấu trúc, truy vết, UART chủ, MQTT, NVS và hàng đợi ngoại tuyến của firmware ESP32.
- `check-stage13.mjs`: kiểm tra cấu hình Mosquitto, ACL, bảo vệ bí mật, script vận hành và truy vết Thiết kế MQTT 1.0.
- `check-stage14.mjs`: kiểm tra cây máy chủ, API/SSE, MQTT, xác thực, repository tạm, kiểm thử, CR-03 và truy vết 16 chức năng nhóm A.
- `check-stage15.mjs`: kiểm tra lược đồ SQLite, migration/checksum, repository bền vững, inbox/outbox, retention, backup, phiên, công cụ vận hành, kiểm thử và truy vết Giai đoạn 15.
- `check-stage16.mjs`: kiểm tra tám tuyến web, API/CSRF, SSE, trạng thái lệnh, cấu hình, biểu đồ có khoảng trống, cảnh báo/CR-04, responsive, khả năng tiếp cận, nhãn mô phỏng và truy vết Giai đoạn 16.
- `check-stage17.mjs`: đối chiếu manifest tương thích với firmware, MQTT schema/topic/ACL, server, web, runner tích hợp/chịu lỗi, công cụ board/log, phiếu đo và ranh giới bằng chứng phần cứng Giai đoạn 17.
- `check-stage18-readiness.mjs`: kiểm tra bản đồ chuẩn bị sớm đủ 32 ca KT, phân nhóm phần mềm/phần cứng/điều kiện, đường dẫn bao phủ và bảo đảm không cập nhật kết quả khi G17 còn mở.
- `uno_protocol_host_test.cpp`: vector giao thức độc lập phần cứng, biên payload và từ chối mọi tiền tố khung bị cắt/delimiter sai/khung thử hỏng một bit.
- `uno_app_host_test.cpp`: mô phỏng luồng ứng dụng UNO qua UART giả lập.
- `esp32_protocol_host_test.cpp`: vector CRC/COBS, payload cấu hình/điều khiển và từ chối mọi tiền tố khung bị cắt/delimiter sai/khung thử hỏng một bit.
- `host-stubs/`: bề mặt Arduino tối thiểu chỉ dùng cho kiểm tra host; không được đưa vào build firmware đích.

Môi trường PlatformIO cục bộ trong `.pio-venv/` và kho gói trong `.pio-core/` chỉ phục vụ tái tạo build, đều bị loại khỏi Git. Không lưu thông tin Wi-Fi/MQTT thật trong thư mục công cụ.

Công cụ nhận diện COM, build/upload có xác nhận và che log cho lượt phần cứng G17 nằm trong `infrastructure/firmware/`; chúng không tự đánh dấu cổng phần cứng đạt.

Bản Mosquitto portable dùng xác minh Giai đoạn 13 nằm trong `tools/.mosquitto/`; bộ cài tải tạm nằm trong `tools/.downloads/`. Cả hai bị loại khỏi quản lý mã nguồn và không phải thành phần phải phân phối cùng mã dự án.
