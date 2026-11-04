# KIỂM THỬ FIRMWARE ESP32

Các kiểm tra không cần board nằm trong `tools/`:

- `esp32_protocol_host_test.cpp`: vector CRC/COBS/khung dùng chung, payload cấu hình/điều khiển và từ chối mọi tiền tố bị cắt, delimiter sai vị trí hoặc khung thử bị lật một bit;
- `check-stage12.mjs`: cấu trúc nguồn, topic, QoS/retain, bí mật, NVS, LittleFS và các cổng an toàn.

Build đích bằng PlatformIO và kiểm tra dung lượng đã đạt ngày 26/09/2026; codec host mở rộng đã được biên dịch/chạy lại thành công ngày 29/09/2026. Các kiểm tra cần board/broker vẫn để `CHƯA THỰC HIỆN`: nạp/chạy board, đo heap/stack khi chạy, UART với UNO, Wi-Fi/MQTT, LWT, ACL, NVS qua reset và hàng đợi LittleFS qua mất điện.
