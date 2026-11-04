# LẬP TRÌNH ARDUINO UNO — PHIÊN BẢN 1.0

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Tên tài liệu | Lập trình Arduino UNO |
| Phiên bản | 1.0 |
| Trạng thái | **ĐÃ DUYỆT — 26/09/2026** |
| Giai đoạn | Giai đoạn 11 — Lập trình Arduino UNO |
| Ngày cập nhật | 26/09/2026 |
| Đường cơ sở đầu vào | Đặc tả/Ma trận/Danh mục 1.2, Kiến trúc/UML 1.1, Phần cứng 1.0, Giao thức UNO–ESP32 1.0 và Cấu trúc dự án 1.0 |

Tài liệu này mô tả phần mã đã tạo trong `firmware/uno`. Kết quả kiểm tra trên máy phát triển và biên dịch đích được ghi tách biệt với thử nghiệm trên mạch thật. Chưa có kiểm thử phần cứng nào được coi là đạt.

## 2. Phạm vi hiện thực

Firmware UNO thực hiện các trách nhiệm cục bộ sau:

- đọc LDR tại A0, MQ-2 tại A1, cảm biến lửa tại D4 và SRF04 tại D2/D7;
- điều khiển LED đèn D6, LED quạt mô phỏng D9, LED khóa mô phỏng D5, LED cảnh báo D12, LED nhịp D13 và còi có điều kiện tại D3;
- nhận nút Tắt tiếng cục bộ tại D8 với `INPUT_PULLUP` và khử dội không chặn;
- tự động hóa đèn bằng hai ngưỡng, vùng trễ và thời gian giữ 10 giây;
- quản lý hồ sơ Ở nhà/Ra ngoài/Ban đêm, phương thức Tự động/Thủ công, khóa mô phỏng và nhiều nguyên nhân cảnh báo;
- giao tiếp với ESP32 qua UART phần mềm D10/D11 ở `19200 8N1`, COBS và CRC-16/CCITT-FALSE;
- tiếp tục cảm nhận, cảnh báo và tự động hóa cục bộ khi không có phiên ESP32.

Không có mã điều khiển servo, động cơ hoặc relay. Firmware không dùng Wi-Fi, MQTT, HTTP, cơ sở dữ liệu hoặc JSON động trên UNO.

## 3. Tổ chức mã nguồn

| File | Trách nhiệm |
|---|---|
| `firmware/uno/src/main.cpp` | Điểm vào Arduino `setup/loop`, chỉ chuyển cho bộ điều phối. |
| `firmware/uno/include/domain.hpp` | Enum, mã thông điệp, mã lý do và cấu trúc miền có kích thước cố định. |
| `firmware/uno/include/protocol.hpp`, `src/protocol.cpp` | CRC, COBS, đóng/mở khung nhị phân; không cấp phát động. |
| `firmware/uno/include/sensors.hpp`, `src/sensors.cpp` | Lịch lấy mẫu, chuẩn hóa, xác nhận nhiều mẫu và SRF04 không chặn. |
| `firmware/uno/include/app.hpp`, `src/app.cpp` | Máy trạng thái, ưu tiên, hàng đợi, phiên, ACK/NACK, snapshot và đầu ra. |
| `firmware/uno/platformio.ini` | Board UNO, chuẩn C++17 và cờ an toàn mặc định. |
| `tools/uno_protocol_host_test.cpp` | Kiểm thử vector CRC/COBS/khung đầy đủ trên máy phát triển. |
| `tools/uno_app_host_test.cpp` | Mô phỏng phần mềm luồng phiên, cấu hình, snapshot, lệnh và ACK/NACK. |

Mọi bộ đệm đều có kích thước cố định. Hàng đợi báo cáo có 4 phần tử, cache giao dịch có 4 phần tử và danh sách nguyên nhân cảnh báo có tối đa 6 phần tử. Không dùng `String`, `new`, `malloc` hoặc `delay()`.

## 4. Cấu hình biên dịch an toàn

`platformio.ini` mặc định đặt:

| Cờ | Mặc định | Ý nghĩa |
|---|---:|---|
| `SMARTROOM_ENABLE_MQ2` | `0` | Không tuyên bố MQ-2 khả dụng trước G5-PWR-02/04 và G5-SEN-01. Mã đọc/chuẩn hóa vẫn được hiện thực. |
| `SMARTROOM_ENABLE_FLAME_SENSOR` | `0` | Không tuyên bố cảm biến lửa khả dụng trước G5-SEN-02. |
| `SMARTROOM_FLAME_ACTIVE_LOW` | `1` | Giá trị biên dịch dự phòng; chỉ có hiệu lực khi cảm biến lửa được bật sau khi đo cực tính. |
| `SMARTROOM_ENABLE_BUZZER` | `0` | Không kích D3 trước G5-ACT-01 và ngân sách nguồn đạt. LED D12 vẫn là cảnh báo cục bộ bắt buộc. |

Việc đổi ba cờ `ENABLE` sang `1` không phải là kết quả kiểm thử. Chỉ được đổi sau khi người dùng cung cấp số đo/cực tính tương ứng và tài liệu Giai đoạn 5 được cập nhật bằng bằng chứng.

## 5. Lịch cảm biến và chất lượng dữ liệu

| Nhánh | Chu kỳ/điều kiện trong mã | Xử lý |
|---|---|---|
| LDR | 2 giây | Đọc ADC, chuẩn hóa 0–100% theo hai mốc tối/sáng; không gán lux. |
| MQ-2 | 200 ms | ADC thô và phần trăm tương đối; ba mẫu liên tiếp để vào/ra cảnh báo; không quy đổi ppm. |
| Cảm biến lửa | 200 ms | Ba mẫu liên tiếp theo cực tính đã đo; khi chưa bật cờ thì báo lỗi cảm biến, không báo lửa. |
| SRF04 | 100 ms | Xung kích không chặn, ECHO bằng ngắt D2, timeout 25 ms; 1–10 mẫu liên tiếp theo cấu hình vùng. |

MQ-2 có trạng thái làm nóng runtime mặc định 60 giây sau khi UNO khởi động. Đây chỉ là khóa tạm thời của firmware, không thay thế điều kiện hóa ban đầu và hiệu chỉnh thật nêu trong thiết kế phần cứng. MQ-2 chỉ chuyển sang dữ liệu hợp lệ khi đồng thời: cờ biên dịch bật, hết thời gian runtime, cấu hình hiệu chỉnh hợp lệ và cờ hiệu chỉnh được đặt.

Lỗi MQ-2, lửa hoặc vùng cửa tạo nguyên nhân loại Hệ thống/Suy giảm riêng; không được biểu diễn thành phát hiện khí, lửa hoặc xâm nhập.

## 6. Điều khiển và tự động hóa cục bộ

### 6.1. Đèn và quạt mô phỏng

- Ở Tự động, đèn bật khi mức sáng nhỏ hơn hoặc bằng ngưỡng bật, tắt khi lớn hơn hoặc bằng ngưỡng tắt và giữ đầu ra ít nhất 10 giây.
- Khi ánh sáng không hợp lệ, đèn do Tự động điều khiển được giữ tối đa 30 giây rồi tắt; đèn Thủ công không bị tắt chỉ bởi lỗi LDR.
- Quạt chỉ là LED/trạng thái mô phỏng và chỉ nhận lệnh Thủ công trong phiên bản 1.2; không có quy tắc nhiệt độ.
- Lệnh trực tiếp khi đang Tự động phải có xác nhận, yêu cầu chuyển Thủ công và phiên bản cấu hình mới.
- Ra ngoài cưỡng chế tắt đèn/quạt và từ chối lệnh tiện nghi.

### 6.2. Hồ sơ phòng và khóa mô phỏng

- Ra ngoài: tắt tải tiện nghi, đặt khóa mô phỏng về Khóa và trang bị vùng SRF04 nếu đã hiệu chỉnh.
- Ban đêm: đặt khóa mô phỏng về Khóa và trang bị vùng chu vi; không có cảm biến chuyển động nội bộ trong phạm vi 1.2.
- Ở nhà: bỏ trang bị vùng; không tự mở khóa và không khôi phục đầu ra Thủ công đã bị Ra ngoài cưỡng chế tắt.
- Mở khóa trong Ra ngoài/Ban đêm phải có xác nhận và chuyển nguyên tử về Ở nhà.
- Cảnh báo an ninh còn nguyên nhân chặn mở; cảnh báo an toàn cho phép mở mô phỏng khi chủ phòng xác nhận.

D5 sáng biểu diễn lệnh logic `KHOA`; đây không phải xác minh cơ khí. Trong khoảng reset/chưa khởi tạo, đầu ra phần cứng ở trạng thái an toàn; sau khi `begin()` hoàn tất, firmware đặt trạng thái logic Khóa và cập nhật LED mô phỏng.

## 7. Vòng đời cảnh báo

Mỗi nguyên nhân lưu mã, loại, mức độ, nguồn, lý do và trạng thái còn/hết. Nguyên nhân mới đưa vòng đời về `DANG_KEU`, kể cả khi cảnh báo trước đã tắt tiếng. Khi mọi nguyên nhân hết, trạng thái chuyển `CHO_XAC_NHAN`; chỉ lệnh Xác nhận hợp lệ mới đưa về Bình thường.

Nút D8 và lệnh mạng chỉ Tắt tiếng, không xóa nguyên nhân. LED D12 hoạt động cho mọi cảnh báo logic. D3 chỉ hoạt động khi `SMARTROOM_ENABLE_BUZZER=1`; vì mặc định bằng 0, tên trạng thái `DANG_KEU` hiện không phải bằng chứng đã có âm thanh vật lý.

## 8. Liên kết, phiên và đồng bộ

1. Trước phiên, UNO chỉ chấp nhận `HELLO_REQUEST` hợp lệ và trả `HELLO`.
2. `SESSION_START` cấp `session_id`; UNO trả `SESSION_ACCEPT` và chuyển sang trạng thái đồng bộ.
3. Trong đồng bộ, UNO cho phép cấu hình, poll và snapshot nhưng từ chối `CONTROL_SET` với `SESSION_NOT_READY`.
4. `SYNC_COMPLETE` chỉ được chấp nhận khi phiên bản cấu hình/trạng thái khớp và snapshot không đổi do thay đổi nghiệp vụ.
5. Sau đó lệnh điều khiển mới được phép. Mọi lệnh có phiên bản, mã tương quan, ACK/NACK và cache chống thực hiện lặp.

Khung có giới hạn 60 byte sau giải mã, 42 byte payload và 62 byte trên dây kể cả delimiter. Báo cáo/sự kiện chờ ACK được giữ nguyên byte để gửi lại. ESP32 vẫn là phía chủ poll; UNO không tự phát khung ngoài cửa sổ do ESP32 mở.

Khi mất ESP32/Internet, trạng thái cấu hình hợp lệ đang ở RAM tiếp tục chạy. UNO reset luôn bắt đầu với đèn/quạt tắt, khóa mô phỏng ở Khóa, chưa chạy tự động cho đến khi nhận lại cấu hình hợp lệ và có dữ liệu LDR hợp lệ.

## 9. Đối chiếu chức năng và kiểm thử

| Nhóm mã | Phần firmware UNO | Ca kiểm thử liên quan |
|---|---|---|
| MT-02, MT-03, TD-02 | LDR, chất lượng, vùng trễ, ân hạn lỗi | KT02, KT06, KT07, KT11, KT14, KT15, KT21, KT36 |
| DK-02, CD-01, CD-02 | Lệnh thiết bị, phương thức, hồ sơ và ưu tiên | KT03, KT04, KT09, KT10, KT11, KT39 |
| CH-01 | Kiểm tra cấu hình nguyên tử/phiên bản | KT07, KT08 |
| AN-05, AN-06 | Vùng SRF04 và khóa mô phỏng | KT09, KT10, KT12, KT24, KT30, KT31, KT38, KT39 |
| AT-01, AT-02, CB-01 | MQ-2, lửa, nhiều nguyên nhân, tắt tiếng/xác nhận | KT12, KT13, KT25–KT31 |
| MN-01 | Phiên UART, chống lặp, snapshot, ACK/NACK | KT14–KT18 |
| UD-01, DL-01, BC-01 | Cung cấp trạng thái đã xác nhận, mã sự kiện và mẫu nguồn cho các tầng trên | KT15, KT19, KT20, KT21, KT30, KT36, KT38 |

Các mã KT trên vẫn mang kết quả `CHƯA THỰC HIỆN` trong ma trận 1.2. Kiểm tra host của codec không thay thế kiểm thử tích hợp hay kiểm thử phần cứng.

## 10. Cổng kiểm tra Giai đoạn 11

| Mã | Nội dung | Tiêu chí | Trạng thái |
|---|---|---|---|
| G11-SRC-01 | Cấu trúc và ranh giới nguồn | Có domain/protocol/sensors/app; không phụ thuộc mạng/JSON động; không có khối mã nháp trùng | ĐẠT — kiểm tra tĩnh 26/09/2026 |
| G11-SYN-01 | Kiểm tra cú pháp C++17 toàn bộ nguồn | `main/protocol/sensors/app` qua `g++ -Wall -Wextra -Werror -fsyntax-only` với stub Arduino tối thiểu | ĐẠT — 26/09/2026 |
| G11-PROTO-01 | Vector codec trên host | CRC `0x29B1`, COBS, khung `HELLO_REQUEST`/CRC `0xD285`, payload 42 nhận và 43 từ chối | ĐẠT — chương trình host trả mã 0 ngày 26/09/2026 |
| G11-FLOW-01 | Luồng ứng dụng trên host | Khởi động an toàn; HELLO/session/config/snapshot/sync; chuyển Thủ công + bật đèn; retry trả đúng ACK; Ra ngoài cưỡng chế tắt và từ chối bật | ĐẠT — mô phỏng host trả mã 0 ngày 26/09/2026 |
| G11-NBLK-01 | Không chặn vòng lặp | Không dùng `delay()`; SRF04/lịch cảm biến/nút dựa trên thời gian và ngắt | ĐẠT — kiểm tra tĩnh 26/09/2026 |
| G11-SAFE-01 | Trạng thái/cờ an toàn mặc định | Tải tắt khi khởi động; MQ-2/lửa/còi chưa qua cổng vật lý đều mặc định vô hiệu hóa | ĐẠT — kiểm tra tĩnh 26/09/2026 |
| G11-TRACE-01 | Truy vết phạm vi hiện hành | Các chức năng nhóm A có vai trò UNO đều có mô-đun và ca KT liên quan; không hồi sinh servo/motor/relay | ĐẠT — kiểm tra tĩnh 26/09/2026 |
| G11-AVR-01 | Biên dịch đúng toolchain Arduino UNO | PlatformIO `env:uno` hoàn tất không lỗi | ĐẠT — PlatformIO Atmel AVR 5.3.0, toolchain AVR 1.70300; build ngày 26/09/2026 |
| G11-RAM-01 | Kiểm tra tài nguyên ATmega328P | Flash/RAM nằm trong giới hạn và còn biên stack phù hợp | ĐẠT Ở MỨC BUILD — flash 16.730/32.256 byte (51,9%), biến tĩnh RAM 1.088/2.048 byte (53,1%); stack runtime chưa đo |
| G11-HW-01 | Nạp/chạy trên UNO | Khởi động an toàn, LED/nút/cảm biến đúng chân và không reset bất thường | CHƯA THỰC HIỆN — chờ lắp/đo ở Giai đoạn 19 |
| G11-LINK-01 | Tích hợp UART thật với ESP32 | 19200 8N1 ổn định cùng SRF04/cảm biến/LED; retry/ACK đúng | CHƯA THỰC HIỆN — firmware hai phía đã có, chờ đấu mạch qua cổng G5 |

Kiểm tra cú pháp và luồng dùng stub chỉ xác nhận cấu trúc ngôn ngữ, codec và máy trạng thái trong mô phỏng phần mềm. Build đích xác nhận thư viện/khả năng liên kết và kích thước tĩnh, nhưng không xác nhận timing ISR, biên stack động hoặc hành vi điện thật.

## 11. Quy trình build và thử lại

Khi PlatformIO khả dụng:

```powershell
pio run -d firmware/uno -e uno
```

Sau build phải lưu phiên bản toolchain, dung lượng flash/RAM và log lỗi/cảnh báo. Chỉ sau khi G5-PWR/G5-LVL/G5-SEN tương ứng đạt mới nạp bản bật nhánh vật lý. Thứ tự bật đề xuất: LDR/SRF04/LED → UART chuyển mức → cảm biến lửa → MQ-2 → còi.

## 12. Giới hạn và điểm còn mở

- Chưa đo rail USB, chuyển mức UART, ADC LDR/MQ-2, cực tính lửa hoặc dòng còi; tất cả cổng G5 vẫn `CHƯA THỰC HIỆN`.
- Thời gian runtime MQ-2 60 giây, ngưỡng/hiệu chỉnh, cực tính lửa và số mẫu vùng chỉ là thiết kế/mặc định; phải xác minh bằng phần cứng thật.
- Firmware ESP32 đã được tạo ở Giai đoạn 12 nhưng chưa có kiểm thử UART trên hai board, vì vậy phiên/retry/snapshot/phục hồi đầu-cuối vẫn `CHƯA THỰC HIỆN`.
- Không có kết quả thực nghiệm, ảnh mạch hay ca KT nào được đánh dấu ĐẠT ở giai đoạn này.

## 13. Lịch sử sửa đổi và điểm duyệt

| Phiên bản | Trạng thái | Nội dung | Lý do/ảnh hưởng |
|---|---|---|---|
| 1.0 | **ĐÃ DUYỆT — 26/09/2026** | Tạo firmware UNO theo pinout/giao thức đã khóa; thêm cảm biến không chặn, tự động đèn, trạng thái phòng, khóa/quạt mô phỏng, cảnh báo nhiều nguyên nhân và kiểm thử codec/luồng ứng dụng trên host; bổ sung khai báo Arduino cho `setup/loop` và chuyển xử lý ACK sau kiểm tra phiên/sequence khi build-tích hợp Giai đoạn 12 | Đầu ra Giai đoạn 11; hai chỉnh sửa là sửa lỗi triển khai, không thay đổi giao thức dây hoặc phạm vi phần cứng 1.2 |

**TRẠNG THÁI KHÓA:** Firmware Arduino UNO 1.0 đã được người dùng duyệt ngày 26/09/2026 làm đầu vào Giai đoạn 12. Kiểm tra host và build AVR đã đạt; đo điện, nạp board và kiểm thử phần cứng vẫn chưa thực hiện nên không được suy diễn là sản phẩm đã chạy thật.
