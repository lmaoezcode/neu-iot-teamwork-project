# HƯỚNG DẪN CHỤP ẢNH VÀ ĐO CHO NGƯỜI MỚI — V1.0

Tài liệu này giúp người mới thu thập bằng chứng cho lượt phần cứng tối thiểu (Giai đoạn 17). Nó không thay thế `docs/19a-phieu-bang-chung-phan-cung.md`; nó giải thích cách làm. Mã hình lấy từ `docs/21-danh-muc-ma-hinh-v1.0.md`.

## 1. Nguyên tắc chung

- Làm đúng thứ tự dưới đây. Dừng lại và hỏi nếu có số đo ngoài dải.
- Mỗi board dùng một nguồn USB riêng. Không nối hai rail 5 V với nhau.
- Chưa nối MQ-2, cảm biến lửa, còi, servo, motor, relay trong lượt này.
- Ảnh phải rõ chữ in trên linh kiện, không lóa. Chụp ngang, đủ sáng, cách khoảng 15–25 cm.
- Không chụp lộ mật khẩu, SSID, `secrets.hpp`, `server.local.env`, cookie hoặc token.
- Lưu ảnh theo đúng tên mã, ví dụ `docs/figures/HINH-G17-ID-01.jpg`.
- Ghi giá trị đo thật, không làm tròn thành giá trị mong đợi. Không tự ghi `ĐẠT`.

## 2. Bước A — Ảnh trước khi cấp nguồn (chưa cắm USB)

| Mã hình | Chụp gì | Chú ý |
|---|---|---|
| `HINH-G17-ID-01` | Arduino UNO, mặt trên | Đọc rõ nhãn chân, đặc biệt D10, D11 |
| `HINH-G17-ID-02` | ESP32, mặt trên | Rõ nhãn GPIO16, GPIO17, GND, 5V |
| `HINH-G17-ID-03` | Transistor C1815 | Thấy rõ mã in và hướng mặt phẳng |
| `HINH-G17-ID-04` | Điện trở bộ chia áp 2 kΩ/3 kΩ | Thấy rõ vạch màu hoặc ghi giá trị |
| `HINH-G17-ID-05` | Hai tầng nâng mức | Chưa nối vào GPIO đích |
| `HINH-G17-ID-06` | Toàn cảnh breadboard | Chưa cấp nguồn |
| `HINH-G17-ID-07` | Servo/motor/relay | Để rời, không nối |

## 3. Bước B — Đo nguồn và mức logic (đồng hồ vạn năng, thang DC)

1. Đặt đồng hồ ở thang DC phù hợp (ví dụ 20 V). Que đỏ vào chân dương, que đen vào GND.
2. Làm từng phép đo trong bảng, chụp màn hình đồng hồ cùng que đo đang chạm đúng chân.

| Phép đo (mã phiếu) | Chụp ảnh | Dải chấp nhận |
|---|---|---|
| UNO cấp USB riêng, 5V–GND (`G17-HW-PWR-01A`) | `HINH-G17-PWR-01` | 4,75–5,25 V |
| ESP32 cấp USB riêng, 5V/VIN–GND (`G17-HW-PWR-01B`) | `HINH-G17-PWR-02` | 4,75–5,25 V |
| Hai board cùng cấp USB, chưa nối tín hiệu, GND–GND (`G17-HW-PWR-01C`) | `HINH-G17-PWR-03` | ≤ 0,1 V |
| UNO D11 idle HIGH qua chia áp, nút RX_3V–GND (`G17-HW-LVL-01`) | `HINH-G17-LVL-01` | 2,7–3,4 V |
| Đầu ra nâng mức tại UNO D10 khi ESP32 TX LOW (`G17-HW-LVL-02L`) | `HINH-G17-LVL-02` | ≤ 0,4 V |
| Đầu ra nâng mức tại UNO D10 khi ESP32 TX HIGH/idle (`G17-HW-LVL-02H`) | `HINH-G17-LVL-02` | ≥ 3,0 V và ≤ 5,25 V |

Nếu có giá trị ngoài dải: **rút USB, dừng lại, không nối GPIO đích**, rồi hỏi.

## 4. Bước C — Cổng COM và firmware

Thực hiện theo `docs/19a` §3 và `infrastructure/firmware/README.md`. Xác định cổng COM bằng cách lưu snapshot khi chưa cắm board, rồi cắm riêng từng board và so sánh bằng `Get-BoardPorts.ps1`. Chỉ nạp firmware khi đã được Quang cho phép rõ ràng.

## 5. Bước D — Lệnh đầu–cuối bật LED D6

1. Chụp `HINH-G17-E2E-01`: LED D6 đang tắt.
2. Trên giao diện web, gửi lệnh bật đèn. Ghi `command_id`.
3. Giao diện chỉ được hiện `applied` sau khi có ACK.
4. Chụp `HINH-G17-E2E-02`: LED D6 đang sáng.
5. Ghi trạng thái API trước và sau ACK vào phiếu 19a §6.

## 6. Sau khi chụp

1. Đặt file vào `docs/figures/` theo đúng tên mã (`.jpg` hoặc `.png`).
2. Đổi cột trạng thái trong `docs/21` thành `ĐÃ CÓ HÌNH`.
3. Điền giá trị đo vào phiếu `docs/19a`. Để trống phần kết luận §8; việc đối chiếu làm sau.
4. Kiểm tra mọi ảnh không lộ thông tin bí mật trước khi gửi đi.
