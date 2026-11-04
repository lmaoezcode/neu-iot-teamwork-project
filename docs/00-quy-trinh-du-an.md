# QUY TRÌNH THỰC HIỆN DỰ ÁN PHÒNG THÔNG MINH

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Tên tài liệu | Quy trình thực hiện dự án phòng thông minh |
| Phiên bản | 1.0 |
| Trạng thái | Áp dụng |
| Phạm vi | Toàn bộ vòng đời phân tích, thiết kế, triển khai, kiểm thử và báo cáo |
| Mốc hiện tại | Giai đoạn 17 — phần mềm toàn chuỗi đã xác minh bằng thiết bị mô phỏng; chờ tích hợp board/UART/Wi-Fi thật |

## 2. Nguyên tắc phân công

Áp dụng nguyên tắc **“GPT làm phần số, người dùng thực hiện phần vật lý”**.

### 2.1. GPT chịu trách nhiệm trực tiếp

- phân tích và quản lý yêu cầu;
- thiết kế kiến trúc, UML, mạch logic, giao thức UNO–ESP32, MQTT và dữ liệu;
- tạo mã nguồn hoàn chỉnh cho Arduino UNO, ESP32, MQTT, máy chủ, cơ sở dữ liệu, ứng dụng web và kiểm thử tự động;
- tạo sơ đồ bằng nguồn tái tạo được khi phù hợp;
- kiểm tra cú pháp, logic, thư viện, kiểu dữ liệu, tài nguyên, xung đột chân, mức điện áp, nguồn và các tình huống lỗi;
- tạo tài liệu dựng hệ thống, hướng dẫn vận hành, kế hoạch kiểm thử và kịch bản trình diễn;
- phân tích bằng chứng người dùng cung cấp, sửa trực tiếp file liên quan và hướng dẫn thử lại;
- viết báo cáo hoàn chỉnh sau khi thiết kế và kết quả thực tế đã đủ.

GPT không chuyển ngược cho người dùng các công việc phần mềm mà GPT có thể tự thực hiện.

### 2.2. Người dùng chịu trách nhiệm phần bắt buộc phải tương tác vật lý hoặc riêng tư

- cung cấp hoặc xác nhận căn cứ kiểm kê (danh sách nhà sản xuất, tên/số lượng hoặc ảnh khi cần); trong Giai đoạn 2 hiện hành, người dùng đã chọn bộ BLK UNO R3 55+ làm phần cứng cơ sở và chấp nhận cấu hình nhà bán làm căn cứ kiểm kê;
- cắm dây, đấu mạch, lắp cơ khí, cấp nguồn và cắm USB;
- cung cấp thông tin riêng như Wi-Fi/mật khẩu bằng cơ chế cấu hình thích hợp;
- nạp firmware khi môi trường không cho phép GPT điều khiển board;
- tạo các kích thích thử nghiệm thực tế như thay đổi ánh sáng, đưa vật thể vào vùng SRF04, quan sát LED mô phỏng và tín hiệu khí/lửa thử an toàn; không chạy servo/động cơ/relay trong bản 1.2;
- chụp ảnh, lưu log, ghi phép đo và gửi kết quả thực tế;
- xác nhận các quyết định làm thay đổi phạm vi hoặc kiến trúc nền tảng.

## 3. Quy trình 29 giai đoạn

| Giai đoạn | Tên | Đầu ra/điểm kiểm soát chính |
|---:|---|---|
| 1 | Chốt đặc tả hệ thống | Phiên bản đặc tả hiện hành, nhóm A/B/C, trạng thái, xung đột, quy tắc ưu tiên; phải được người dùng duyệt trước khi tiếp tục. |
| 2 | Kiểm kê phần cứng | Phiên bản danh mục phần cứng hiện hành: có trong kit, đã chọn model, chờ xác nhận thực tế, chờ Giai đoạn 5 xác minh hoặc không dùng; căn cứ có thể là danh sách nhà sản xuất được người dùng chấp nhận, tên/số lượng hoặc ảnh khi có sai khác. |
| 3 | Thiết kế kiến trúc | Kiến trúc UNO ↔ ESP32 ↔ Wi-Fi ↔ MQTT ↔ máy chủ ↔ cơ sở dữ liệu ↔ ứng dụng và sơ đồ tương ứng. |
| 4 | Thiết kế UML | Tác nhân, trường hợp sử dụng, đặc tả, hoạt động, tuần tự và trạng thái. |
| 5 | Thiết kế phần cứng | Chân, nguồn, mức logic, tải, driver, cảm biến, bảo vệ và sơ đồ nối dây; đánh giá servo/relay nếu thuộc phạm vi; kiểm tra xung đột chân. |
| 6 | Thiết kế giao tiếp UNO–ESP32 | Tốc độ, khung bản tin, loại thông điệp, giới hạn kích thước, kiểm lỗi, xác nhận và phục hồi đồng bộ. |
| 7 | Thiết kế MQTT | Cây chủ đề, tải tin, chiều truyền, QoS, retain, khả dụng, xác nhận và mất kết nối. |
| 8 | Thiết kế dữ liệu | Lược đồ cơ sở dữ liệu, dữ liệu cảm biến, trạng thái, cấu hình, sự kiện, cảnh báo, thời hạn lưu. |
| 9 | Thiết kế giao diện | Bố cục, trang, thành phần, luồng sử dụng, trạng thái chờ/lỗi/ngoại tuyến và cảnh báo. |
| 10 | Tạo cấu trúc dự án | Cây thư mục và file cơ sở có mục đích, lệnh chạy và quy ước rõ ràng. |
| 11 | Lập trình Arduino UNO | Firmware hoàn chỉnh, không chặn khi phù hợp; kiểm tra và sửa dựa trên biên dịch/thử thật. |
| 12 | Lập trình ESP32 | Wi-Fi, MQTT, nối tiếp, NVS, đồng bộ, hàng đợi ngoại tuyến và phục hồi kết nối. |
| 13 | Xây dựng MQTT | Cấu hình bộ môi giới cụ thể, xác thực, tài khoản, lệnh chạy và lệnh thử gửi/nhận. |
| 14 | Xây dựng máy chủ | Mã máy chủ hoàn chỉnh để nhận MQTT, quản lý trạng thái/cấu hình, cung cấp API và theo dõi thiết bị. |
| 15 | Xây dựng cơ sở dữ liệu | Lược đồ, migration/câu lệnh tạo, mã truy cập, lưu trữ và dọn dữ liệu hết hạn. |
| 16 | Xây dựng ứng dụng web | Giao diện tiếng Việt thích ứng cho máy tính/điện thoại, đầy đủ các màn hình đã chốt. |
| 17 | Tích hợp | Tích hợp UNO, ESP32, MQTT, máy chủ, cơ sở dữ liệu và web; ghi rõ phiên bản tương thích. |
| 18 | Kiểm thử phần mềm | Mã kiểm thử cho API, dữ liệu, cơ sở dữ liệu, giao diện phù hợp và bộ mô phỏng bản tin/thiết bị. |
| 19 | Kiểm thử phần cứng | GPT tạo kịch bản; người dùng thực hiện và gửi bằng chứng; GPT phân tích và cập nhật kết quả. |
| 20 | Tinh chỉnh hệ thống | Sửa logic, ổn định, reconnect, giao diện, cấu hình và tình huống biên có bằng chứng. |
| 21 | Chốt sản phẩm | Sản phẩm 1.0; thay đổi sau mốc này phải qua kiểm soát thay đổi. |
| 22 | Viết Chương 1 | Nội dung hoàn chỉnh theo mẫu và phạm vi sản phẩm đã chốt. |
| 23 | Viết Chương 2 | Cơ sở lý thuyết từ nguồn đáng tin cậy, có trích dẫn thực sự được dùng. |
| 24 | Viết Chương 3 | Phân tích và thiết kế đúng kiến trúc, linh kiện, giao thức, UML và thuật toán cuối cùng. |
| 25 | Viết Chương 4 | Triển khai, mã, ảnh, số liệu và kiểm thử thật; phần chưa thực hiện phải ghi rõ. |
| 26 | Kết luận | Kết luận dựa trên kết quả thực tế, giới hạn và hướng phát triển. |
| 27 | Tài liệu tham khảo | Đối chiếu từng trích dẫn; chỉ giữ nguồn thực sự xuất hiện trong báo cáo. |
| 28 | Rà soát toàn bộ | Nội dung, thuật ngữ, định dạng, trích dẫn, sơ đồ, mã, chân, MQTT, số liệu và tính nhất quán. |
| 29 | Chuẩn bị trình bày | Kịch bản demo, câu hỏi dự kiến, câu trả lời và phần giải thích các quyết định kiến trúc. |

Không nhảy giai đoạn khi đầu ra trước đó là điều kiện đầu vào của giai đoạn sau. Mô phỏng có thể được thực hiện sớm để giảm rủi ro nhưng phải được gắn nhãn **mô phỏng**, không thay cho kết quả phần cứng.

## 4. Quy tắc quản lý phiên bản và thay đổi

1. Mỗi tài liệu thiết kế chính có phiên bản riêng, ví dụ: Đặc tả 1.0, Kiến trúc 1.0, Phần cứng 1.0, Giao thức 1.0, MQTT 1.0 và Sản phẩm 1.0.
2. Trước khi một bản được duyệt, chỉnh sửa được ghi trong lịch sử của chính phiên bản đang chờ duyệt; không tự tăng phiên bản chỉ vì sửa bản nháp.
3. Sau khi duyệt, thay đổi làm đổi hành vi, giao diện, phần cứng, giao thức hoặc tiêu chí chấp nhận phải có: nội dung thay đổi, lý do, thành phần bị ảnh hưởng và quyết định phiên bản.
4. Mỗi thay đổi phải rà soát tác động tới mã, sơ đồ, bảng thiết bị, UML, giao thức, cơ sở dữ liệu, giao diện, kiểm thử và báo cáo.
5. Tài liệu nguồn chuẩn phải được xác định rõ; không duy trì hai bản mô tả cùng một thiết kế nhưng khác nội dung.

## 5. Quy tắc mã nguồn và tự kiểm tra

- Mã triển khai phải hoàn chỉnh; mã giả chỉ dùng trong phân tích/thuật toán của báo cáo.
- Không để `TODO` thay cho chức năng, trừ dữ liệu riêng hoặc giá trị chỉ có thể biết sau thao tác vật lý; các giá trị đó phải nằm trong cấu hình/mẫu môi trường phù hợp.
- Tránh `delay` dài làm treo vòng lặp; ưu tiên lịch dựa trên thời gian và xử lý không chặn.
- Sau mỗi thành phần phải kiểm tra trong khả năng của môi trường: cú pháp/biên dịch, kiểm thử, thư viện, biến, kiểu, bộ nhớ, reconnect, khởi động lại, lỗi cảm biến, nguồn tải và mức logic.
- Trạng thái trên giao diện phải đến từ xác nhận/trạng thái báo cáo, không suy ra từ việc đã gửi lệnh.
- Khi người dùng cung cấp lỗi, phải chẩn đoán theo bằng chứng, sửa file liên quan, tự kiểm tra và đưa bước thử lại cụ thể.

## 6. Nguyên tắc học thuật và bằng chứng

- Không bịa số liệu, kết quả, ảnh, log, khả năng cảm biến hoặc trạng thái đã triển khai.
- Mọi phát biểu phải phân biệt: kiến thức từ tài liệu, yêu cầu, thiết kế đề xuất, mô phỏng, công việc đã làm, kết quả thực tế và hướng phát triển.
- Kết quả dự kiến không được viết ở thì đã hoàn thành.
- Kiểm thử chỉ được đánh dấu `ĐẠT`/`KHÔNG ĐẠT` khi có dữ liệu thực tế và vị trí minh chứng.
- MQ-2 và cảm biến lửa trong mô hình chỉ minh họa nguyên lý; không tuyên bố đạt chuẩn thiết bị báo cháy/báo gas thương mại và không suy diễn ppm khi chưa hiệu chuẩn đúng quy trình.
- Báo cáo cuối phải khớp tên linh kiện, chân, topic, màn hình, chức năng và kiểm thử của sản phẩm thật.

## 7. Điểm dừng hiện tại

Đặc tả/Ma trận/Danh mục 1.2, CR-02, Kiến trúc/UML 1.1, Thiết kế phần cứng 1.0, Giao thức UNO ↔ ESP32 1.0, Thiết kế MQTT 1.0, Thiết kế dữ liệu 1.0, Thiết kế giao diện 1.0, Cấu trúc dự án 1.0, Firmware UNO/ESP32 1.0 và Xây dựng MQTT 1.0 đã được duyệt ngày 26/09/2026. Máy chủ 1.0, CR-03 và Cơ sở dữ liệu 1.0 được duyệt ngày 28/09/2026. Ứng dụng web 1.0 và CR-04 được duyệt ngày 29/09/2026 sau khi tái xác minh checker G16, 30/30 kiểm thử web, 23/23 kiểm thử máy chủ và hai bản build. Giai đoạn 1–16 đã khóa. Ở Giai đoạn 17, manifest tương thích và chuỗi Mosquitto → server → SQLite → API/SSE → Vite đã được xác minh **15/15** bằng thiết bị **MÔ PHỎNG**, gồm sai schema, state cũ, bản tin trùng và 3 chu kỳ mất/kết nối lại broker thật; đây không phải bằng chứng phần cứng. Hồi quy hiện tại đạt 28/28 test server, 31/31 test web và nhóm chịu lỗi 6/6 với fuzz MQTT, timeout lệnh, 25 chu kỳ reconnect lớp dịch vụ cùng codec host khung UART hỏng. Hai firmware đã build-only lại thành công; tiền kiểm máy phát triển đạt `PREPARATION_READY`, bộ snapshot/diff COM, upload có xác nhận, che log và phiếu bằng chứng đã sẵn sàng, nhưng toàn bộ biên bản vẫn ghi `hardware_evidence=false`. Bản đồ chuẩn bị sớm G18 đã phủ đủ 32 ca và tiền kiểm KT19–KT21 đạt, nhưng chỉ mang trạng thái `PREFLIGHT_PASS`; Ma trận không đổi. Nạp board, đo điện, UART thật và kết nối Wi-Fi/MQTT từ ESP32 vẫn chưa thực hiện, nên Giai đoạn 17 chưa đóng và chưa chuyển Giai đoạn 18. Servo, motor và relay không nối; MQ-2, cảm biến lửa và còi mặc định bị vô hiệu hóa bằng cờ biên dịch cho đến khi các cổng vật lý tương ứng đạt.
