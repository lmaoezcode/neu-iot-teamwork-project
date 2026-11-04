# Bộ kiểm thử liên thành phần

Nơi đặt fixture và kiểm thử tự động cho giao thức, MQTT, cơ sở dữ liệu, API, SSE, giao diện và mô phỏng mất mạng. Mã `KTxx` và `Gx-*` không được tái sử dụng cho hành vi khác.

## Tích hợp Giai đoạn 17

- `integration/simulated-device.mjs`: thiết bị **MÔ PHỎNG** hợp đồng MQTT của ESP32/UNO; không phải bằng chứng phần cứng.
- `integration/stage17-software-chain.mjs`: chạy Mosquitto loopback, server, SQLite, Vite proxy, HTTP/CSRF, SSE, lệnh ACK, desired/reported, payload sai schema, state cũ, chống trùng, 3 chu kỳ broker reconnect/outbox replay và server restart.
- `integration/fixtures/stage17-redaction-*.fixture`: mẫu giả an toàn để xác minh công cụ che credential, cookie, URL MQTT, MAC, IP và private key marker.
- `integration/fixtures/ports-*.fixture.json`: snapshot COM giả cho ánh xạ UNO/ESP32 đúng một cổng và trường hợp mơ hồ; không phải dữ liệu board thật.

Chạy từ gốc dự án:

```powershell
pnpm check:stage17
pnpm test:hardware-tooling
pnpm integration:stage17
```

`test:hardware-tooling` dùng fixture, thư mục tạm và `-WhatIf`; nó kiểm tra snapshot COM, ánh xạ một cổng mới, dải nguồn, nhánh dừng, trường hợp COM mơ hồ, bảo đảm xem trước serial không tạo log và đối chiếu chính xác đầu ra che dữ liệu nhạy cảm. Bài test không mở cổng serial, không nạp board và không tạo bằng chứng phần cứng.

Runner cần Mosquitto portable đã chuẩn bị ở Giai đoạn 13 và hiện đạt **15/15** điểm xác nhận. Biên bản runtime nằm tại `data/logs/stage17-software-integration.json` và bị loại khỏi quản lý mã nguồn. Kết quả không thay thế các ca `KTxx` hoặc cổng board/UART thật.

## Hồi quy chịu lỗi

- `server/test/command-timeout.test.ts`: lệnh hết hạn chuyển `pending → unknown`, không sửa trạng thái thiết bị và vẫn hòa giải được kết quả đến muộn.
- `server/test/mqtt-fuzz.test.ts`: 1.000 payload byte tùy ý, tối đa 512 đột biến telemetry một byte và các topic gần đúng/traversal/device ngoài miền.
- `server/test/reconnect-soak.test.ts`: 25 chu kỳ offline/online ở lớp dịch vụ, version tăng đơn điệu và đúng một desired retained cho mỗi version.
- `web/test-resilience/command-timeout-render.test.ts`: UI hiển thị `unknown`/đang đồng bộ và không báo thành công giả.

Chạy `pnpm test:resilience`; bộ chuyên biệt hiện đạt **6/6**. Các test dùng đồng hồ/transport/DOM giả; riêng 3 chu kỳ broker thật nằm trong runner G17. Tất cả đều là bằng chứng phần mềm.

## Bản đồ chuẩn bị Giai đoạn 18

`config/stage18-test-readiness.json` ánh xạ đủ 32 ca đang áp dụng tới kiểm thử tự động hiện có và bằng chứng còn thiếu. Chạy `pnpm check:stage18-readiness` để xác nhận bản đồ; lệnh này không thi hành hoặc đổi kết quả chấp nhận.

`acceptance/stage18-software-preflight.mjs` tái chạy phần mềm cho KT19–KT21 và ghi biên bản runtime có nhãn tiền kiểm. Chạy bằng `pnpm preflight:stage18`; `PREFLIGHT_PASS` không đồng nghĩa `ĐẠT` trong Ma trận 1.2.
