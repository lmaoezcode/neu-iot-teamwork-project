# DANH MỤC PHẦN CỨNG PHÒNG THÔNG MINH — PHIÊN BẢN 1.1

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 1.1 |
| Trạng thái | **ĐÃ DUYỆT — 26/09/2026** |
| Giai đoạn | Giai đoạn 2 — Kiểm kê phần cứng và đánh giá khả năng đáp ứng |
| Đặc tả nguồn | `docs/01-dac-ta-he-thong-v1.1.md` — đã duyệt ngày 26/09/2026 |
| Phần cứng cơ sở | Bộ BLK UNO R3 và 55+ mạch điện tử cơ bản; ESP32 DevKit V1 30 chân ESP-WROOM-32/4 MB/CH340C/USB Type-C |
| Phạm vi chức năng | 16 chức năng nhóm A, 1 nhóm B và 1 nhóm C |
| Quyết định mua | **Không mua thêm linh kiện**; mọi phương án dùng linh kiện trong kit hoặc thiết bị đã chọn |
| Phân ranh giai đoạn | Giai đoạn 2 khóa danh mục và phạm vi. Giai đoạn 5 mới khóa chân, nguồn, dòng tải, mức logic, driver, diode, tụ và an toàn điện. |

## 2. Mục tiêu và giới hạn Giai đoạn 2

1. Xác định linh kiện phục vụ từng chức năng đang áp dụng dựa trên danh sách nhà bán mà người dùng đã chấp nhận là chính xác.
2. Tách rõ tình trạng sở hữu khỏi cổng xác minh kỹ thuật; một linh kiện có trong kit vẫn có thể phải chờ Giai đoạn 5.
3. Bảo đảm mọi chức năng nhóm A có phần cứng tương ứng hoặc một phương án dùng phần cứng sẵn có.
4. Ghi rõ các linh kiện ngoài kit đã bị loại theo quyết định không mua thêm.
5. Chuyển các câu hỏi về chân, nguồn, mức logic và tải động sang đúng Giai đoạn 5 thay vì kết luận sớm.

Giai đoạn này **không** cấp nguồn thử tải, không kích thích khí/lửa, không gán chân, không vẽ mạch cuối và không viết firmware. Danh sách nhà bán là bằng chứng về cấu hình bộ kit, không phải bằng chứng rằng từng linh kiện đã được kiểm thử điện.

## 3. Quy ước trạng thái

### 3.1. Trạng thái sở hữu/quyết định

| Trạng thái | Ý nghĩa |
|---|---|
| `CÓ_TRONG_KIT` | Có trong cấu hình BLK UNO R3 55+ do nhà bán công bố và được người dùng chấp nhận làm căn cứ chính thức. |
| `ĐÃ_CHỌN_MODEL` | Model/biến thể dùng cho dự án đã được khóa ngoài bộ kit. |
| `TÙY_CHỌN` | Có sẵn nhưng chỉ dùng nếu nhóm A ổn định và còn tài nguyên. |
| `KHÔNG_DÙNG` | Không thuộc phạm vi triển khai 1.1; không mua để bổ sung. |
| `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Phụ kiện hoặc công cụ không có trong danh sách nhà bán; chỉ cần kiểm tra người dùng đang có hay không trước bước vật lý. |

### 3.2. Cổng kỹ thuật

| Cổng | Ý nghĩa |
|---|---|
| `KHÔNG_CÓ_CỔNG` | Giai đoạn 2 không thấy điều kiện kỹ thuật đặc biệt ngoài kiểm tra thông thường ở Giai đoạn 5. |
| `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Chưa được cấp tải; phải tính ngân sách dòng, nhiệt, driver và bảo vệ trước khi sử dụng. |
| `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Phải xác minh điện áp/tín hiệu và biện pháp hạ mức trước khi nối board/module. |
| `CHỜ_GĐ5_XÁC_MINH_MODULE` | Phải đọc nhãn/chân/cực tính đúng module và tra tài liệu phù hợp trước khi thiết kế. |

Hai cột trạng thái độc lập. Ví dụ, servo vừa là `CÓ_TRONG_KIT` vừa là `CHỜ_GĐ5_XÁC_MINH_NGUỒN`; điều này không có nghĩa servo bị loại.

## 4. Căn cứ kiểm kê

### 4.1. Nguồn cấu hình bộ kit

- [Bộ KIT Học Tập BLK UNO R3 Và 55+ Mạch Điện Tử Cơ Bản](https://banlinhkien.com/bo-kit-hoc-tap-blk-uno-r3-va-55-mach-dien-tu-co-ban-p38422156.html).
- Ngày đối chiếu trong dự án: 25/09/2026.
- Theo chỉ định của người dùng, danh sách nhà bán được coi là chính xác cho việc lập danh mục; chỉ yêu cầu ảnh khi hàng thực tế khác danh sách, cần đọc nhãn chân/model hoặc cần chẩn đoán lỗi.

Các hạng mục liên quan trực tiếp được liệt kê gồm:

- UNO R3 CH340G, breadboard MB-102, dây cắm, điện trở 220 Ω/330 Ω/1 kΩ/10 kΩ, tụ và diode 1N4007;
- quang trở CDS 5 mm 5537, cảm biến siêu âm SRF04, MQ-2, cảm biến lửa và cảm biến âm thanh;
- servo SG90, động cơ mini 3–6 V, LED, còi 5 V và relay mini 1 kênh 5 V/10 A;
- transistor C1815/A1015, MOSFET IRF3205/IRF4905;
- adapter 12 V/1 A, module AMS1117 5,0 V, jack/dây nguồn.

Trang không liệt kê DHT11/DHT22, cảm biến cửa/công tắc từ, SW-420, bàn phím 4×4, RTC, cáp USB hoặc mạch chuyển mức chuyên dụng. Theo quyết định phạm vi, các module cảm biến thiếu không được mua; mạch hạ mức UNO→ESP32 sẽ dùng điện trở có trong kit nếu tính toán và đo kiểm ở Giai đoạn 5 cho phép.

### 4.2. Ảnh và kiểm tra vật lý khi nào mới cần

- Không cần ảnh để duyệt danh mục Giai đoạn 2.
- Trước khi đấu điện, người dùng cần cung cấp ảnh/nhãn nếu model, thứ tự chân hoặc cực tính khác/không rõ.
- Cáp USB và dụng cụ đo chỉ cần xác nhận thực tế trước khi nạp firmware hoặc đo điện.
- Không tạo lửa, khói, khí gas hoặc chạy servo/động cơ trong bước kiểm kê.

## 5. Quyết định phần cứng đã khóa

| Mã quyết định | Nội dung | Lý do/ảnh hưởng |
|---|---|---|
| QD-HW-01 | Dùng bộ **BLK UNO R3 và 55+ mạch điện tử cơ bản** làm bộ cơ sở | Tận dụng phần cứng đã có và danh sách nhà bán được người dùng chấp nhận. |
| QD-HW-02 | Dùng **ESP32 DevKit V1 30 chân, ESP-WROOM-32, flash 4 MB, CH340C, USB Type-C, anten PCB, EN/BOOT, header đã hàn** | Đủ Wi-Fi, MQTT, NVS và UART cho vai trò cổng mạng; không cần biến thể lớn hơn. |
| QD-HW-03 | Không mua thêm linh kiện; DHT, MC-38, SW-420, bàn phím và RTC không thuộc bản triển khai 1.1 | Phạm vi đã chuyển sang LDR, SRF04 và các module thật có trong kit. |
| QD-HW-04 | Chưa khóa cách dùng UART vật lý | ESP32 có UART phù hợp, nhưng UNO chỉ có một UART phần cứng dùng chung với USB; Giai đoạn 5–6 sẽ chọn giữa UART phần cứng có quy trình nạp/log phù hợp hoặc nối tiếp phần mềm sau khi phân bổ chân. |
| QD-HW-05 | UNO TX 5 V không được nối trực tiếp vào ESP32 RX 3,3 V | Dùng bộ chia áp từ điện trở trong kit hoặc phương án tương đương được tính/đo ở Giai đoạn 5. |
| QD-HW-06 | Servo, động cơ và relay được giữ trong thiết kế nhưng chưa cấp tải | Cả ba phải qua `CHỜ_GĐ5_XÁC_MINH_NGUỒN`; nếu phương án nguồn trong kit không an toàn, mở thay đổi phạm vi có kiểm soát thay vì đấu thử. |
| QD-HW-07 | Không sử dụng điện lưới trong mô hình | Relay chỉ được cân nhắc với tải điện áp thấp sau khi xác minh mạch. |

Nguồn tham chiếu cho model ESP32:

- [ESP32 WROOM 32 30-pin DevKit V1 CH340C USB Type-C](https://dientuduchuy.com/products/esp32-wroom-32-30pin-devkitc-v1-ch340c-usb-type-c-wifi-bluetooth) là cấu hình thương mại khớp tiêu chí.
- [Tài liệu ESP32-DevKitC của Espressif](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) là nguồn chính để đối chiếu module, nguồn và pinout khi sang Giai đoạn 5.

Tên nhận diện model: `ESP32 DevKit V1 30 pin ESP-WROOM-32 4 MB CH340C USB Type-C`.

## 6. Bộ điều khiển và kết nối

| ID phần cứng | Linh kiện | Mức | SL | Trạng thái sở hữu/quyết định | Cổng kỹ thuật | Quyết định sử dụng |
|---|---|---|---:|---|---|---|
| HW-CTL-01 | Arduino UNO R3 CH340G | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Bộ điều khiển cảm biến/chấp hành và logic cục bộ. |
| HW-CTL-02 | ESP32 DevKit V1 theo QD-HW-02 | A | 1 | `ĐÃ_CHỌN_MODEL` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Cổng Wi-Fi/MQTT, NVS và đồng bộ. |
| HW-CON-01 | Cáp USB dữ liệu Type-B cho UNO | A | 1 | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | `KHÔNG_CÓ_CỔNG` | Phải truyền dữ liệu, không chỉ cấp nguồn; không lập danh sách mua. |
| HW-CON-02 | Cáp USB dữ liệu Type-C cho ESP32 | A | 1 | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | `KHÔNG_CÓ_CỔNG` | Phải truyền dữ liệu, không chỉ sạc; không lập danh sách mua. |
| HW-CON-03 | Bộ chia áp UNO TX → ESP32 RX | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Lắp từ điện trở kit; giá trị cuối chỉ khóa sau tính/đo. |
| HW-CON-04 | Dây UART và nối đất chung | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Dùng dây cắm trong kit; chân cụ thể khóa ở Giai đoạn 5–6. |

## 7. Cảm biến và thiết bị nhập

| ID phần cứng | Linh kiện | Chức năng | Mức | SL | Trạng thái | Cổng kỹ thuật | Quyết định sử dụng |
|---|---|---|---|---:|---|---|---|
| HW-SEN-01 | Quang trở CDS 5537 + điện trở chia áp | MT-03, MT-02, TD-02 | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Đo mức sáng tương đối 0–100%; cần hiệu chỉnh tối/sáng. |
| HW-SEN-02 | Cảm biến siêu âm SRF04 | AN-05 | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Phát hiện đối tượng tại vùng cửa; không suy ra cửa/chốt cơ khí. |
| HW-SEN-03 | Module MQ-2 | AT-01 | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MODULE` | Dùng ADC/mức tương đối; không tuyên bố ppm; xác minh AO/DO và làm nóng. |
| HW-SEN-04 | Module cảm biến lửa | AT-02 | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Xác minh AO/DO, cực tính, điện áp và điều kiện thử an toàn. |
| HW-SEN-05 | Module cảm biến âm thanh | MR-01 | C | 1 | `TÙY_CHỌN` (`CÓ_TRONG_KIT`) | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Chỉ dùng sau khi nhóm A ổn định; SRF04 không dùng lại cho MR-01. |
| HW-SEN-06 | Nút nhấn | Thử nghiệm/tắt tiếng cục bộ nếu thiết kế | Phụ trợ | ≥ 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Chức năng chân cuối khóa ở Giai đoạn 5. |
| HW-SEN-07 | DHT11/DHT22 | Mã cũ MT-01/TD-01 | Ngoài phạm vi | 0 | `KHÔNG_DÙNG` | `KHÔNG_CÓ_CỔNG` | Không có trong kit, không mua; nhiệt độ/độ ẩm và tự động quạt đã ngừng. |
| HW-SEN-08 | Cảm biến cửa MC-38 | Mã cũ AN-01 | Ngoài phạm vi | 0 | `KHÔNG_DÙNG` | `KHÔNG_CÓ_CỔNG` | Không có trong kit, không mua; không tuyên bố trạng thái cửa/chốt. |
| HW-SEN-09 | Cảm biến rung SW-420 | Mã cũ AN-04 | Ngoài phạm vi | 0 | `KHÔNG_DÙNG` | `KHÔNG_CÓ_CỔNG` | Không có trong kit, không mua. |
| HW-SEN-10 | Bàn phím 4×4 | Mã cũ AN-03 | Ngoài phạm vi | 0 | `KHÔNG_DÙNG` | `KHÔNG_CÓ_CỔNG` | Không có trong kit, không mua. |
| HW-SEN-11 | RTC | Không có chức năng đang áp dụng | Ngoài phạm vi | 0 | `KHÔNG_DÙNG` | `KHÔNG_CÓ_CỔNG` | Dùng thời gian máy chủ/ESP32 khi có mạng; không mua RTC. |

## 8. Cơ cấu chấp hành

| ID phần cứng | Linh kiện | Chức năng | Mức | SL | Trạng thái | Cổng kỹ thuật | Quyết định sử dụng |
|---|---|---|---|---:|---|---|---|
| HW-ACT-01 | Servo SG90 180° | AN-02 | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MODULE` | Giữ chức năng khóa/mở ở mức trạng thái lệnh; chưa xác minh cơ khí. |
| HW-ACT-02 | Động cơ mini 3–6 V mô phỏng quạt | DK-01 | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Chỉ điều khiển Thủ công; phải qua tầng công suất và diode phù hợp. |
| HW-ACT-03 | LED mô hình chiếu sáng + điện trở | DK-01, TD-02 | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Đèn tiện nghi thật của mô hình. |
| HW-ACT-04 | LED cảnh báo riêng + điện trở | CB-01 | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Dùng màu khác LED chiếu sáng. |
| HW-ACT-05 | Còi xung/chíp 5 V | CB-01 | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MODULE` | Chọn loại chủ động/thụ động sau nhận dạng; không mặc định nối trực tiếp I/O. |
| HW-ACT-06 | Relay mini 1 kênh 5 V/10 A | Phương án điều khiển tải thấp áp nếu phù hợp | Phụ trợ | 0–1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Không mặc định dùng; không điều khiển điện lưới. |
| HW-ACT-07 | Mô hình cửa/giá gắn servo từ vật liệu sẵn có | Minh họa AN-02 | Phụ trợ | 0–1 bộ | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Không phải điều kiện để khẳng định trạng thái lệnh; không mua vật liệu chuyên dụng. |

## 9. Nguồn, công suất và bảo vệ

| ID phần cứng | Linh kiện/phương án sẵn có | Mức | Trạng thái | Cổng kỹ thuật | Quyết định Giai đoạn 2 |
|---|---|---|---|---|---|
| HW-PWR-01 | Adapter 12 V/1 A | Ứng viên nguồn | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Chưa được nối vào tải/board trước khi xác minh cực tính, đầu nối và phương án hạ áp. |
| HW-PWR-02 | Module AMS1117 5,0 V | Ứng viên hạ áp | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Không mặc định đủ dòng/nhiệt cho servo + motor + MQ-2; phải tính và đo. |
| HW-PWR-03 | Nguồn USB từ cáp/host hiện có | Ứng viên cấp board | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Chỉ coi là ứng viên; không cấp tải động qua chân I/O. |
| HW-PWR-04 | C1815/A1015, IRF3205/IRF4905 | Ứng viên tầng công suất | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Giai đoạn 5 tra datasheet và chọn phần tử thật sự tương thích; không mặc định MOSFET là logic-level. |
| HW-PWR-05 | Diode 1N4007 | Bảo vệ tải cảm nếu phù hợp | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Xác minh dòng/xung và bố trí trước khi dùng. |
| HW-PWR-06 | Tụ 0,47 µF/47 µF/1000 µF | Lọc/decoupling | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Chọn giá trị/vị trí/cực tính sau tính nguồn. |
| HW-PWR-07 | Relay HW-ACT-06 | Ứng viên đóng/cắt tải | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Chỉ dùng nếu mức kích, dòng cuộn và mục tiêu thấp áp đều phù hợp. |

Không nối servo, động cơ, còi hoặc relay trực tiếp vào chân I/O nếu dòng vượt giới hạn. Không mặc định chân 5 V/3,3 V của UNO/ESP32 đủ cấp tải. Trước khi Giai đoạn 5 hoàn tất, không chạy đồng thời servo, động cơ và MQ-2 từ một đường nguồn chưa được chứng minh.

Nếu không thể chứng minh phương án nguồn an toàn chỉ bằng linh kiện hiện có, dự án phải mở thay đổi phạm vi có kiểm soát cho phần trình diễn tải tương ứng; tuyệt đối không đấu thử để “xem có chạy hay không”.

## 10. Linh kiện lắp ráp và công cụ

| ID phần cứng | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| HW-ASM-01 | Breadboard MB-102 830 lỗ | `CÓ_TRONG_KIT` | Một breadboard; bố trí chi tiết ở Giai đoạn 5. |
| HW-ASM-02 | Dây jumper đực–đực và đực–cái | `CÓ_TRONG_KIT` | Dùng cho tín hiệu/nguồn phù hợp; không suy ra khả năng chịu dòng cao. |
| HW-ASM-03 | Điện trở 220 Ω, 330 Ω, 1 kΩ, 10 kΩ | `CÓ_TRONG_KIT` | Phục vụ LED, LDR và bộ chia áp; giá trị cuối phải tính/đo. |
| HW-ASM-04 | Jack/dây nguồn trong kit | `CÓ_TRONG_KIT` | Xác minh cực tính và đầu nối trước khi cấp nguồn. |
| HW-ASM-05 | Đồng hồ vạn năng | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Cần cho Giai đoạn 5 và lắp ráp an toàn; không nằm trong danh sách mua của dự án. |
| HW-ASM-06 | Băng cách điện/ống co/dụng cụ cố định | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Chỉ xác nhận trước lắp ráp; không dùng thay kết nối điện chắc chắn. |

## 11. Thông tin bắt buộc xác minh trước khi đấu điện

| Module/nhóm | Cần xác minh | Không được suy luận trước |
|---|---|---|
| UNO | Nhãn board, sơ đồ chân, tình trạng cổng và cách tách nạp/log khỏi liên kết ESP32 | Một UART phần cứng có thể đồng thời dùng tự do cho USB log và ESP32. |
| ESP32 | Khớp QD-HW-02 và pinout đúng board 30 chân nhận được | Pinout của board 38 chân/WROVER/C3/S2/S3. |
| UART | Điện áp nhàn rỗi, cực tính, giá trị chia áp, chung đất và chân được phân bổ | UNO TX 5 V an toàn cho ESP32 RX. |
| LDR | Mạch chia áp, chiều tăng/giảm ADC, mốc tối/sáng | 0%/100% trước hiệu chỉnh. |
| SRF04 | Điện áp, TRIG/ECHO, vùng đo, điểm mù và giá trị lỗi | SRF04 chứng minh cửa mở/đóng hoặc chốt khóa. |
| MQ-2 | Mã module, AO/DO, điện áp, dòng sưởi, thời gian làm nóng và ADC nền | ppm, ngưỡng hoặc thời gian làm nóng bằng một giá trị bịa. |
| Cảm biến lửa | AO/DO, cực tính, điện áp và phương pháp thử an toàn | Active-high/active-low hoặc độ nhạy. |
| Servo | Mã/màu dây, điện áp, dòng chạy/kẹt, giới hạn góc và cơ khí | Nguồn board đủ cấp hoặc góc 0–180° luôn an toàn. |
| Động cơ | Điện áp/dòng chạy-kẹt và tầng công suất | Có thể nối trực tiếp board hoặc relay là mặc định tốt nhất. |
| Còi/relay | Chủ động/thụ động, điện áp/dòng, mức kích và diode/opto nếu có | Tương thích trực tiếp 3,3 V/5 V. |
| Nguồn | Điện áp không tải/có tải, dòng, cực tính, nhiệt và sụt áp | Adapter + AMS1117 tự động đủ cho toàn hệ thống. |

## 12. Truy vết phần cứng theo chức năng nhóm A

| Chức năng | Phần cứng tối thiểu | Trạng thái cuối Giai đoạn 2 |
|---|---|---|
| MT-03 | HW-CTL-01, HW-CTL-02, HW-SEN-01, HW-ASM-03 | Có trong kit/đã chọn; chờ Giai đoạn 5 khóa mạch chia áp. |
| MT-02 | HW-SEN-01 và hai board | Có đường tạo/nhận biết lỗi; chi tiết chẩn đoán khóa khi lập trình. |
| DK-01 | HW-ACT-02, HW-ACT-03, HW-PWR-04/05 và phương án nguồn | Có trong kit; động cơ `CHỜ_GĐ5_XÁC_MINH_NGUỒN`. |
| TD-02 | HW-SEN-01, HW-ACT-03 | Có trong kit; đủ cho tự động hóa đèn. |
| CD-01 | Hai board, HW-CON-03/04, HW-ACT-02/03 | Có/đã chọn; quạt Tự động luôn Tắt theo đặc tả. |
| CD-02 | Hai board, HW-SEN-02, HW-ACT-01/02/03/04/05 | Đủ danh mục; tải động chờ Giai đoạn 5. |
| CH-01 | Hai board và NVS của ESP32 | Đã chọn; không cần phần cứng mua thêm. |
| AN-05 | HW-SEN-02, HW-ACT-04, HW-ACT-05 | Có trong kit; SRF04 là cảm biến an ninh bắt buộc. |
| AN-02 | HW-ACT-01 | Có trong kit; trạng thái lệnh, `xac_minh_co_khi=false`, chờ xác minh nguồn/cơ khí. |
| AT-01 | HW-SEN-03, HW-ACT-04, HW-ACT-05 | Có trong kit; chờ xác minh module/nguồn/làm nóng. |
| AT-02 | HW-SEN-04, HW-ACT-04, HW-ACT-05 | Có trong kit; chờ xác minh cực tính và phương pháp thử. |
| CB-01 | HW-ACT-04, HW-ACT-05 và các cảm biến cảnh báo | Có trong kit; mạch lái còi chờ Giai đoạn 5. |
| MN-01 | HW-CTL-01/02, HW-CON-01..04 | Board đã khóa; cáp chờ xác nhận thực tế; UART khóa ở Giai đoạn 5–6. |
| UD-01 | HW-CTL-02 và máy phát triển/mạng hiện có | Không cần module bổ sung. |
| DL-01 | HW-CTL-02 và máy chủ/cơ sở dữ liệu phần mềm | Không cần module bổ sung. |
| BC-01 | Dữ liệu từ HW-SEN-01 qua hệ thống | Không cần module bổ sung. |

## 13. Chức năng nhóm B/C và phần cứng

| Chức năng | Nhóm | Phần cứng | Quyết định |
|---|---|---|---|
| TB-01 — Thông báo trình duyệt | B | Không cần module mới | Giữ nhóm B; triển khai nếu nền tảng web/trình duyệt cho phép. |
| MR-01 — Cảm biến âm thanh hoặc thiết bị phụ | C | HW-SEN-05 hoặc module còn lại trong kit | Giữ tùy chọn; chỉ làm sau nhóm A và không dùng lại SRF04. |

## 14. Danh sách mua và hạng mục chờ

### 14.1. Linh kiện bắt buộc cần mua

**Không có.**

### 14.2. Linh kiện nên mua hoặc tùy chọn mua

**Không có.** DHT, MC-38, SW-420, bàn phím và RTC đều `KHÔNG_DÙNG`, không nằm trong danh sách mua.

### 14.3. Hạng mục chờ xác nhận nhưng không phải quyết định mua

| Hạng mục | Trạng thái | Ảnh hưởng |
|---|---|---|
| Cáp USB dữ liệu Type-B và Type-C | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Cần để nạp/log; nếu không có thì bước vật lý bị chặn, không tự chuyển thành yêu cầu mua. |
| Đồng hồ vạn năng | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Cần để xác minh mức điện/nguồn ở Giai đoạn 5; không tự giả định người dùng sở hữu. |
| Vật liệu mô hình cửa/giá servo | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Chỉ ảnh hưởng hình thức trình diễn cơ khí; không tạo phản hồi chốt. |

## 15. Quy trình hoàn tất và cổng Giai đoạn 5

1. Người dùng duyệt đồng thời Đặc tả, Ma trận kiểm thử và Danh mục phần cứng 1.1.
2. Giai đoạn 1–2 được khóa; không còn quyết định mua linh kiện.
3. Giai đoạn 3–4 thiết kế kiến trúc và UML mà không gán chân.
4. Giai đoạn 5 lập ngân sách dòng, chọn phương án nguồn trong kit, tầng công suất, diode/tụ, mức logic, pinout và cơ khí.
5. Chỉ sau khi vượt các cổng kỹ thuật mới được cấp nguồn cho MQ-2, servo, động cơ, còi hoặc relay.
6. Nếu phần cứng thực tế khác danh sách nhà bán hoặc không có phương án nguồn an toàn, mở kiểm soát thay đổi; không bịa kết quả và không đấu liều.

## 16. Tiêu chí hoàn thành Giai đoạn 2

- Mỗi chức năng nhóm A có phần cứng hoặc hạ tầng phần mềm tương ứng và có truy vết rõ.
- Không có ID phần cứng trùng mã chức năng.
- Không có linh kiện nào mang trạng thái `CẦN_MUA` hoặc `NÊN_MUA`.
- DHT, MC-38, SW-420, bàn phím và RTC được ghi `KHÔNG_DÙNG` nhất quán.
- Servo, động cơ và relay không bị ghi `KHÔNG_DÙNG`; chúng được giữ và chuyển đúng sang `CHỜ_GĐ5_XÁC_MINH_NGUỒN`.
- ESP32 có model nhận diện rõ; UART UNO–ESP32 chưa bị khóa sai trước khi phân bổ chân.
- Không có tuyên bố phần cứng đã chạy hoặc an toàn khi chưa có kiểm thử thật.

## 17. Quyết định còn mở cuối Giai đoạn 2

Không còn quyết định mua hoặc quyết định phạm vi nào cần người dùng chọn. Các mục sau là công việc kỹ thuật đã được người dùng giao cho GPT tự quyết ở đúng giai đoạn:

1. Giai đoạn 5: pinout, ngân sách dòng, nguồn từ các phần tử sẵn có, driver, diode/tụ và mức logic.
2. Giai đoạn 5: nhận dạng module/cực tính, thời gian làm nóng MQ-2, vùng SRF04, góc servo và phương án thử an toàn.
3. Giai đoạn 5–6: cách hiện thực UART UNO–ESP32 do UART phần cứng của UNO dùng chung với USB.
4. Trước thao tác vật lý: người dùng chỉ cần xác nhận cáp/dụng cụ/vật liệu thực tế và thực hiện phép đo/đấu nối theo hướng dẫn.

## 18. Lịch sử sửa đổi

| Phiên bản | Trạng thái | Nội dung | Lý do/ảnh hưởng |
|---|---|---|---|
| 1.0 | Đã thay thế — chỉ giữ lịch sử | Kiểm kê ban đầu trên bộ BLK UNO R3 55+ | Nguồn lịch sử. |
| 1.1 | **ĐÃ DUYỆT — 26/09/2026** | Khóa phạm vi không mua thêm; 16 A/1 B/1 C; dùng LDR và SRF04; loại DHT/MC-38/SW-420/bàn phím/RTC; tách trạng thái sở hữu khỏi cổng kỹ thuật; giữ servo/động cơ/relay chờ Giai đoạn 5 | Đồng bộ Đặc tả 1.1 và ngăn kết luận sai về nguồn hoặc trạng thái cơ khí. |

**TRẠNG THÁI KHÓA:** Giai đoạn 2 hoàn tất ngày 26/09/2026. Danh mục là đầu vào cho kiến trúc và thiết kế phần cứng; các cổng `CHỜ_GĐ5_*` vẫn bắt buộc trước khi đấu/cấp tải.
