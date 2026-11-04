# DANH MỤC MÃ HÌNH CẦN HÌNH THẬT — V1.0

## 1. Mục đích và quy ước

Mỗi hình thật cần cho bằng chứng được ghi bằng **một mã hình duy nhất**. Cho tới khi có hình thật, tài liệu dùng hình giữ chỗ (placeholder) mang đúng mã đó.

- Mã dạng `HINH-<NHÓM>-<MỤC>-<SỐ>`. Nhóm `G17` lấy từ `docs/19a-phieu-bang-chung-phan-cung.md`; nhóm `KT` lấy từ `docs/02-ma-tran-kiem-thu-v1.2.md`.
- Hình giữ chỗ: `docs/figures/<mã>.placeholder.svg`. Hình thật: `docs/figures/<mã>.jpg` (hoặc `.png`), cùng tên mã.
- Khi có hình thật: lưu file theo tên mã, đổi cột trạng thái thành `ĐÃ CÓ HÌNH`, rồi điền đường dẫn vào cột ảnh của phiếu `19a`. Không xóa placeholder cho tới khi hình thật đã được đối chiếu.
- Không chụp lộ mật khẩu, SSID, nội dung `secrets.hpp`, `server.local.env`, cookie hoặc token.
- Hình giữ chỗ **không phải bằng chứng**. Không cổng nào được ghi `ĐẠT` chỉ vì có placeholder.
- Hình chụp từ giao diện mô phỏng chỉ là bằng chứng phần mềm mô phỏng, không phải bằng chứng phần cứng.
- Video trong ma trận KT là hạng mục riêng, chưa nằm trong danh mục này.

## 2. Danh mục

| Mã hình | Nội dung cần chụp | Nguồn yêu cầu | Người tạo | Hình giữ chỗ | Hình thật (đường dẫn đích) | Trạng thái |
|---|---|---|---|---|---|---|
| `HINH-G17-ID-01` | Arduino UNO, mặt trên và nhãn chân | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-01.placeholder.svg` | `docs/figures/HINH-G17-ID-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-ID-02` | ESP32, mặt trên và nhãn GPIO16/GPIO17/GND/5V | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-02.placeholder.svg` | `docs/figures/HINH-G17-ID-02.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-ID-03` | Transistor C1815 nhìn rõ mã và hướng mặt phẳng | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-03.placeholder.svg` | `docs/figures/HINH-G17-ID-03.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-ID-04` | Điện trở của bộ chia áp 2 kΩ/3 kΩ | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-04.placeholder.svg` | `docs/figures/HINH-G17-ID-04.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-ID-05` | Hai tầng nâng mức, chưa nối GPIO đích | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-05.placeholder.svg` | `docs/figures/HINH-G17-ID-05.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-ID-06` | Toàn cảnh breadboard khi chưa cấp nguồn | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-06.placeholder.svg` | `docs/figures/HINH-G17-ID-06.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-ID-07` | Servo/motor/relay để rời | docs/19a §2 | Người dùng chụp | `docs/figures/HINH-G17-ID-07.placeholder.svg` | `docs/figures/HINH-G17-ID-07.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-PWR-01` | Đồng hồ đo 5V–GND của UNO (G17-HW-PWR-01A) | docs/19a §4 | Người dùng chụp | `docs/figures/HINH-G17-PWR-01.placeholder.svg` | `docs/figures/HINH-G17-PWR-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-PWR-02` | Đồng hồ đo 5V/VIN–GND của ESP32 (G17-HW-PWR-01B) | docs/19a §4 | Người dùng chụp | `docs/figures/HINH-G17-PWR-02.placeholder.svg` | `docs/figures/HINH-G17-PWR-02.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-PWR-03` | Đồng hồ đo chênh lệch GND–GND hai board (G17-HW-PWR-01C) | docs/19a §4 | Người dùng chụp | `docs/figures/HINH-G17-PWR-03.placeholder.svg` | `docs/figures/HINH-G17-PWR-03.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-LVL-01` | Đồng hồ đo RX_3V–GND tại D11 (G17-HW-LVL-01) | docs/19a §4 | Người dùng chụp | `docs/figures/HINH-G17-LVL-01.placeholder.svg` | `docs/figures/HINH-G17-LVL-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-LVL-02` | Đồng hồ đo đầu ra nâng mức tại D10, TX LOW và HIGH (G17-HW-LVL-02L/02H) | docs/19a §4 | Người dùng chụp | `docs/figures/HINH-G17-LVL-02.placeholder.svg` | `docs/figures/HINH-G17-LVL-02.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-E2E-01` | LED D6 trước lệnh bật | docs/19a §6 | Người dùng chụp | `docs/figures/HINH-G17-E2E-01.placeholder.svg` | `docs/figures/HINH-G17-E2E-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-G17-E2E-02` | LED D6 sau lệnh bật (đã ACK) | docs/19a §6 | Người dùng chụp | `docs/figures/HINH-G17-E2E-02.placeholder.svg` | `docs/figures/HINH-G17-E2E-02.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT03-01` | Hai LED đèn/quạt và giao diện có nhãn mô phỏng khi điều khiển Thủ công | docs/02 KT03 | Người dùng chụp | `docs/figures/HINH-KT03-01.placeholder.svg` | `docs/figures/HINH-KT03-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT06-01` | Đèn bật/tắt theo vùng trễ ánh sáng | docs/02 KT06 | Người dùng chụp | `docs/figures/HINH-KT06-01.placeholder.svg` | `docs/figures/HINH-KT06-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT14-01` | Giao diện báo Ngoại tuyến/Dữ liệu cũ khi mất Wi-Fi/MQTT | docs/02 KT14 | Chụp từ giao diện mô phỏng (Claude có thể làm) | `docs/figures/HINH-KT14-01.placeholder.svg` | `docs/figures/HINH-KT14-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT15-01` | Biểu đồ ánh sáng có khoảng trống sau khi nối lại | docs/02 KT15 | Chụp từ giao diện mô phỏng (Claude có thể làm) | `docs/figures/HINH-KT15-01.placeholder.svg` | `docs/figures/HINH-KT15-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT19-01` | Giao diện/phản hồi khi chưa đăng nhập bị chặn | docs/02 KT19 | Chụp từ giao diện mô phỏng (Claude có thể làm) | `docs/figures/HINH-KT19-01.placeholder.svg` | `docs/figures/HINH-KT19-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT24-01` | Giao diện và LED khóa mô phỏng khi mở khóa trong báo động | docs/02 KT24 | Người dùng chụp | `docs/figures/HINH-KT24-01.placeholder.svg` | `docs/figures/HINH-KT24-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT25-01` | Giao diện MQ-2: làm nóng, ADC và mức 0–100% (không ppm) | docs/02 KT25 | Người dùng chụp | `docs/figures/HINH-KT25-01.placeholder.svg` | `docs/figures/HINH-KT25-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT36-01` | Trang Tổng quan hiển thị mức sáng đầu-cuối | docs/02 KT36 | Chụp từ giao diện mô phỏng (Claude có thể làm) | `docs/figures/HINH-KT36-01.placeholder.svg` | `docs/figures/HINH-KT36-01.jpg` | `CHƯA CÓ HÌNH` |
| `HINH-KT39-01` | Giao diện khóa/mở có nhãn mô phỏng | docs/02 KT39 | Chụp từ giao diện mô phỏng (Claude có thể làm) | `docs/figures/HINH-KT39-01.placeholder.svg` | `docs/figures/HINH-KT39-01.jpg` | `CHƯA CÓ HÌNH` |

## 3. Ảnh chụp từ giao diện mô phỏng (không phải hình thật)

Bốn hình sau chụp từ bản demo MÔ PHỎNG (thiết bị giả `tests/integration/simulated-device.mjs`, trình duyệt headless). Chúng minh họa giao diện, **không** thay thế hình thật trong mục 2 và không phải bằng chứng phần cứng. Trạng thái trong mục 2 vẫn là `CHƯA CÓ HÌNH`.

| Mã hình | File ảnh mô phỏng | Ghi chú |
|---|---|---|
| `HINH-KT19-01` | `docs/figures/HINH-KT19-01.sim.png` | Trang đăng nhập khi chưa có phiên. Chưa thể hiện phản hồi HTTP chặn. |
| `HINH-KT36-01` | `docs/figures/HINH-KT36-01.sim.png` | Trang Tổng quan với mức sáng từ thiết bị giả. MQ-2 và cảm biến lửa báo lỗi vì thiết bị giả không gửi dữ liệu đó. Nhãn đèn "PHẦN CỨNG THẬT" do thiết bị giả khai báo, không phải phần cứng thật. |
| `HINH-KT39-01` | `docs/figures/HINH-KT39-01.sim.png` | Trang Điều khiển, nhãn "MÔ PHỎNG" ở khóa và quạt. |
| `HINH-KT14-01` | `docs/figures/HINH-KT14-01.sim.png` | Hiện "Dữ liệu cũ · 47 giây trước" sau khi tắt broker. Đây là mất broker phía máy chủ, không phải mất Wi-Fi thiết bị thật; thanh trên cùng vẫn ghi "Trực tuyến". |

`HINH-KT15-01` chưa chụp được: demo chưa tạo khoảng trống dữ liệu đủ dài để biểu đồ thể hiện khoảng trống ngoại tuyến.
