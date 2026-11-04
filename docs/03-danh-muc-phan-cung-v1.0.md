# DANH MỤC PHẦN CỨNG PHÒNG THÔNG MINH — PHIÊN BẢN 1.0

> **TÀI LIỆU LỊCH SỬ — ĐÃ ĐƯỢC THAY THẾ BỞI [DANH MỤC PHẦN CỨNG 1.1](./03-danh-muc-phan-cung-v1.1.md). KHÔNG DÙNG DANH SÁCH MUA TRONG TÀI LIỆU NÀY.**

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 1.0 |
| Trạng thái | **ĐÃ THAY THẾ — CHỈ GIỮ LỊCH SỬ** |
| Giai đoạn | Giai đoạn 2 — Kiểm kê phần cứng |
| Đặc tả nguồn | Đặc tả hệ thống 1.0 — Đã duyệt ngày 25/09/2026 |
| Phần cứng cơ sở đã khóa | Bộ BLK UNO R3 và 55+ mạch điện tử cơ bản; ESP32 DevKit V1 30 chân ESP-WROOM-32/4 MB/CH340C/USB-C |
| Nguyên tắc | Danh sách nhà sản xuất/bán kit được coi là chính xác theo chỉ định người dùng; chưa coi linh kiện là đã kiểm thử điện |
| Điểm ra | Danh mục phân loại Có sẵn/Thiếu/Cần mua/Thay thế/Không dùng và được người dùng duyệt |

## 2. Mục tiêu Giai đoạn 2

1. Xác định chủng loại, model/module và số lượng dựa trên cấu hình nhà sản xuất đã được người dùng chấp nhận.
2. Đối chiếu từng linh kiện với 17 chức năng bắt buộc, 2 chức năng nên có và 2 chức năng tùy chọn.
3. Phân loại hạng mục: tận dụng, thiếu, cần mua, thay thế hoặc không cần dùng.
4. Thu thập đủ thông tin điện để Giai đoạn 5 sau này tính nguồn, mạch công suất và chuyển mức an toàn.
5. Tạo danh sách mua tối thiểu, ưu tiên linh kiện giá rẻ nhưng không hy sinh chức năng bắt buộc.

Giai đoạn này **không** cấp nguồn thử tải, không kích thích khí/lửa, không gán chân, không vẽ mạch cuối và không viết firmware. Ảnh phần cứng chỉ cần khi phát sinh sai khác hoặc lỗi thực tế, không còn là điều kiện để khóa danh mục.

## 3. Quy ước trạng thái kiểm kê

| Trạng thái | Ý nghĩa | Bằng chứng tối thiểu |
|---|---|---|
| `CHƯA_XÁC_NHẬN` | Chỉ là linh kiện dự kiến hoặc yêu cầu thiết kế | Chưa có ảnh/tên/số lượng đủ rõ |
| `NHÀ_BÁN_CÔNG_BỐ` | Linh kiện xuất hiện trong danh sách trang sản phẩm và được chấp nhận làm cấu hình chính thức theo chỉ định người dùng | Liên kết/trích xuất trang bán hàng; chưa đồng nghĩa đã kiểm thử điện |
| `CHỐT_MODEL` | Model/biến thể mua hoặc sử dụng đã được quyết định cho dự án | Quyết định phần cứng có mã và tiêu chí nhận diện rõ |
| `KHÔNG_CÓ_TRONG_DANH_SÁCH` | Trang sản phẩm không liệt kê; không đồng nghĩa người dùng chắc chắn không sở hữu riêng | Đối chiếu danh sách bán hàng; hỏi lại người dùng/ảnh thực tế |
| `CÓ_SẴN` | Người dùng thực sự có linh kiện và nhận diện đủ để dùng tiếp | Ảnh rõ hai mặt khi cần, số lượng và ký hiệu/model |
| `CÓ_SẴN_CHƯA_RÕ_MODEL` | Nhìn thấy linh kiện nhưng thiếu thông tin để thiết kế điện/chân | Ảnh hiện có; cần bổ sung ảnh hoặc đo/tra cứu ở bước sau |
| `THIẾU` | Không có trong bộ linh kiện thực tế | Người dùng xác nhận sau khi kiểm tra |
| `CẦN_MUA` | Thiếu và cần để đáp ứng chức năng A hoặc quyết định B/C | Có lý do, số lượng và tiêu chí chọn |
| `THAY_THẾ` | Không dùng linh kiện dự kiến; dùng linh kiện khác có chức năng tương đương | Model thay thế và đánh giá tương thích |
| `KHÔNG_DÙNG` | Có thể có trong kit nhưng không phục vụ phiên bản sản phẩm | Lý do loại khỏi thiết kế |
| `HỎNG/NGHI_HỎNG` | Có linh kiện nhưng dấu hiệu vật lý/kiểm tra sau này không đạt | Ảnh hoặc kết quả kiểm tra; không tự suy đoán |

“Dự kiến có trong kit” không đồng nghĩa `CÓ_SẴN`.

## 4. Căn cứ kiểm kê

### 4.1. Ảnh phần cứng khi nào mới cần

Theo chỉ định của người dùng, danh sách nhà sản xuất/bán bộ kit là căn cứ chính thức để xác nhận chủng loại và số lượng; **không cần ảnh để hoàn tất kiểm kê danh mục**. Ảnh chỉ được yêu cầu sau này nếu:

- linh kiện nhận được khác danh sách;
- nhãn chân, model hoặc cực tính trên module không rõ khi chuẩn bị đấu mạch;
- cần chẩn đoán linh kiện hỏng, sai phiên bản hoặc hành vi điện bất thường.

### 4.2. Quy tắc nếu cần ảnh chẩn đoán

- Không cấp nguồn và không cắm các module với nhau khi chụp.
- Chụp cả hai mặt module; giữ máy song song với mặt PCB để chữ không méo.
- Dùng ánh sáng tán xạ, tránh phản chiếu trên vỏ kim loại ESP32.
- Ảnh phải đọc được ký hiệu như `VCC`, `GND`, `AO`, `DO`, mã chip và tên model.
- Nếu có nhiều linh kiện giống nhau, đặt cạnh giấy ghi số lượng hoặc xếp tách rời để đếm.
- Không cần tự nhận diện linh kiện chưa biết; có thể đánh số tạm `X1`, `X2` và gửi ảnh cận cảnh.
- Không tạo lửa, khói, khí gas hoặc quay động cơ/servo trong bước kiểm kê.

### 4.3. Bằng chứng từ trang sản phẩm người dùng cung cấp

- Nguồn: [Bộ KIT Học Tập BLK UNO R3 Và 55+ Mạch Điện Tử Cơ Bản](https://banlinhkien.com/bo-kit-hoc-tap-blk-uno-r3-va-55-mach-dien-tu-co-ban-p38422156.html).
- Ngày đối chiếu: 25/09/2026.
- Phạm vi bằng chứng: danh sách nhà bán công bố được người dùng chấp nhận làm cấu hình chính thức; không phải bằng chứng rằng từng linh kiện đã được thử điện.

Các hạng mục liên quan trực tiếp được nhà bán liệt kê gồm:

- board test MB-102 830 lỗ, điện trở 220 Ω/330 Ω/1 kΩ/10 kΩ, tụ 0,47 µF/47 µF/1000 µF và diode 1N4007;
- LED đỏ/xanh/vàng/RGB, quang trở CDS 5 mm 5537, động cơ mini 3–6 V và KIT UNO R3 CH340G;
- cảm biến lửa, cảm biến âm thanh, cảm biến siêu âm SRF04, MQ-2 và servo SG90;
- còi xung 5 V, còi chíp 5 V, nút nhấn, relay mini 1 kênh 5 V/10 A;
- transistor C1815/A1015, MOSFET IRF3205/IRF4905;
- adapter 12 V/1 A, module AMS1117 5,0 V, jack/dây nguồn và các bộ dây cắm.

Trang không liệt kê DHT11/DHT22, cảm biến cửa/công tắc từ, SW-420, bàn phím 4×4, RTC, cáp USB, mạch chuyển mức chuyên dụng hoặc một nguồn 5 V dòng cao chuyên cấp tải. NTC 47D-15 trong kit không thay thế được cảm biến nhiệt độ–độ ẩm vì không đo độ ẩm.

### 4.4. Kết luận đủ/thiếu sơ bộ theo danh sách bán hàng

| Nhóm | Kết luận sơ bộ | Hành động |
|---|---|---|
| Điều khiển/mạng | UNO R3 CH340G có trong kit; model ESP32 đã được chọn riêng | Đủ về board; cần có hai cáp dữ liệu đúng chuẩn |
| Nhiệt độ/độ ẩm | Không có DHT hoặc cảm biến tương đương trong danh sách | **Bắt buộc mua thêm 1 module** |
| Ánh sáng | Có 2 quang trở 5537 và điện trở | Đủ theo cấu hình nhà sản xuất |
| Khí/lửa | Có MQ-2 và cảm biến lửa | Đủ theo cấu hình; thông số chân/ngưỡng chỉ khóa khi thiết kế và kiểm tra module thật |
| Cửa/an ninh | Có servo nhưng không có cảm biến cửa | **Bắt buộc mua thêm 1 cảm biến cửa/công tắc từ** |
| Đèn/còi | Có nhiều LED và hai loại còi 5 V | Đủ theo cấu hình; phân biệt loại còi khi đấu thử |
| Quạt mô hình | Có động cơ mini 3–6 V, MOSFET/transistor/diode/relay | Có thể mô phỏng quạt; mạch công suất cuối vẫn phải kiểm tra, không nối trực tiếp I/O |
| Nguồn tải | Có adapter 12 V/1 A và AMS1117 5 V | **Chưa thể coi là đủ** cho servo + motor + MQ-2; cần lập ngân sách dòng và chọn nguồn 5 V/bộ hạ áp phù hợp |
| UART UNO–ESP32 | Có điện trở 1 kΩ và 10 kΩ nhưng chưa đủ cặp giá trị tối ưu được khóa | Thiết kế bộ chia áp hoặc chọn mạch chuyển mức ở Giai đoạn 5–6; tuyệt đối không nối 5 V trực tiếp vào ESP32 |
| An ninh rung | Không có SW-420 | Không ảnh hưởng nhóm A; mua nếu giữ AN-04 nhóm B |
| Chức năng tùy chọn | Có SRF04/âm thanh; không có bàn phím/RTC | MR-01 có phần cứng tiềm năng; AN-03 chưa đủ |

**Kết luận:** bộ kit cộng ESP32 cung cấp phần lớn phần cứng lõi nhưng **chưa đủ để triển khai toàn bộ Đặc tả 1.0**. Các bổ sung bắt buộc là DHT22/AM2302, MC-38, nguồn 5 V/3 A, vật liệu mô hình cửa và cáp dữ liệu nếu chưa có; SW-420 là bổ sung nhóm B được khuyến nghị.

### 4.5. Quyết định phần cứng đã khóa

| Mã quyết định | Nội dung đã khóa | Lý do |
|---|---|---|
| QD-HW-01 | Sử dụng trọn bộ **BLK UNO R3 và 55+ mạch điện tử cơ bản** đúng cấu hình 52 hạng mục trên trang người dùng cung cấp | Tận dụng bộ được giao/chọn và bao phủ phần lớn cảm biến, tải, linh kiện công suất, breadboard, dây |
| QD-HW-02 | Board cổng mạng: **ESP32 DevKit V1 30 chân, module ESP-WROOM-32, flash 4 MB, CH340C, USB Type-C, anten PCB, nút EN và BOOT, header đã hàn** | Đủ Wi-Fi/MQTT/NVS/UART, nhỏ gọn và dễ cắm breadboard; 30 chân là đủ vì UNO xử lý cảm biến/chấp hành |
| QD-HW-03 | Không chọn ESP32-WROVER, ESP32-C3/S2/S3 hoặc bản 38 chân cho phiên bản 1.0 | WROVER có thể chiếm GPIO16/17 cho PSRAM; dòng C3/S2/S3 đổi kiến trúc/pinout không đem lại lợi ích cần thiết; 38 chân rộng và dư thừa cho vai trò cổng mạng |
| QD-HW-04 | CH340C chỉ làm cầu USB–UART nạp/debug; giao tiếp UNO–ESP32 dùng UART phần cứng riêng, chân cụ thể khóa ở Giai đoạn 5–6 | Không xung đột cổng log/nạp và giữ giao thức rõ ràng |
| QD-HW-05 | USB Type-C phải là cáp **có truyền dữ liệu**, không chỉ sạc | Bảo đảm nạp firmware và đọc log ổn định |

Nguồn tham chiếu cho quyết định ESP32:

- [ESP32 WROOM 32 30-pin DevKit V1 CH340C USB Type-C](https://dientuduchuy.com/products/esp32-wroom-32-30pin-devkitc-v1-ch340c-usb-type-c-wifi-bluetooth) là một cấu hình thương mại khớp tiêu chí đã khóa.
- [Tài liệu ESP32-DevKitC của Espressif](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) xác nhận dòng ESP32-WROOM có Wi-Fi 2,4 GHz, Bluetooth, UART và đủ GPIO; GPIO16/17 khả dụng trên board dùng WROOM nhưng bị dành nội bộ ở biến thể WROVER.
- [Danh mục USB–UART chính thức của WCH](https://wch-ic.com/products/productsCenter/mcuInterface?categoryId=1&tName=USB+to+UART) cho biết CH340C là cầu USB nối tiếp ảo, hỗ trợ DTR/RTS và tốc độ cao hơn nhiều nhu cầu nạp firmware/log của dự án.

Tên tìm mua chuẩn: `ESP32 DevKit V1 30 pin ESP-WROOM-32 CH340C USB Type-C`.

## 5. Bảng kiểm kê bộ điều khiển và kết nối

| ID | Linh kiện cần kiểm tra | Mức | SL tối thiểu dự kiến | Nguồn dự kiến | Trạng thái thực tế | SL/model thực tế | Ảnh | Quyết định |
|---|---|---|---:|---|---|---|---|---|
| DK-01 | Arduino UNO R3/board tương thích | A | 1 | Kit BLK UNO R3 55+ | `NHÀ_BÁN_CÔNG_BỐ` | UNO R3 CH340G × 1 theo trang | Trang sản phẩm | **Đã khóa theo QD-HW-01** |
| DK-02 | ESP32 DevKit V1 30 chân, ESP-WROOM-32, CH340C, USB Type-C, EN/BOOT | A | 1 | Board mua riêng | `CHỐT_MODEL` | Flash 4 MB, anten PCB, header đã hàn | Quyết định QD-HW-02 | Model chuẩn cho toàn dự án |
| DK-03 | Cáp dữ liệu USB Type-B cho UNO | A | 1 | Mua/dùng cáp sẵn có | `CẦN_MUA` nếu chưa có | Phải hỗ trợ dữ liệu, không chỉ cấp nguồn | Trang sản phẩm | Kiểm tra cáp trước khi mua thêm |
| DK-04 | Cáp dữ liệu USB Type-C cho ESP32 | A | 1 | Mua/dùng cáp sẵn có | `CẦN_MUA` nếu chưa có | Phải hỗ trợ dữ liệu, không chỉ sạc | QD-HW-05 | Kiểm tra cáp trước khi mua thêm |
| DK-05 | Bộ chia áp UNO TX → ESP32 RX | A | 1 bộ | Lắp từ điện trở trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Có thể dùng 1 kΩ nối tiếp và 2 kΩ xuống đất bằng hai điện trở 1 kΩ nối tiếp; giá trị cuối khóa khi thiết kế | Trang sản phẩm | Không cần mua mạch chuyển mức nếu đo điện trở đạt |
| DK-06 | Dây nối đất chung và dây UART phù hợp | A | 1 bộ | Kit | `NHÀ_BÁN_CÔNG_BỐ` | Bộ dây 65 sợi và dây đực–cái 40P | Trang sản phẩm | Đủ theo cấu hình; chọn dây cụ thể ở Giai đoạn 5 |

Khi mua ESP32, đối chiếu đủ chuỗi nhận diện: **30 chân — ESP-WROOM-32 — 4 MB — CH340C — USB Type-C — EN/BOOT — anten PCB — header đã hàn**. Không nhận bản 38 chân, WROVER hoặc một biến thể C3/S2/S3 chỉ vì tiêu đề bán hàng cũng ghi “ESP32 CH340”.

## 6. Bảng kiểm kê cảm biến và thiết bị nhập

| ID | Linh kiện cần kiểm tra | Chức năng | Mức | SL tối thiểu dự kiến | Nguồn dự kiến | Trạng thái thực tế | SL/model thực tế | Ảnh | Quyết định |
|---|---|---|---|---:|---|---|---|---|---|
| CB-01 | Module DHT22/AM2302 ba chân | MT-01, MT-02, TD-01 | A | 1 | Mua thêm | `CẦN_MUA` | Ưu tiên DHT22 thay DHT11; chu kỳ lấy mẫu 2 giây phù hợp đặc tả | Trang sản phẩm | **Đề xuất khóa model bổ sung** |
| CB-02 | Quang trở (LDR) | MT-01, MT-02, TD-02 | A | 1 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | CDS 5 mm 5537 × 2 | Trang sản phẩm | Đủ theo cấu hình; dùng điện trở chia áp trong kit |
| CB-03 | Module MQ-2 | AT-01 | A | 1 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | MQ-2 × 1 | Trang sản phẩm | Đủ danh mục; xác định AO/DO và thời gian làm nóng khi triển khai |
| CB-04 | Module cảm biến lửa | AT-02 | A | 1 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Flame Sensor × 1 | Trang sản phẩm | Đủ danh mục; xác định cực tính/mức kích khi triển khai |
| CB-05 | Công tắc từ cửa MC-38 | AN-01, AN-02 | A | 1 | Mua thêm | `CẦN_MUA` | Tiếp điểm khô, kèm nam châm; trạng thái NO/NC phải kiểm tra bằng đồng hồ | Trang sản phẩm | **Đề xuất khóa model bổ sung** |
| CB-06 | Cảm biến rung SW-420 | AN-04 | B | 1 | Nên mua nếu kit thiếu | `KHÔNG_CÓ_TRONG_DANH_SÁCH` | Chưa xác nhận sở hữu riêng | Trang sản phẩm | Mua nếu giữ AN-04 |
| CB-07 | Cảm biến siêu âm | MR-01 | C | 1 | Dự kiến trong kit | `NHÀ_BÁN_CÔNG_BỐ` | SRF04 × 1 | Trang sản phẩm | Không mặc định dùng cho an ninh |
| CB-08 | Cảm biến âm thanh | MR-01 hoặc không dùng | C | 1 | Dự kiến trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Module âm thanh × 1 | Trang sản phẩm | Chỉ dùng nếu có mục tiêu rõ |
| CB-09 | Bàn phím ma trận 4×4 | AN-03 | C | 1 | Mua tùy chọn | `KHÔNG_CÓ_TRONG_DANH_SÁCH` | Chưa xác nhận sở hữu riêng | Trang sản phẩm | Chỉ mua sau đánh giá chân/tài nguyên |
| CB-10 | Nút nhấn | Thử nghiệm/Tắt tiếng cục bộ nếu được thiết kế | Phụ trợ | 2 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Nút nhấn 4 chân × 5; nút đỏ/vàng/xanh × 1 mỗi loại | Trang sản phẩm | Chưa gán chức năng cuối |
| CB-11 | RTC | Chỉ khi kiến trúc chứng minh cần | C | 0–1 | Mua tùy chọn | `KHÔNG_CÓ_TRONG_DANH_SÁCH` | Không có trong cấu hình | Trang sản phẩm | Mặc định không mua; dùng thời gian máy chủ/ESP32 khi có mạng |

## 7. Bảng kiểm kê cơ cấu chấp hành

| ID | Linh kiện cần kiểm tra | Chức năng | Mức | SL tối thiểu dự kiến | Nguồn dự kiến | Trạng thái thực tế | SL/model thực tế | Ảnh | Quyết định |
|---|---|---|---|---:|---|---|---|---|---|
| CH-01 | Servo khóa cửa | AN-02 | A | 1 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | SG90 180° × 1 | Trang sản phẩm | Đủ danh mục; dòng tải và cơ khí kiểm tra ở Giai đoạn 4–5 |
| CH-02 | Động cơ một chiều mô phỏng quạt | DK-01, TD-01 | A | 1 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Động cơ mini 3–6 V × 1 | Trang sản phẩm | Đủ danh mục; phải qua tầng công suất |
| CH-03 | LED/đèn mô hình cho chiếu sáng | DK-01, TD-02 | A | 1 | Dự kiến trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Nhiều LED 5 mm | Trang sản phẩm | Có điện trở 220/330 Ω theo danh sách |
| CH-04 | LED cảnh báo riêng | CB-01 | A | 1 | Dự kiến trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Nhiều màu LED | Trang sản phẩm | Chọn khác màu LED chiếu sáng |
| CH-05 | Còi chủ động hoặc thụ động | CB-01 | A | 1 | Trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Còi xung 5 V + còi chíp 5 V | Trang sản phẩm | Chọn còi chủ động sau phép thử nhận dạng không nguy hiểm |
| CH-06 | Module relay | Có thể điều khiển tải, chưa mặc định dùng | Phụ trợ | 0–1 | Dự kiến trong kit | `NHÀ_BÁN_CÔNG_BỐ` | Relay mini 1 kênh 5 V/10 A × 1 | Trang sản phẩm | Xác định mức kích; tránh điện lưới |
| CH-07 | Vật liệu mô hình cửa/chốt và giá gắn servo | AN-01, AN-02 | A | 1 bộ | Tự chuẩn bị | `CHƯA_XÁC_NHẬN` | Chưa xác nhận | — | Hình học chốt chỉ thiết kế sau khi biết servo |

## 8. Bảng kiểm kê nguồn và mạch công suất

| ID | Linh kiện cần kiểm tra | Mức | SL tối thiểu dự kiến | Trạng thái thực tế | Thông tin phải xác nhận | Ảnh | Quyết định |
|---|---|---|---:|---|---|---|---|
| CS-01 | Nguồn chuyển mạch 5 V/3 A ổn áp cho servo/động cơ/MQ-2 và tải | A | 1 | `CẦN_MUA` | Kit chỉ liệt kê adapter 12 V/1 A + AMS1117 5 V; không chọn AMS1117 làm nguồn chung cho tải động | Trang sản phẩm | **Đề xuất khóa phương án nguồn bổ sung; ngân sách dòng chi tiết ở Giai đoạn 5** |
| CS-02 | Driver động cơ/module công suất phù hợp | A | 1 | `NHÀ_BÁN_CÔNG_BỐ` theo phương án relay | Có relay mini một kênh 5 V/10 A và linh kiện công suất rời | Trang sản phẩm | Tạm dùng relay cho Bật/Tắt; đổi sang MOSFET logic-level nếu kiểm tra module không phù hợp |
| CS-03 | Transistor/MOSFET điều khiển tải | A hoặc thay CS-02 | ≥ 1 | `NHÀ_BÁN_CÔNG_BỐ` | C1815/A1015 × 5; IRF3205/IRF4905 × 1 | Trang sản phẩm | Phải tra datasheet/đánh giá điều khiển cổng trước khi chọn |
| CS-04 | Diode dập xung ngược cho tải cảm | A khi driver không tích hợp | ≥ 1 | `NHÀ_BÁN_CÔNG_BỐ` | 1N4007 × 10 | Trang sản phẩm | Có khả năng dùng; xác nhận thực tế |
| CS-05 | Tụ lọc/decoupling gần tải/board | A theo thiết kế nguồn | 1 bộ | `NHÀ_BÁN_CÔNG_BỐ` | 0,47 µF/47 µF/1000 µF | Trang sản phẩm | Chọn sau tính nguồn |
| CS-06 | Module nguồn breadboard (nếu có) | Phụ trợ | 0–1 | `NHÀ_BÁN_CÔNG_BỐ` | AMS1117 5,0 V + adapter 12 V/1 A, không phải module MB102 theo mô tả | Trang sản phẩm | Không mặc định đủ dòng cho servo/motor |
| CS-07 | Đồng hồ vạn năng số | Công cụ an toàn | 1 | `CHƯA_XÁC_NHẬN` | Có đo DC V, điện trở/thông mạch | — | Nên có trước Giai đoạn 5/19 |

Không nối servo, động cơ hoặc relay trực tiếp vào chân I/O. Không mặc định chân 5 V/3,3 V của board đủ cấp tải. Không dùng điện lưới trong mô hình ở phạm vi hiện tại.

## 9. Bảng kiểm kê linh kiện lắp ráp

| ID | Linh kiện cần kiểm tra | Mức | Số lượng dự kiến | Trạng thái thực tế | Ghi chú cần xác nhận | Ảnh | Quyết định |
|---|---|---|---:|---|---|---|---|
| LR-01 | Breadboard | A | ≥ 1 | `NHÀ_BÁN_CÔNG_BỐ` | MB-102 830 lỗ × 1 | Trang sản phẩm | Đủ theo cấu hình; có thể mua thêm breadboard nếu bố trí thực tế chật |
| LR-02 | Dây jumper đực–đực | A | ≥ 20 | `NHÀ_BÁN_CÔNG_BỐ` | Bộ dây 65 sợi có dây đực–đực | Trang sản phẩm | Đủ theo cấu hình |
| LR-03 | Dây jumper đực–cái | A | ≥ 10 | `NHÀ_BÁN_CÔNG_BỐ` | Dây 40P đực–cái + bộ dây | Trang sản phẩm | Đủ theo cấu hình |
| LR-04 | Dây jumper cái–cái | Phụ trợ | ≥ 5 | `KHÔNG_CÓ_TRONG_DANH_SÁCH` | Không bắt buộc với cấu hình hiện tại; chỉ mua nếu đầu nối thực tế cần | Trang sản phẩm | Chưa mua |
| LR-05 | Bộ điện trở | A | 1 bộ | `NHÀ_BÁN_CÔNG_BỐ` | 220 Ω, 330 Ω, 1 kΩ, 10 kΩ; mỗi loại 10 | Trang sản phẩm | Có thể phục vụ LED/LDR/chia áp; xác nhận thực tế |
| LR-06 | Tụ điện các loại | A theo thiết kế | 1 bộ | `NHÀ_BÁN_CÔNG_BỐ` | 0,47 µF, 47 µF, 1000 µF | Trang sản phẩm | Xác nhận cực tính/giá trị thực tế |
| LR-07 | Header/đầu nối/domino nếu cần | Phụ trợ | 1 bộ | `CHƯA_XÁC_NHẬN` | Phù hợp module/nguồn | — | Quyết định sau sơ đồ |
| LR-08 | Băng dính cách điện/ống co nhiệt/dụng cụ cố định dây | An toàn lắp ráp | 1 bộ | `CHƯA_XÁC_NHẬN` | Không dùng thay kết nối điện chắc chắn | — | Chờ kiểm kê |

## 10. Thông tin phải xác minh trước khi đấu điện

| Module | Thông tin cần lấy từ nhãn, tài liệu hoặc phép đo an toàn | Chưa được phép suy luận |
|---|---|---|
| Arduino UNO | Tên board, MCU chính, USB–UART nếu đọc được, điện áp in trên board, tình trạng cổng/chân | Board chính hãng hay clone; mọi chân đều tốt |
| ESP32 | Khớp đầy đủ QD-HW-02; dùng pinout đúng bản 30 chân nhận được | Pinout từ board 38 chân hoặc biến thể WROVER/C3/S2/S3; chân nào cũng khả dụng |
| DHT | DHT11/DHT22/module 3 chân hay cảm biến 4 chân, thứ tự chân | Thứ tự VCC/DATA/GND |
| MQ-2 | Mã module, AO/DO, điện áp in, chip so sánh, biến trở | Dải ADC, thời gian làm nóng, ngưỡng, ppm |
| Cảm biến lửa | Mã PCB, AO/DO, cực tính, điện áp | Mức logic active-high/active-low |
| Cảm biến cửa | Loại reed/hành trình, NO/NC nếu ghi, số dây | Cửa đóng tương ứng logic 0 hay 1 |
| Servo | Mã model, màu dây/đầu nối, điện áp nếu ghi | Góc, dòng chạy/dòng kẹt |
| Động cơ/quạt | Mã/điện áp/dòng nếu ghi | Có thể cấp từ board hoặc driver nào phù hợp |
| Còi | Mã, active/passive, điện áp/dòng nếu ghi | Có thể nối trực tiếp I/O |
| Relay/driver | Mã module/chip, điện áp logic/cuộn, chân, diode/opto | Tương thích 3,3 V/5 V hoặc đủ dòng tải |
| Nguồn | Điện áp, dòng, cực tính, chuẩn đầu nối | Chất lượng/khả năng chịu xung tải nếu chưa đo |

## 11. Truy vết phần cứng tối thiểu theo chức năng nhóm A

| Chức năng | Phần cứng tối thiểu phụ thuộc | Trạng thái hiện tại |
|---|---|---|
| MT-01, MT-02 | DK-01, DK-02, CB-01, CB-02, điện trở/breadboard/dây | Thiếu DHT22; phần còn lại có/đã chọn |
| DK-01, TD-01 | CH-02, relay/tầng công suất, diode, nguồn phù hợp | Có tải và linh kiện điều khiển; còn thiếu nguồn 5 V đã chọn |
| DK-01, TD-02 | CH-03, điện trở phù hợp | Đủ theo cấu hình kit |
| CD-01, CD-02, CH-01 | Hai board, UART an toàn, bộ nhớ ESP32 | Hai board đã khóa; bộ chia áp dùng điện trở kit; chân khóa ở Giai đoạn 5 |
| AN-01 | CB-05, CH-05, CH-04 | Thiếu MC-38; còi/LED có trong kit |
| AN-02 | CH-01, CB-05, CH-07, nguồn servo | Có SG90; thiếu MC-38, nguồn 5 V và vật liệu mô hình cửa |
| AT-01 | CB-03, CH-05, CH-04 | Đủ theo cấu hình kit; chưa kiểm thử điện |
| AT-02 | CB-04, CH-05, CH-04 | Đủ theo cấu hình kit; chưa kiểm thử điện |
| CB-01 | CH-05, CH-04 và nguồn/driver nếu cần | Đủ danh mục; mạch lái khóa ở Giai đoạn 4 |
| MN-01 | DK-01 đến DK-06 | Board đã khóa; cần bảo đảm hai cáp dữ liệu |
| UD-01, DL-01, BC-01 | Không thêm phần cứng ngoài máy phát triển/mạng; phụ thuộc dữ liệu từ hệ thống | Máy phát triển/mạng chưa cần kiểm kê chi tiết ở bước ảnh đầu |

## 12. Danh sách bổ sung tối thiểu đề nghị duyệt

| Hạng mục | Số lượng | Quyết định/tiêu chí chọn | Trạng thái |
|---|---|---|---|
| Module DHT22/AM2302 ba chân | 1 | Chọn module ba chân có điện trở kéo lên sẵn; phù hợp chu kỳ lấy mẫu 2 giây và tốt hơn DHT11 | **Bắt buộc — Cần mua** |
| Công tắc từ cửa MC-38 | 1 | Tiếp điểm khô, kèm nam châm; kiểm tra NO/NC bằng đồng hồ trước khi đấu | **Bắt buộc — Cần mua** |
| Nguồn ổn áp 5 V/3 A | 1 | Nguồn riêng cho servo, động cơ, MQ-2 và tải 5 V; có đầu nối chắc chắn; nối đất chung với hai board | **Bắt buộc — Cần mua** |
| Cáp USB dữ liệu Type-B cho UNO | 1 | Cáp có truyền dữ liệu; chỉ mua nếu người dùng chưa có | **Bắt buộc — Kiểm tra trước khi mua** |
| Cáp USB dữ liệu Type-C cho ESP32 | 1 | Cáp có truyền dữ liệu; chỉ mua nếu người dùng chưa có | **Bắt buộc — Kiểm tra trước khi mua** |
| SW-420 | 1 | Module rung có biến trở; bổ sung AN-04 nhóm B | **Nên mua** |
| Vật liệu mô hình cửa và giá gắn servo/nam châm | 1 bộ | Đủ cứng để servo thao tác lặp lại và giữ khe MC-38 ổn định | **Bắt buộc — Người dùng chuẩn bị** |
| Bàn phím 4×4 | 0–1 | Chỉ mua nếu quyết định triển khai AN-03 sau khi phân bổ chân | **Tùy chọn — Chưa mua** |

Không cần mua thêm MQ-2, cảm biến lửa, servo, động cơ, còi, LED, relay, diode, transistor/MOSFET, breadboard, dây hay điện trở ở thời điểm này vì đã có trong cấu hình bộ kit. Mạch điều khiển động cơ tạm dự kiến tận dụng relay hoặc phần tử công suất trong kit; phương án cuối được khóa sau khi tính nguồn và tra đúng module ở Giai đoạn 4–5.

## 13. Quy trình khóa danh mục

1. Dùng cấu hình 52 hạng mục trên trang bộ BLK UNO R3 55+ làm danh mục cơ sở chính thức theo chỉ định người dùng.
2. Khóa đúng biến thể ESP32 bằng chuỗi nhận diện tại QD-HW-02.
3. Đối chiếu 21 chức năng để phân loại `NHÀ_BÁN_CÔNG_BỐ`, `CHỐT_MODEL`, `CẦN_MUA`, `KHÔNG_CÓ_TRONG_DANH_SÁCH` hoặc `KHÔNG_DÙNG`.
4. Lập danh sách bổ sung tối thiểu ở mục 12; không mua trùng linh kiện đã có trong kit.
5. Người dùng duyệt danh sách bổ sung và quyết định AN-04/SW-420 thuộc phạm vi triển khai thực tế hay chỉ giữ ở nhóm B.
6. Tài liệu chuyển sang **ĐÃ DUYỆT**; chỉ khi đó mới bắt đầu Giai đoạn 3.

Nếu hàng nhận được khác cấu hình đã công bố, mở lại đúng dòng bị ảnh hưởng và dùng ảnh/nhãn/phép đo để xử lý sai khác; không phải kiểm kê lại toàn bộ bộ kit.

## 14. Tiêu chí hoàn thành Giai đoạn 2

- Mỗi hạng mục nhóm A có model/loại, số lượng và trạng thái rõ hoặc có mục Cần mua cụ thể.
- Cấu hình bộ kit có nguồn dẫn và được ghi đúng là thông tin nhà sản xuất, không bị trình bày như kết quả kiểm thử điện.
- ESP32 có chuỗi model mua rõ; xác định được loại cáp và nguyên tắc hạ mức UNO–ESP32.
- Mọi linh kiện không xuất hiện trong danh sách kit được chuyển thành Cần mua hoặc loại khỏi phạm vi, không suy đoán là có.
- Chức năng B/C được quyết định giữ triển khai hay không dựa trên tài nguyên thật.
- Có danh sách mua tối thiểu được người dùng duyệt.
- Chưa có số liệu thử nghiệm hoặc tuyên bố linh kiện hoạt động nếu chưa kiểm tra thật.

## 15. Các quyết định còn chờ người dùng duyệt

Để hoàn tất Giai đoạn 2, người dùng chỉ cần duyệt hoặc sửa danh sách sau:

```text
1. Mua DHT22/AM2302 ba chân: Đồng ý / Đổi loại
2. Mua công tắc từ cửa MC-38: Đồng ý / Đổi loại
3. Mua nguồn ổn áp 5 V/3 A: Đồng ý / Đổi phương án nguồn
4. Cáp USB Type-B và Type-C dữ liệu: Đã có / Cần mua
5. Mua thêm SW-420 để triển khai AN-04: Có / Không
6. Bàn phím 4×4 cho AN-03 tùy chọn: Chưa mua / Muốn triển khai
```

## 16. Lịch sử sửa đổi

| Phiên bản | Trạng thái | Nội dung | Lý do/ảnh hưởng |
|---|---|---|---|
| 1.0 | **Đang kiểm kê** | Tạo bảng kiểm kê ban đầu; toàn bộ trạng thái là Chưa xác nhận | Bắt đầu Giai đoạn 2 theo yêu cầu người dùng ngày 25/09/2026 |
| 1.0 | **Đang kiểm kê** | Đối chiếu danh sách 52 hạng mục trên trang người dùng cung cấp; xác nhận sơ bộ phần lớn lõi có trong danh sách, phát hiện thiếu DHT/cảm biến cửa và rủi ro nguồn | Quy tắc yêu cầu ảnh của bản nháp này đã được quyết định sau thay thế |
| 1.0 | **Đang chờ duyệt danh sách bổ sung** | Người dùng chấp nhận cấu hình nhà sản xuất làm căn cứ; khóa bộ BLK UNO R3 55+ và ESP32 DevKit V1 30 chân ESP-WROOM-32/4 MB/CH340C/USB-C | Bỏ điều kiện kiểm kê bằng ảnh; ảnh chỉ dùng khi có sai khác hoặc lỗi thực tế |

**ĐIỂM DỪNG:** Chờ người dùng duyệt danh sách bổ sung tại mục 12. Chưa lập sơ đồ chân, chưa thiết kế mạch và chưa viết firmware; thông tin nhà sản xuất không được trình bày như kết quả kiểm thử thực tế.
