# HỆ THỐNG PHÒNG THÔNG MINH DỰA TRÊN MẠNG KẾT NỐI VẠN VẬT

Đây là thư mục làm việc của bài tập lớn:

**Thiết kế hệ thống giám sát, điều khiển và tự động hóa phòng thông minh dựa trên mạng kết nối vạn vật.**

## Trạng thái dự án

- Mốc hiện tại: **Giai đoạn 17 — Tích hợp**; Giai đoạn 1–16 đã khóa.
- Quyết định phần cứng: dùng **BLK UNO R3 và 55+ mạch điện tử cơ bản** + ESP32 đã chọn.
- Khung 29 giai đoạn giữ nguyên. Sản phẩm chính **không mua thêm module, nguồn hoặc mạch tách nguồn**; chỉ dùng kit 55+, ESP32 và hạ tầng/cáp đã có.
- Phạm vi đã duyệt gồm **16 chức năng nhóm A, 1 nhóm B và 1 nhóm C**. `DK-01`/`AN-02` ngừng; thay bằng `DK-02` (đèn thật, quạt mô phỏng) và `AN-06` (khóa mô phỏng).
- SRF04, LDR, MQ-2, cảm biến lửa, nút, LED và UART chuyển mức được triển khai vật lý sau cổng đo. Servo, động cơ và relay không nối trong sản phẩm chính; quạt/khóa dùng LED và trạng thái phần mềm với nhãn `MÔ PHỎNG`.
- UNO và ESP32 dùng hai nguồn USB riêng; không nối hai rail 5 V. Còi qua C1815 chỉ dùng khi dòng đo ≤50 mA và ngân sách phía UNO đạt yêu cầu.
- Giao thức dây UNO–ESP32 1.0, MQTT 1.0, Thiết kế dữ liệu 1.0, Thiết kế giao diện 1.0, Cấu trúc dự án 1.0, Firmware UNO 1.0 và Firmware ESP32 1.0 đã được duyệt ngày 26/09/2026. Hai firmware đã build thành công; chưa nạp board hoặc có kết quả thực nghiệm.
- Bộ môi giới Mosquitto, ACL và công cụ vận hành Giai đoạn 13 đã được duyệt; cấu hình cùng **8/8 smoke test broker cục bộ đã đạt** và không có credential thật trong repository.
- [CR-03](./docs/04-kiem-soat-thay-doi-CR-03.md) sửa lỗi bảo trì ID bản tin ESP32, không đổi topic/schema/phạm vi và đã được duyệt cùng Giai đoạn 14 ngày 28/09/2026.
- Máy chủ Giai đoạn 14 đã được hiện thực bằng Fastify/TypeScript với MQTT 3.1.1, xác thực phiên + CSRF, API, SSE, lệnh/cấu hình có ACK và repository tạm. Kiểm tra kiểu/build cùng **13/13 kiểm thử máy chủ đã đạt**; tài liệu đã được duyệt ngày 28/09/2026.
- Cơ sở dữ liệu Giai đoạn 15 đã được hiện thực bằng SQLite với migration/checksum, bảng `STRICT`, WAL, repository bền vững, inbox/outbox, phiên, retention và online backup. **22/22 kiểm thử máy chủ (trong đó 9/9 kiểm thử SQLite) đã đạt**; tài liệu được duyệt ngày 28/09/2026.
- Ứng dụng web Giai đoạn 16 đã được hiện thực bằng TypeScript/Vite với tám tuyến tiếng Việt, route guard, API/CSRF, SSE + polling dự phòng, lệnh có ACK, cấu hình, cảnh báo, biểu đồ, nhật ký và giao diện thích ứng. **30/30 kiểm thử web đã đạt**; tài liệu và CR-04 được duyệt ngày 29/09/2026.
- [CR-04](./docs/04-kiem-soat-thay-doi-CR-04.md) mở rộng tương thích API để giữ cảnh báo đã hết nguyên nhân nhưng còn `awaiting_ack`; không đổi MQTT, firmware hoặc lược đồ SQLite.
- Phần số Giai đoạn 17 đã tích hợp bằng Mosquitto thật trên loopback, Fastify, SQLite file, Vite proxy, API/CSRF, SSE, lệnh có ACK, desired/reported config và các tình huống sai schema/state cũ/trùng bản tin/mất broker. Runner đạt **15/15**, trong đó outbox phục hồi qua **3 chu kỳ broker thật**; thiết bị đầu cuối là **MÔ PHỎNG**, không phải bằng chứng board thật.
- Hồi quy hiện tại đạt **28/28 kiểm thử server** và **31/31 kiểm thử web**. Nhóm chịu lỗi riêng đạt **6/6**, gồm timeout không báo thành công giả, fuzz MQTT 1.000 payload, tối đa 512 đột biến telemetry, soak reconnect 25 chu kỳ và hiển thị `unknown`; host codec UNO/ESP32 cũng loại khung bị cắt hoặc hỏng một bit. Đây là hardening phần mềm, không thay cổng UART/board.
- Hai firmware đã build-only lại thành công bằng công cụ G17; tiền kiểm máy phát triển, snapshot/so sánh COM, biên bản Checkpoint 1 chờ duyệt, thu serial có timeout, upload có xác nhận, che log và phiếu bằng chứng đã sẵn sàng. Hồi quy công cụ đạt **14/14** bằng fixture/`-WhatIf`, gồm cả đối chiếu che log, không mở serial hay nạp board. Chưa có board nào được nạp hoặc đo trong G17.
- Phần chuẩn bị sớm cho G18 đã ánh xạ đủ 32 ca và tiền kiểm KT19–KT21 đạt build + 15/15 test server chọn lọc + 13/13 test web chọn lọc + loopback 15/15. Đây chỉ là `PREFLIGHT_PASS`; Ma trận không đổi và G18 chưa mở.

## Tài liệu chuẩn hiện hành

- [Quy trình dự án](./docs/00-quy-trinh-du-an.md): 29 giai đoạn; không thay đổi bởi CR-01.
- [Đặc tả hệ thống 1.2](./docs/01-dac-ta-he-thong-v1.2.md): **đã duyệt ngày 26/09/2026**; 16 chức năng A, 1 B, 1 C.
- [Ma trận truy vết và kiểm thử 1.2](./docs/02-ma-tran-kiem-thu-v1.2.md): **đã duyệt ngày 26/09/2026**; 32 ca đang áp dụng và toàn bộ kết quả là `CHƯA THỰC HIỆN`.
- [Danh mục phần cứng 1.2](./docs/03-danh-muc-phan-cung-v1.2.md): **đã duyệt ngày 26/09/2026**; không có danh sách mua, cáp và đồng hồ đã được xác nhận.
- [Kiểm soát thay đổi CR-01](./docs/04-kiem-soat-thay-doi-CR-01.md): **đã duyệt ngày 26/09/2026**.
- [Kiểm soát thay đổi CR-02](./docs/04-kiem-soat-thay-doi-CR-02.md): **đã duyệt ngày 26/09/2026**; giới hạn sản phẩm theo phần cứng/hạ tầng đang có.
- [Kiến trúc hệ thống 1.1](./docs/05-kien-truc-he-thong-v1.1.md): **đã duyệt ngày 26/09/2026**; giữ ranh giới logic, cập nhật cơ cấu mô phỏng.
- [Thiết kế UML 1.1](./docs/06-thiet-ke-uml-v1.1.md): **đã duyệt ngày 26/09/2026**; cập nhật `DK-02`, `AN-06`, `KT39`.
- [Thiết kế phần cứng 1.0](./docs/07-thiet-ke-phan-cung-v1.0.md): **đã duyệt ngày 26/09/2026**; pinout, hai rail USB, chuyển mức, ngân sách dòng và cổng an toàn.
- [Giao thức UNO ↔ ESP32 1.0](./docs/08-giao-thuc-uno-esp32-v1.0.md): **đã duyệt ngày 26/09/2026**; UART 19200 8N1, COBS + CRC-16, mô hình ESP32 làm chủ, ACK/NACK và đồng bộ.
- [Thiết kế MQTT 1.0](./docs/09-thiet-ke-mqtt-v1.0.md): **đã duyệt ngày 26/09/2026**; cây chủ đề, JSON, QoS, retain, LWT, ACL và đồng bộ ngoại tuyến.
- [Thiết kế dữ liệu 1.0](./docs/10-thiet-ke-du-lieu-v1.0.md): **đã duyệt ngày 26/09/2026**; mô hình dữ liệu, cơ sở dữ liệu, lưu trữ, chống trùng và khoảng trống ngoại tuyến.
- [Thiết kế giao diện 1.0](./docs/11-thiet-ke-giao-dien-v1.0.md): **đã duyệt ngày 26/09/2026**; bố cục web, luồng thao tác, trạng thái chờ/lỗi/ngoại tuyến và quy tắc hiển thị mô phỏng.
- [Cấu trúc dự án 1.0](./docs/12-cau-truc-du-an-v1.0.md): **đã duyệt ngày 26/09/2026**; cây thư mục, quy ước mô-đun, cấu hình môi trường và file nền tảng.
- [Lập trình Arduino UNO 1.0](./docs/13-lap-trinh-arduino-uno-v1.0.md): **đã duyệt ngày 26/09/2026**; build AVR thành công, flash 51,9% và RAM tĩnh 53,1%; chưa chạy board.
- [Lập trình ESP32 1.0](./docs/14-lap-trinh-esp32-v1.0.md): **đã duyệt ngày 26/09/2026**; UART chủ, Wi-Fi/MQTT, NVS, LittleFS queue, đồng bộ và phục hồi kết nối; build ESP32 thành công.
- [Xây dựng MQTT 1.0](./docs/15-xay-dung-mqtt-v1.0.md): **đã duyệt ngày 26/09/2026**; Mosquitto 2.1.x, tài khoản, ACL tối thiểu, persistence, giới hạn và 8 smoke test cục bộ.
- [Xây dựng máy chủ 1.0](./docs/16-xay-dung-may-chu-v1.0.md): **đã duyệt ngày 28/09/2026**; Fastify, MQTT.js, schema chặt, xác thực/CSRF, API/SSE, vòng đời ACK và 13 kiểm thử mô-đun. Kho dữ liệu tạm được thay bằng SQLite ở Giai đoạn 15.
- [Xây dựng cơ sở dữ liệu 1.0](./docs/17-xay-dung-co-so-du-lieu-v1.0.md): **đã duyệt ngày 28/09/2026**; SQLite 3.53.4, migration bất biến, repository bền vững, inbox/outbox, retention, backup/restore và 22 kiểm thử phần mềm.
- [Xây dựng ứng dụng web 1.0](./docs/18-xay-dung-ung-dung-web-v1.0.md): **đã duyệt ngày 29/09/2026**; tám tuyến, API/SSE, xác thực/CSRF, lệnh có ACK, cấu hình, cảnh báo nhiều nguyên nhân, lịch sử, nhật ký, responsive/a11y và 30 kiểm thử web.
- [Tích hợp hệ thống 1.0](./docs/19-tich-hop-he-thong-v1.0.md): **đang thực hiện**; ma trận phiên bản và chuỗi phần mềm đã xác minh bằng thiết bị mô phỏng, còn chờ nguồn/mức logic, nạp board, UART, Wi-Fi và đầu-cuối vật lý.
- [Phiếu bằng chứng phần cứng G17](./docs/19a-phieu-bang-chung-phan-cung.md): biểu mẫu nhận dạng board, COM, số đo nguồn/mức logic, log và `command_id`; toàn bộ cổng vật lý vẫn `CHƯA THỰC HIỆN`.
- [Chuẩn bị kiểm thử phần mềm 1.0](./docs/20-chuan-bi-kiem-thu-phan-mem-v1.0.md): **chuẩn bị sớm, không mở G18**; phân loại đủ 32 ca thành phần mềm tự động, trình duyệt thủ công, hybrid, phần cứng chính và có điều kiện.

Đặc tả/Ma trận/Danh mục 1.1 và Kiến trúc/UML 1.0 là lịch sử đã duyệt trước CR-02; không dùng ánh xạ servo/motor cũ cho triển khai hiện hành.

## Phần cứng cơ sở

- Bộ **BLK UNO R3 và 55+ mạch điện tử cơ bản** theo danh sách nhà bán đã được chấp nhận làm căn cứ kiểm kê.
- **ESP32 DevKit V1 30 chân, ESP-WROOM-32, flash 4 MB, CH340C, USB Type-C, EN/BOOT, anten PCB, header đã hàn**.
- Kit đã công bố LDR, SRF04, MQ-2, cảm biến lửa, cảm biến âm thanh, còi, LED, linh kiện rời, breadboard và dây; servo, động cơ, relay có trong kit nhưng không được nối ở bản 1.2.
- Không có linh kiện điện tử nào được đưa vào danh sách mua. DHT22/AM2302, MC-38, SW-420, bàn phím 4×4 và RTC được ghi `KHÔNG_DÙNG` theo quyết định phạm vi.
- Adapter 12 V + AMS1117 không dùng. UNO/ESP32 cấp riêng qua USB; sạc 5 V/3 A chỉ có thể cấp trực tiếp cho ESP32 qua USB-C, không làm rail tải chung.
- Người dùng đã xác nhận có cáp USB-B, USB-C và đồng hồ vạn năng; các phép đo thực tế vẫn chưa thực hiện.

## Nguyên tắc quản lý thay đổi

1. **Yêu cầu trước, phần cứng sau:** Giai đoạn 1 mô tả hệ thống cần làm gì; Giai đoạn 2 xác định cần linh kiện nào.
2. Chức năng không thể cấp/điều khiển an toàn bằng phần cứng đang có được mô phỏng có nhãn hoặc ngừng theo CR-02; không giữ bằng danh sách mua.
3. Giai đoạn 5 đã loại servo/motor/relay khỏi mạch và giữ cổng đo cho nguồn USB, MQ-2, còi và mức logic.
4. Mã chức năng và mã kiểm thử không được tái sử dụng cho ý nghĩa khác.
5. Chỉ khi người dùng quyết định thay phạm vi mới mở lại Giai đoạn 1 theo quản lý phiên bản.

## Điểm dừng

CR-02 và bộ tài liệu Giai đoạn 1–13 đã được duyệt ngày 26/09/2026; Giai đoạn 14, CR-03 và Giai đoạn 15 được duyệt ngày 28/09/2026; Giai đoạn 16 và CR-04 được duyệt ngày 29/09/2026. Dự án đang ở Giai đoạn 17 — Tích hợp: runner loopback chịu lỗi đạt **15/15** với nhãn **MÔ PHỎNG**, hồi quy chịu lỗi riêng đạt **6/6** và công cụ chuẩn bị board đã sẵn sàng, nhưng Giai đoạn chưa đóng vì chưa có dữ liệu thực nghiệm phần cứng. Nạp board, đo nguồn/mức UART, Wi-Fi từ ESP32 và thử mạch chưa thực hiện. MQ-2, cảm biến lửa và còi mặc định bị vô hiệu hóa cho đến khi qua cổng đo; servo, motor và relay không được nối trong bản 1.2.

## Nguyên tắc học thuật

- Phân biệt yêu cầu, thiết kế đề xuất, mô phỏng, công việc đã làm và kết quả thực nghiệm.
- Không bịa số liệu, ảnh, khả năng module, trạng thái phần cứng hoặc kết quả kiểm thử.
- Chỉ đánh dấu `ĐẠT` khi có kết quả thật và minh chứng.
- MQ-2/cảm biến lửa chỉ phục vụ mô hình giáo dục; không tuyên bố ppm hoặc chứng nhận an toàn thương mại khi chưa có căn cứ.
- Chỉ đưa tài liệu thực sự được trích dẫn vào danh mục tham khảo cuối.
