# Kiểm thử firmware UNO

Firmware có hai lớp kiểm tra:

1. `tools/uno_protocol_host_test.cpp` kiểm tra CRC-16/CCITT-FALSE, COBS, vector khung `HELLO_REQUEST`, biên payload 42/43 byte, mọi tiền tố bị cắt, delimiter sai vị trí và mọi khung thử bị lật một bit trên máy phát triển.
2. `tools/uno_app_host_test.cpp` mô phỏng khởi động an toàn, bắt tay, phiên, cấu hình, snapshot, đồng bộ, ACK gửi lại và ràng buộc Ra ngoài.
3. `tools/check-stage11.mjs` kiểm tra tĩnh cấu trúc mô-đun, cờ an toàn, không dùng `delay()`, ranh giới UNO và truy vết chức năng.

Hai kiểm thử host đã chạy thành công ngày 26/09/2026; riêng codec host mở rộng đã được biên dịch/chạy lại thành công ngày 29/09/2026. Kiểm tra cú pháp toàn bộ nguồn cũng đã chạy bằng `g++ -Wall -Wextra -Werror -fsyntax-only` với các stub Arduino tối thiểu trong `tools/host-stubs`.

Hai kết quả trên không thay thế:

- build PlatformIO/AVR và báo cáo flash/RAM;
- kiểm thử máy trạng thái bằng fixture đầy đủ;
- nạp firmware lên UNO;
- các cổng điện, cảm biến, UART và tải G5/G6;
- các ca KT trong ma trận 1.2.

Các hạng mục đó vẫn là `CHƯA THỰC HIỆN` cho đến khi có log hoặc bằng chứng thật. Xem `docs/13-lap-trinh-arduino-uno-v1.0.md`.
