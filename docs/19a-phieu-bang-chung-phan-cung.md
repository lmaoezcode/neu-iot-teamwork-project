# PHIẾU BẰNG CHỨNG PHẦN CỨNG — GIAI ĐOẠN 17

## 1. Trạng thái phiếu

| Thuộc tính | Giá trị |
|---|---|
| Trạng thái | `CHƯA THỰC HIỆN` |
| Phạm vi | Lượt tối thiểu: hai board, nguồn USB riêng, chuyển mức UART và LED đèn D6 |
| Không thuộc lượt này | MQ-2, cảm biến lửa, còi, servo, motor và relay |
| Nguyên tắc | Người dùng đo/chụp; GPT đối chiếu và cập nhật theo bằng chứng |

Không điền mật khẩu, SSID, nội dung `secrets.hpp`, `server.local.env`, cookie hoặc token vào phiếu.

## 2. Nhận dạng và ảnh trước cấp nguồn

| Mục | Giá trị/đường dẫn ảnh | Đã đối chiếu |
|---|---|---|
| Arduino UNO, mặt trên và nhãn chân | `HINH-G17-ID-01` (hình thật: `docs/figures/HINH-G17-ID-01.jpg`; hiện là placeholder) | ☐ |
| ESP32, mặt trên và nhãn GPIO16/GPIO17/GND/5V | `HINH-G17-ID-02` (hình thật: `docs/figures/HINH-G17-ID-02.jpg`; hiện là placeholder) | ☐ |
| C1815 nhìn rõ mã và hướng mặt phẳng | `HINH-G17-ID-03` (hình thật: `docs/figures/HINH-G17-ID-03.jpg`; hiện là placeholder) | ☐ |
| Điện trở của bộ chia 2 kΩ/3 kΩ | `HINH-G17-ID-04` (hình thật: `docs/figures/HINH-G17-ID-04.jpg`; hiện là placeholder) | ☐ |
| Hai tầng nâng mức, chưa nối GPIO đích | `HINH-G17-ID-05` (hình thật: `docs/figures/HINH-G17-ID-05.jpg`; hiện là placeholder) | ☐ |
| Toàn cảnh breadboard khi chưa cấp nguồn | `HINH-G17-ID-06` (hình thật: `docs/figures/HINH-G17-ID-06.jpg`; hiện là placeholder) | ☐ |
| Servo/motor/relay để rời | `HINH-G17-ID-07` (hình thật: `docs/figures/HINH-G17-ID-07.jpg`; hiện là placeholder) | ☐ |

## 3. Cổng COM và firmware

| Board | Cổng COM | Môi trường PlatformIO | Kết quả build | Kết quả nạp | Log boot đã che |
|---|---|---|---|---|---|
| UNO |  | `uno` | `CHƯA THỰC HIỆN` | `CHƯA THỰC HIỆN` |  |
| ESP32 |  | `esp32dev` | `CHƯA THỰC HIỆN` | `CHƯA THỰC HIỆN` |  |

Xác định cổng bằng cách lưu snapshot khi chưa cắm board, sau đó cắm riêng từng board và dùng `Get-BoardPorts.ps1 -CompareSnapshot ...`. Ghi đúng cổng `Mới xuất hiện`; không dùng mô tả CH340 làm bằng chứng duy nhất.

Sau khi có ảnh và ba số đo nguồn, dùng `Record-HardwareCheckpoint1.ps1` để tạo `checkpoint1-user-report.json`. Biên bản chỉ kiểm tra đúng một cổng mới và dải số học; nó phải giữ `review_status=PENDING_GPT_REVIEW`, không tự quyết định cổng đạt.

## 4. Phép đo nguồn và mức logic

Đồng hồ đặt thang DC phù hợp. Ghi giá trị thật, không làm tròn thành giá trị mong đợi.

| Mã | Điều kiện đo | Giá trị đo | Tiêu chí | Kết quả |
|---|---|---:|---|---|
| G17-HW-PWR-01A | UNO cấp USB riêng, 5V–GND |  V | 4,75–5,25 V | `CHƯA THỰC HIỆN` |
| G17-HW-PWR-01B | ESP32 cấp USB riêng, 5V/VIN–GND |  V | 4,75–5,25 V | `CHƯA THỰC HIỆN` |
| G17-HW-PWR-01C | Hai board cùng cấp USB, chưa nối tín hiệu, GND–GND |  V | ≤0,1 V | `CHƯA THỰC HIỆN` |
| G17-HW-LVL-01 | UNO D11 idle HIGH qua chia áp, nút RX_3V–GND |  V | 2,7–3,4 V | `CHƯA THỰC HIỆN` |
| G17-HW-LVL-02L | Đầu ra nâng mức tại UNO D10 khi ESP32 TX LOW |  V | ≤0,4 V | `CHƯA THỰC HIỆN` |
| G17-HW-LVL-02H | Đầu ra nâng mức tại UNO D10 khi ESP32 TX HIGH/idle |  V | ≥3,0 V và ≤5,25 V | `CHƯA THỰC HIỆN` |

Mã hình cho ảnh đồng hồ đo: PWR-01A → `HINH-G17-PWR-01`, PWR-01B → `HINH-G17-PWR-02`, PWR-01C → `HINH-G17-PWR-03`, LVL-01 → `HINH-G17-LVL-01`, LVL-02L/02H → `HINH-G17-LVL-02` (xem `docs/21-danh-muc-ma-hinh-v1.0.md`).

Nếu bất kỳ giá trị nào ngoài dải, ngắt USB và không nối GPIO đích.

## 5. Quan sát boot và UART

| Cổng | Quan sát cần ghi | Giá trị/log | Kết quả |
|---|---|---|---|
| G17-HW-UNO-01 | LED khởi động tắt an toàn, không reset/nóng; ghi USB 115200 nếu có và đối chiếu `uno_boot_id` sau handshake |  | `CHƯA THỰC HIỆN` |
| G17-HW-ESP-01 | NVS, LittleFS, heap/reset reason; không lộ credential |  | `CHƯA THỰC HIỆN` |
| G17-HW-UART-01A | Handshake/session thành công ở 19200 8N1 |  | `CHƯA THỰC HIỆN` |
| G17-HW-UART-01B | `uart_crc_errors` trước/sau lượt thử |  /  | `CHƯA THỰC HIỆN` |
| G17-HW-UART-01C | `uart_frame_errors` trước/sau lượt thử |  /  | `CHƯA THỰC HIỆN` |

Firmware UNO hiện không bảo đảm in dòng boot qua USB. Nếu monitor im lặng, ghi đúng “USB log im lặng”; không tự coi là đạt. Bằng chứng boot bổ sung bắt buộc là `uno_boot_id` xuất hiện qua ESP32/MQTT sau khi UART handshake, cùng quan sát LED an toàn và không reset/nóng.

Có thể dùng `Capture-SerialLog.ps1 -Port COMx -DurationSeconds 60 -WhatIf` rồi bỏ `-WhatIf` sau khi xác nhận đúng cổng. Mở serial có thể reset board; log thô phải qua công cụ che trước khi gửi.

## 6. Wi-Fi/MQTT và lệnh đầu-cuối

| Mục | Giá trị/đường dẫn minh chứng |
|---|---|
| Thời điểm ESP32 online |  |
| Client ID (không ghi mật khẩu) | `smartroom-room-01-device` |
| Availability/state/config retained quan sát được |  |
| `command_id` của lệnh bật LED D6 |  |
| Trạng thái API ban đầu |  |
| Trạng thái API sau ACK |  |
| Ảnh/video LED D6 trước và sau lệnh | `HINH-G17-E2E-01` (trước), `HINH-G17-E2E-02` (sau); hiện là placeholder |
| Log broker/server/ESP32/UNO đã che |  |

Tiêu chí: giao diện chỉ chuyển `applied` sau ACK; LED D6 khớp `state/reported`; không có reset hoặc lỗi CRC/frame tăng.

## 7. Xác nhận an toàn cuối lượt

- [ ] Hai rail 5 V không nối nhau.
- [ ] Mỗi board chỉ dùng một nguồn USB.
- [ ] GND chung chỉ được nối sau khi đo chênh lệch.
- [ ] MQ-2, flame và còi vẫn chưa nối/bị vô hiệu hóa.
- [ ] Servo, motor và relay vẫn để rời.
- [ ] Bản log gửi đi đã qua công cụ che và kiểm tra thủ công.
- [ ] Không có cổng nào được tự ghi `ĐẠT` nếu thiếu số đo/ảnh/log.

## 8. Kết luận của GPT sau khi nhận bằng chứng

Phần này để trống cho đến khi GPT đối chiếu từng minh chứng.

| Cổng | Quyết định | Căn cứ | Việc cần thử lại |
|---|---|---|---|
| G17-HW-ID-01 |  |  |  |
| G17-HW-PWR-01 |  |  |  |
| G17-HW-LVL-01 |  |  |  |
| G17-HW-LVL-02 |  |  |  |
| G17-HW-UNO-01 |  |  |  |
| G17-HW-ESP-01 |  |  |  |
| G17-HW-UART-01 |  |  |  |
| G17-HW-NET-01 |  |  |  |
| G17-HW-E2E-01 |  |  |  |
