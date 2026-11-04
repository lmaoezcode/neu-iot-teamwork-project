# DANH MỤC PHẦN CỨNG PHÒNG THÔNG MINH — PHIÊN BẢN 1.2

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 1.2 |
| Trạng thái | **ĐÃ DUYỆT — 26/09/2026** |
| Giai đoạn | Giai đoạn 2 — Kiểm kê phần cứng và đánh giá khả năng đáp ứng |
| Đặc tả nguồn | `docs/01-dac-ta-he-thong-v1.2.md` — đã duyệt cùng CR-02 ngày 26/09/2026 |
| Phần cứng cơ sở | Bộ BLK UNO R3 và 55+ mạch điện tử cơ bản; ESP32 DevKit V1 30 chân ESP-WROOM-32/4 MB/CH340C/USB Type-C |
| Phạm vi chức năng | 16 chức năng nhóm A, 1 nhóm B và 1 nhóm C |
| Quyết định mua | **Không mua thêm** module, nguồn hoặc mạch tách nguồn; chỉ dùng phần cứng và hạ tầng đã có |
| Phân ranh giai đoạn | Giai đoạn 5 đã loại servo/motor/relay khỏi bản vật lý do không có rail tải an toàn; còn phải đo ngân sách USB, MQ-2, còi và mức logic. |

## 2. Mục tiêu và giới hạn Giai đoạn 2

1. Xác định linh kiện phục vụ từng chức năng đang áp dụng dựa trên danh sách nhà bán mà người dùng đã chấp nhận là chính xác.
2. Tách rõ tình trạng sở hữu khỏi cổng xác minh kỹ thuật; một linh kiện có trong kit vẫn có thể phải chờ Giai đoạn 5.
3. Bảo đảm mọi chức năng nhóm A có phần cứng thật hoặc phương án mô phỏng bằng LED/phần mềm được gắn nhãn rõ.
4. Ghi rõ các linh kiện ngoài kit đã bị loại theo quyết định không mua thêm.
5. Ghi nhận kết luận Giai đoạn 5: không nối servo, motor hoặc relay; chỉ giữ các tải dòng nhỏ trong ngân sách USB có cổng đo.

Danh sách nhà bán là bằng chứng về cấu hình bộ kit, không phải bằng chứng rằng từng linh kiện đã được kiểm thử điện. Tất cả kết quả đo thực tế vẫn để `CHƯA THỰC HIỆN`.

## 3. Quy ước trạng thái

### 3.1. Trạng thái sở hữu/quyết định

| Trạng thái | Ý nghĩa |
|---|---|
| `CÓ_TRONG_KIT` | Có trong cấu hình BLK UNO R3 55+ do nhà bán công bố và được người dùng chấp nhận làm căn cứ chính thức. |
| `ĐÃ_CHỌN_MODEL` | Model/biến thể dùng cho dự án đã được khóa ngoài bộ kit. |
| `TÙY_CHỌN` | Có sẵn nhưng chỉ dùng nếu nhóm A ổn định và còn tài nguyên. |
| `MÔ_PHỎNG_BẰNG_LINH_KIỆN_KIT` | Chức năng được hiện thực bằng LED/trạng thái phần mềm có nhãn thay cho cơ cấu tải động. |
| `KHÔNG_DÙNG_BẢN_1_2` | Linh kiện có thể có trong kit nhưng không được nối trong sản phẩm chính theo CR-02. |
| `KHÔNG_DÙNG` | Không thuộc phạm vi triển khai; không mua để bổ sung. |
| `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Phụ kiện hoặc công cụ không có trong danh sách nhà bán; chỉ cần kiểm tra người dùng đang có hay không trước bước vật lý. |

### 3.2. Cổng kỹ thuật

| Cổng | Ý nghĩa |
|---|---|
| `KHÔNG_CÓ_CỔNG` | Giai đoạn 2 không thấy điều kiện kỹ thuật đặc biệt ngoài kiểm tra thông thường ở Giai đoạn 5. |
| `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Chưa được cấp tải; phải tính ngân sách dòng, nhiệt, driver và bảo vệ trước khi sử dụng. |
| `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Phải xác minh điện áp/tín hiệu và biện pháp hạ mức trước khi nối board/module. |
| `CHỜ_GĐ5_XÁC_MINH_MODULE` | Phải đọc nhãn/chân/cực tính đúng module và tra tài liệu phù hợp trước khi thiết kế. |

Hai cột trạng thái độc lập. Sau CR-02, servo/motor/relay vẫn là `CÓ_TRONG_KIT` về sở hữu nhưng quyết định sử dụng là `KHÔNG_DÙNG_BẢN_1_2`; chúng không còn cổng chờ nguồn trong bản sản phẩm chính.

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
| QD-HW-03 | Không mua thêm linh kiện; DHT, MC-38, SW-420, bàn phím và RTC không thuộc bản triển khai 1.2 | Phạm vi dùng LDR, SRF04, MQ-2, cảm biến lửa và LED có trong kit. |
| QD-HW-04 | Dùng D10/D11 của UNO cho nối tiếp phần mềm; D0/D1 giữ cho USB | Pinout đã được Giai đoạn 5 phân bổ; Giai đoạn 6 khóa tốc độ/khung và kiểm thử tải. |
| QD-HW-05 | UNO TX 5 V không được nối trực tiếp vào ESP32 RX 3,3 V | Dùng bộ chia áp từ điện trở trong kit hoặc phương án tương đương được tính/đo ở Giai đoạn 5. |
| QD-HW-06 | Không nối servo, động cơ và relay trong sản phẩm chính 1.2 | Không có rail tải 5 V tách riêng/phân phối an toàn; dùng LED và trạng thái phần mềm mô phỏng theo CR-02. |
| QD-HW-07 | Không sử dụng điện lưới trong mô hình | Relay không được nối; quyết định này giữ cả khi sản phẩm dùng mô phỏng. |
| QD-HW-08 | UNO và ESP32 dùng hai nguồn USB riêng; chỉ nối GND và tín hiệu đã chuyển mức | Không nối hai rail 5 V, không truyền dòng tải qua board và không cần mạch tách nguồn mới. |

Nguồn tham chiếu cho model ESP32:

- [ESP32 WROOM 32 30-pin DevKit V1 CH340C USB Type-C](https://dientuduchuy.com/products/esp32-wroom-32-30pin-devkitc-v1-ch340c-usb-type-c-wifi-bluetooth) là cấu hình thương mại khớp tiêu chí.
- [Tài liệu ESP32-DevKitC của Espressif](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) là nguồn chính để đối chiếu module, nguồn và pinout khi sang Giai đoạn 5.

Tên nhận diện model: `ESP32 DevKit V1 30 pin ESP-WROOM-32 4 MB CH340C USB Type-C`.

## 6. Bộ điều khiển và kết nối

| ID phần cứng | Linh kiện | Mức | SL | Trạng thái sở hữu/quyết định | Cổng kỹ thuật | Quyết định sử dụng |
|---|---|---|---:|---|---|---|
| HW-CTL-01 | Arduino UNO R3 CH340G | A | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Bộ điều khiển cảm biến/chấp hành và logic cục bộ. |
| HW-CTL-02 | ESP32 DevKit V1 theo QD-HW-02 | A | 1 | `ĐÃ_CHỌN_MODEL` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Cổng Wi-Fi/MQTT, NVS và đồng bộ. |
| HW-CON-01 | Cáp USB dữ liệu Type-B cho UNO | A | 1 | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | `KHÔNG_CÓ_CỔNG` | Người dùng đã xác nhận có; dùng nạp/log và cấp board UNO. |
| HW-CON-02 | Cáp USB dữ liệu Type-C cho ESP32 | A | 1 | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | `KHÔNG_CÓ_CỔNG` | Người dùng đã xác nhận có; dùng nạp/log hoặc nối sạc 5 V cho ESP32. |
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
| HW-ACT-01 | Servo SG90 180° | Mã cũ AN-02 | Ngoài bản thực tế | 1 | `CÓ_TRONG_KIT`, `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không nối nguồn/tín hiệu; AN-06 dùng LED và trạng thái phần mềm mô phỏng. |
| HW-ACT-02 | Động cơ mini 3–6 V | Mã cũ DK-01 | Ngoài bản thực tế | 1 | `CÓ_TRONG_KIT`, `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không nối nguồn; DK-02 dùng LED và trạng thái phần mềm mô phỏng quạt. |
| HW-ACT-03 | LED mô hình chiếu sáng + điện trở | DK-02, TD-02 | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Đèn tiện nghi thật của mô hình. |
| HW-ACT-04 | LED cảnh báo riêng + điện trở | CB-01 | A | 1 bộ | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Dùng màu khác LED chiếu sáng. |
| HW-ACT-05 | Còi xung/chíp 5 V | CB-01 | A có điều kiện đo | 1 | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN`, `CHỜ_GĐ5_XÁC_MINH_MODULE` | Qua C1815; chỉ nối nếu dòng nhánh ≤ 50 mA và tổng dòng USB đạt cổng. |
| HW-ACT-06 | Relay mini 1 kênh 5 V/10 A | Mã cũ DK-01 | Ngoài bản thực tế | 1 | `CÓ_TRONG_KIT`, `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không nối; không điều khiển điện lưới hoặc động cơ. |
| HW-ACT-07 | Mô hình cửa/giá gắn servo | Mã cũ AN-02 | Ngoài bản thực tế | 0 | `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không cần cho khóa mô phỏng. |
| HW-ACT-08 | LED mô phỏng quạt + 330 Ω | DK-02, CD-01, CD-02 | A | 1 bộ | `MÔ_PHỎNG_BẰNG_LINH_KIỆN_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | LED và mọi trạng thái mạng/giao diện luôn mang nhãn mô phỏng. |
| HW-ACT-09 | LED mô phỏng khóa + 330 Ω | AN-06, CD-02 | A | 1 bộ | `MÔ_PHỎNG_BẰNG_LINH_KIỆN_KIT` | `CHỜ_GĐ5_XÁC_MINH_MODULE` | Không đại diện phản hồi cơ khí; `xac_minh_co_khi=false`. |

## 9. Nguồn, công suất và bảo vệ

| ID phần cứng | Linh kiện/phương án sẵn có | Mức | Trạng thái | Cổng kỹ thuật | Quyết định Giai đoạn 2 |
|---|---|---|---|---|---|
| HW-PWR-01 | Adapter 12 V/1 A | Không dùng cho sản phẩm | `CÓ_TRONG_KIT`, `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không nối vào board/tải. |
| HW-PWR-02 | Module AMS1117 5,0 V | Không dùng cho sản phẩm | `CÓ_TRONG_KIT`, `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không dùng hạ 12 V do tổn hao nhiệt và không có tải động cần rail riêng. |
| HW-PWR-03 | USB-B từ máy tính/host hiện có | A — cấp UNO | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Cấp UNO và nhánh cảm biến/tải dòng nhỏ; tổng thiết kế không vượt 400 mA trước đo. |
| HW-PWR-04 | C1815/A1015, IRF3205/IRF4905 | Chuyển mức/còi | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_MỨC_LOGIC` | Chỉ C1815 dùng cho UART và còi; MOSFET không dùng trong mạch chuẩn. |
| HW-PWR-05 | Diode 1N4007 | Dự phòng | `CÓ_TRONG_KIT` | `KHÔNG_CÓ_CỔNG` | Không có tải cảm trong mạch chuẩn 1.2. |
| HW-PWR-06 | Tụ 0,47 µF/47 µF | Lọc/decoupling | `CÓ_TRONG_KIT` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Lọc LDR/nhánh cảm biến; tụ 1000 µF không còn bắt buộc cho tải động. |
| HW-PWR-07 | Relay HW-ACT-06 | Không dùng | `CÓ_TRONG_KIT`, `KHÔNG_DÙNG_BẢN_1_2` | `KHÔNG_CÓ_CỔNG` | Không nối. |
| HW-PWR-08 | USB-C từ máy tính hoặc sạc 5 V/3 A hiện có | A — cấp ESP32 | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | `CHỜ_GĐ5_XÁC_MINH_NGUỒN` | Cấp trực tiếp qua cổng USB-C ESP32; không lấy chân 5 V làm điểm phân phối tải. |

Hai rail USB 5 V không được nối với nhau; hai board chỉ chung GND và tín hiệu đã chuyển mức. Servo, động cơ và relay phải để rời hoàn toàn. Còi không nối trực tiếp GPIO và chỉ được dùng sau khi đo dòng nhánh/tổng dòng. Sạc USB-C 5 V/3 A chỉ cấp ESP32 qua cổng USB-C, không biến thành rail hệ thống qua chân board.

## 10. Linh kiện lắp ráp và công cụ

| ID phần cứng | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| HW-ASM-01 | Breadboard MB-102 830 lỗ | `CÓ_TRONG_KIT` | Một breadboard; bố trí chi tiết ở Giai đoạn 5. |
| HW-ASM-02 | Dây jumper đực–đực và đực–cái | `CÓ_TRONG_KIT` | Dùng cho tín hiệu/nguồn phù hợp; không suy ra khả năng chịu dòng cao. |
| HW-ASM-03 | Điện trở 220 Ω, 330 Ω, 1 kΩ, 10 kΩ | `CÓ_TRONG_KIT` | Phục vụ LED, LDR và bộ chia áp; giá trị cuối phải tính/đo. |
| HW-ASM-04 | Jack/dây nguồn trong kit | `CÓ_TRONG_KIT` | Xác minh cực tính và đầu nối trước khi cấp nguồn. |
| HW-ASM-05 | Đồng hồ vạn năng | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | Người dùng đã xác nhận có; dùng cho các cổng nguồn, mức logic và dòng còi. |
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
| LED mô phỏng | Màu, cực tính, điện trở nối tiếp và ánh xạ đèn/quạt/khóa/cảnh báo | Không được coi LED mô phỏng là bằng chứng motor, servo hoặc cửa thật đã hoạt động. |
| Còi | Chủ động/thụ động, điện áp, dòng nhánh và mức kích qua C1815 | Không được suy luận còi tương thích trực tiếp GPIO hoặc tự động nằm trong ngân sách USB. |
| Nguồn USB | Điện áp tại UNO/MQ-2 và ESP32; tổng dòng nhánh UNO; không nối hai rail 5 V | Không được coi nhãn sạc 5 V/3 A là bằng chứng đường phân phối tải đã an toàn. |
| Servo/motor/relay | Xác nhận đang để rời, không nối nguồn/tín hiệu trong bản 1.2 | Không được cấp thử chỉ vì linh kiện nằm trong kit. |

## 12. Truy vết phần cứng theo chức năng nhóm A

| Chức năng | Phần cứng tối thiểu | Trạng thái cuối Giai đoạn 2 |
|---|---|---|
| MT-03 | HW-CTL-01, HW-CTL-02, HW-SEN-01, HW-ASM-03 | Có trong kit/đã chọn; chờ Giai đoạn 5 khóa mạch chia áp. |
| MT-02 | HW-SEN-01 và hai board | Có đường tạo/nhận biết lỗi; chi tiết chẩn đoán khóa khi lập trình. |
| DK-02 | HW-ACT-03 và HW-ACT-08 | Đèn thật + quạt mô phỏng bằng LED; không nối motor/relay. |
| TD-02 | HW-SEN-01, HW-ACT-03 | Có trong kit; đủ cho tự động hóa đèn. |
| CD-01 | Hai board, HW-CON-03/04, HW-ACT-03/08 | Có/đã chọn; quạt mô phỏng Tự động luôn Tắt theo đặc tả. |
| CD-02 | Hai board, HW-SEN-02, HW-ACT-03/04/05/08/09 | Đủ danh mục; mọi cơ cấu mô phỏng được gắn nhãn. |
| CH-01 | Hai board và NVS của ESP32 | Đã chọn; không cần phần cứng mua thêm. |
| AN-05 | HW-SEN-02, HW-ACT-04, HW-ACT-05 | Có trong kit; SRF04 là cảm biến an ninh bắt buộc. |
| AN-06 | HW-ACT-09 | Khóa mô phỏng bằng LED/phần mềm; `che_do_co_cau=MO_PHONG`, `xac_minh_co_khi=false`. |
| AT-01 | HW-SEN-03, HW-ACT-04, HW-ACT-05 | Có trong kit; chờ xác minh module/nguồn/làm nóng. |
| AT-02 | HW-SEN-04, HW-ACT-04, HW-ACT-05 | Có trong kit; chờ xác minh cực tính và phương pháp thử. |
| CB-01 | HW-ACT-04, HW-ACT-05 và các cảm biến cảnh báo | Có trong kit; mạch lái còi chờ Giai đoạn 5. |
| MN-01 | HW-CTL-01/02, HW-CON-01..04 | Board và cáp đã xác nhận; mức logic còn cổng đo, giao thức khóa ở Giai đoạn 6. |
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
| Cáp USB dữ liệu Type-B và Type-C | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | Sẵn có để nạp/log và cấp hai board riêng. |
| Đồng hồ vạn năng | `ĐÃ_XÁC_NHẬN_THỰC_TẾ` | Sẵn có để đo mức điện/nguồn/dòng ở Giai đoạn 5. |
| Nhãn/cực tính module thật | `CHỜ_XÁC_NHẬN_THỰC_TẾ` | Chỉ cần ảnh khi module nhận được khác danh sách hoặc chữ in không rõ. |

## 15. Quy trình hoàn tất và cổng Giai đoạn 5

1. Người dùng duyệt đồng thời CR-02, Đặc tả, Ma trận kiểm thử và Danh mục phần cứng 1.2.
2. Giai đoạn 1–2 được khóa lại; không có quyết định mua linh kiện.
3. Kiến trúc/UML 1.1 ghi rõ hai cơ cấu mô phỏng; thiết kế phần cứng 1.0 khóa pinout và hai rail USB riêng.
4. Chỉ sau khi đạt cổng nguồn/mức logic mới được cấp MQ-2 và còi; LED/cảm biến được lắp từng nhánh.
5. Servo, động cơ và relay không được nối trong sản phẩm 1.2; không có cổng thử để “xem có chạy”.
6. Kết quả vật lý chỉ được cập nhật sau phép đo thật; mô phỏng không thay cho bằng chứng cảm biến thật.

## 16. Tiêu chí hoàn thành Giai đoạn 2

- Mỗi chức năng nhóm A có phần cứng hoặc hạ tầng phần mềm tương ứng và có truy vết rõ.
- Không có ID phần cứng trùng mã chức năng.
- Không có linh kiện nào mang trạng thái `CẦN_MUA` hoặc `NÊN_MUA`.
- DHT, MC-38, SW-420, bàn phím và RTC được ghi `KHÔNG_DÙNG` nhất quán.
- Servo, động cơ và relay được ghi `KHÔNG_DÙNG_BẢN_1_2`; DK-02/AN-06 có LED mô phỏng riêng và nhãn dữ liệu tương ứng.
- ESP32 có model nhận diện rõ; UART UNO–ESP32 dùng D10/D11 và vẫn phải đo mức trước khi nối.
- Không có tuyên bố phần cứng đã chạy hoặc an toàn khi chưa có kiểm thử thật.

## 17. Quyết định còn mở cuối Giai đoạn 2

Không còn quyết định mua hoặc quyết định phạm vi nào cần người dùng chọn. Các mục sau là công việc kỹ thuật đã được người dùng giao cho GPT tự quyết ở đúng giai đoạn:

1. Giai đoạn 5: đo điện áp/tổng dòng nhánh UNO, dòng còi và mức logic UART.
2. Giai đoạn 5: nhận dạng module/cực tính, thời gian làm nóng MQ-2, vùng SRF04 và phương án thử an toàn.
3. Giai đoạn 6: khóa tốc độ, khung và phục hồi UART phần mềm D10/D11.
4. Trước thao tác vật lý: người dùng thực hiện phép đo/đấu nối theo hướng dẫn; ảnh chỉ cần khi nhãn module không rõ hoặc khác danh sách.

## 18. Lịch sử sửa đổi

| Phiên bản | Trạng thái | Nội dung | Lý do/ảnh hưởng |
|---|---|---|---|
| 1.0 | Đã thay thế — chỉ giữ lịch sử | Kiểm kê ban đầu trên bộ BLK UNO R3 55+ | Nguồn lịch sử. |
| 1.1 | **ĐÃ DUYỆT — 26/09/2026** | Khóa phạm vi không mua thêm; 16 A/1 B/1 C; dùng LDR và SRF04; loại DHT/MC-38/SW-420/bàn phím/RTC; tách trạng thái sở hữu khỏi cổng kỹ thuật; giữ servo/động cơ/relay chờ Giai đoạn 5 | Đồng bộ Đặc tả 1.1 và ngăn kết luận sai về nguồn hoặc trạng thái cơ khí. |
| 1.2 | **ĐÃ DUYỆT — 26/09/2026** | Khóa hai nguồn USB riêng; không nối servo/motor/relay; thêm LED mô phỏng quạt/khóa; xác nhận đã có cáp và đồng hồ | Phù hợp đúng hạ tầng đang có, không phát sinh mua và giữ truy vết 16 A/1 B/1 C. |

**TRẠNG THÁI KHÓA:** Danh mục 1.2 đã được duyệt cùng CR-02 ngày 26/09/2026. Các cổng USB, mức logic, MQ-2 và còi vẫn bắt buộc trước khi đấu; không có cổng nào cho phép nối servo/motor/relay trong bản 1.2.
