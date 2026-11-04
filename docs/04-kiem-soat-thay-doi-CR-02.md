# KIỂM SOÁT THAY ĐỔI CR-02 — GIỚI HẠN SẢN PHẨM THEO PHẦN CỨNG VÀ HẠ TẦNG NGUỒN ĐANG CÓ

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Mã thay đổi | CR-02 |
| Ngày lập | 26/09/2026 |
| Trạng thái | **ĐÃ DUYỆT — 26/09/2026** |
| Yêu cầu nguồn | Chỉ dùng bộ BLK UNO R3 55+, ESP32 đã có và phụ kiện/hạ tầng nguồn, cáp người dùng đã xác nhận đang có |
| Tài liệu bị tác động | Đặc tả, ma trận kiểm thử, danh mục phần cứng, kiến trúc, UML, thiết kế phần cứng, README |

## 2. Quyết định phạm vi

1. Không mua thêm module chức năng, nguồn riêng, mạch USB-C tách nguồn hoặc tầng công suất chỉ để duy trì chức năng cũ.
2. Hai board được cấp nguồn riêng qua cổng USB sẵn có; chỉ nối chung GND và các đường tín hiệu đã chuyển mức. Không nối chung hai đường 5 V USB và không lấy dòng tải động đi xuyên qua UNO hoặc ESP32.
3. LDR, SRF04, MQ-2, cảm biến lửa, nút nhấn, LED và tầng chuyển mức dùng linh kiện trong kit được giữ để triển khai thật sau khi đạt các cổng đo Giai đoạn 5.
4. Còi được giữ ở bản thực tế nếu dòng đo của nhánh còi không vượt 50 mA và tổng dòng phía UNO không vượt ngân sách USB. Nếu không đạt, cảnh báo cục bộ bắt buộc dùng LED; âm báo được ghi rõ là không triển khai, không giả kết quả.
5. Servo SG90, động cơ DC và relay không được dùng trong bản triển khai vật lý chính: hạ tầng hiện có không cung cấp một rail tải 5 V tách riêng, có đầu nối/phân phối nguồn đã chứng minh an toàn. Adapter 12 V + AMS1117 không được dùng để thay thế.
6. Quạt được mô phỏng bằng LED riêng và trạng thái phần mềm. Khóa cửa được mô phỏng bằng LED riêng và trạng thái phần mềm. Giao diện, nhật ký và báo cáo phải luôn gắn nhãn `MÔ_PHỎNG`; không mô tả motor quay, servo chuyển động, cửa/chốt cơ khí hoặc relay đã đóng.
7. Không thay đổi mục tiêu IoT, kiến trúc UNO–ESP32–MQTT–máy chủ–web, ba trạng thái phòng, quy tắc ưu tiên, hoạt động ngoại tuyến, an ninh SRF04 hoặc an toàn MQ-2/cảm biến lửa.

## 3. Quyết định mã và phiên bản

| Thành phần | Quyết định |
|---|---|
| `DK-01` | Ngừng áp dụng vì ý nghĩa cũ bao gồm quạt/động cơ vật lý. Không tái sử dụng. |
| `DK-02` | Mã mới: điều khiển đèn thật và quạt mô phỏng bằng LED/trạng thái phần mềm. |
| `AN-02` | Ngừng áp dụng vì ý nghĩa cũ là khóa/mở bằng servo. Không tái sử dụng. |
| `AN-06` | Mã mới: mô phỏng trạng thái khóa/mở, vẫn giữ chính sách truy cập và ACK/NACK. |
| `KT37` | Ngừng áp dụng; đây là kiểm thử servo vật lý. |
| `KT39` | Mã mới: kiểm thử khóa/mở mô phỏng và nhãn mô phỏng. |
| KT03, KT04, KT09, KT24 | Giữ mã vì hành vi nghiệp vụ không đổi; cập nhật phương tiện quan sát từ motor/servo sang LED, trạng thái báo cáo và nhật ký có nhãn mô phỏng. |

Đặc tả, ma trận kiểm thử và danh mục phần cứng 1.1 được bảo lưu làm lịch sử. CR-02 đã tạo và được duyệt cùng các bản 1.2; Kiến trúc và UML 1.1 cũng đã được duyệt vì trách nhiệm logic không đổi nhưng ánh xạ cơ cấu chấp hành thay đổi.

## 4. Đánh giá an toàn nguồn

| Nhóm | Kết luận Giai đoạn 5 | Cách triển khai |
|---|---|---|
| UNO, LDR, SRF04, MQ-2, cảm biến lửa, LED, nút, chuyển mức UART | Có thể thiết kế trong ngân sách USB 5 V với giới hạn dòng và đo xác nhận | Triển khai vật lý |
| Còi 5 V | Có điều kiện; chỉ dùng qua C1815 và khi dòng nhánh ≤ 50 mA | Vật lý có cổng đo; nếu không đạt dùng LED cảnh báo |
| ESP32 | Cấp riêng qua USB Type-C 5 V; không dùng làm điểm phân phối tải | Triển khai vật lý |
| Servo SG90 | Không có rail tải tách riêng đã chứng minh; dòng đỉnh/kẹt không phù hợp cấp qua board USB | Không nối; AN-06 mô phỏng bằng LED/phần mềm |
| Động cơ 3–6 V | Dòng khởi động/kẹt chưa đo và không có rail tải riêng | Không nối; quạt mô phỏng bằng LED/phần mềm |
| Relay 5 V | Không còn tải vật lý cần đóng/cắt; dùng relay sẽ tăng dòng và rủi ro nguồn nhưng không tạo giá trị kiểm thử cần thiết | Không nối trong bản chính |
| Adapter 12 V + AMS1117 5 V | Tổn hao nhiệt không phù hợp cho rail tải | Không dùng cho sản phẩm |
| Sạc USB-C 5 V/3 A | Có thể cấp trực tiếp cho ESP32 qua cổng USB-C; không được coi là rail 5 V hệ thống nếu không có phần tử tách/phân phối nguồn sẵn có | Hạ tầng cấp board, không cấp tải động |

## 5. Tác động và tiêu chí nhất quán

- Số chức năng hoạt động vẫn là **18: 16 nhóm A, 1 nhóm B, 1 nhóm C**.
- Số kiểm thử đang áp dụng vẫn là **32: 30 bắt buộc, 2 có điều kiện**; tất cả kết quả thực tế tiếp tục là `CHƯA THỰC HIỆN`.
- Báo cáo phải phân biệt rõ phần cứng thật, cơ cấu mô phỏng và kết quả chưa kiểm thử.
- Mọi sơ đồ/chú thích hiện hành phải dùng `DK-02`, `AN-06`, quạt mô phỏng và khóa mô phỏng; các bản cũ chỉ là lịch sử.
- Không có danh sách mua mới và không có tuyên bố servo, motor hoặc relay đã hoạt động.

## 6. Điểm duyệt

CR-02 đã được người dùng duyệt ngày 26/09/2026 sau khi kiểm tra chéo xác nhận không còn mã cũ trong phạm vi hiện hành, mọi chức năng nhóm A có phần cứng thật hoặc mô phỏng được gắn nhãn và mọi kiểm thử có truy vết. Thay đổi phạm vi sau mốc này phải lập yêu cầu thay đổi mới.
