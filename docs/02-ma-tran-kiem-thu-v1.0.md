# MA TRẬN KIỂM THỬ HỆ THỐNG PHÒNG THÔNG MINH — PHIÊN BẢN 1.0

> **TÀI LIỆU LỊCH SỬ — ĐÃ ĐƯỢC THAY THẾ BỞI [MA TRẬN KIỂM THỬ 1.1](./02-ma-tran-kiem-thu-v1.1.md). KHÔNG CHẠY CÁC KIỂM THỬ PHỤ THUỘC LINH KIỆN ĐÃ LOẠI.**

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 1.0 |
| Trạng thái | **ĐÃ THAY THẾ — CHỈ GIỮ LỊCH SỬ** |
| Đặc tả nguồn | `docs/01-dac-ta-he-thong-v1.0.md` |
| Số trường hợp | 35, gồm 31 bắt buộc và 4 có điều kiện |
| Quy tắc kết quả | Chỉ điền ĐẠT/KHÔNG ĐẠT khi có bằng chứng thật; hiện tất cả là `CHƯA THỰC HIỆN` |

## 2. Quy ước đánh giá và bằng chứng

- **ĐẠT:** mọi tiêu chí bắt buộc của trường hợp đều thỏa và có minh chứng truy xuất được.
- **KHÔNG ĐẠT:** ít nhất một tiêu chí bắt buộc sai hoặc thiếu hành vi an toàn; phải ghi mã lỗi/liên kết minh chứng.
- **BỊ CHẶN:** chỉ dùng lúc thực thi nếu thiếu điều kiện ngoài kiểm soát; không được đổi thành ĐẠT.
- **KHÔNG ÁP DỤNG:** chỉ cho KT32–KT35 khi chức năng tương ứng chính thức không được triển khai; phải có quyết định phạm vi.
- **CHƯA THỰC HIỆN:** giá trị duy nhất được phép ở cột kết quả hiện tại.

Mỗi minh chứng sau này phải nằm trong thư mục kiểm thử được thiết kế ở Giai đoạn 10 và có tối thiểu: thời gian, phiên bản mã/cấu hình, log hoặc ảnh/video phù hợp và người thực hiện phần vật lý nếu có.

## 3. Truy vết chức năng nhóm A

| Chức năng bắt buộc | Trường hợp kiểm thử chính |
|---|---|
| MT-01 | KT01, KT14, KT15 |
| MT-02 | KT02 |
| DK-01 | KT03, KT04, KT18 |
| TD-01 | KT05, KT14 |
| TD-02 | KT06, KT14 |
| CD-01 | KT04, KT11 |
| CD-02 | KT09, KT10, KT11 |
| CH-01 | KT07, KT08, KT16, KT26 |
| AN-01 | KT23, KT31 |
| AN-02 | KT22, KT24 |
| AT-01 | KT25, KT26, KT28, KT31 |
| AT-02 | KT27, KT28, KT31 |
| CB-01 | KT12, KT13, KT29, KT30 |
| MN-01 | KT14, KT15, KT16, KT17, KT18, KT31 |
| UD-01 | KT03, KT19 |
| DL-01 | KT20, KT21, KT30 |
| BC-01 | KT21 |

## 4. Trường hợp kiểm thử bắt buộc

### KT01 — Đọc và hiển thị dữ liệu môi trường

- **Chức năng truy vết:** MT-01, UD-01, DL-01.
- **Mục đích:** Xác minh nhiệt độ, độ ẩm và mức sáng hợp lệ đi trọn chuỗi UNO → ESP32 → máy chủ → ứng dụng.
- **Trạng thái ban đầu:** Hệ thống trực tuyến, cảm biến đã kiểm kê/cấu hình, không có lỗi.
- **Đầu vào/điều kiện thử:** Môi trường ổn định; tối thiểu ba chu kỳ lấy mẫu; thay đổi ánh sáng quan sát được.
- **Các bước:** Khởi động; theo dõi Serial UNO/ESP32; mở Tổng quan; che/mở quang trở; đối chiếu giá trị, thời điểm và chất lượng.
- **Kết quả mong đợi:** Ba giá trị có đơn vị, mức sáng 0–100%, cập nhật ứng dụng ≤ 5 giây trong mạng bình thường và không có giá trị giả khi đọc lỗi.
- **Nơi lấy minh chứng:** Log nối tiếp, bản tin mạng, ảnh Tổng quan và bản ghi dữ liệu.
- **Tiêu chí đạt/không đạt:** Đạt khi đủ ba đại lượng, luồng/thời gian/chất lượng khớp; không đạt nếu thiếu, sai miền hoặc giao diện trình bày dữ liệu lỗi như hợp lệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT02 — Phát hiện lỗi và dữ liệu môi trường cũ

- **Chức năng truy vết:** MT-02, TD-01, TD-02.
- **Mục đích:** Xác minh dữ liệu sai không tiếp tục điều khiển Tự động vô thời hạn.
- **Trạng thái ban đầu:** Tự động, Ở nhà, ít nhất một tải đang bật bởi quy tắc; cảm biến hợp lệ.
- **Đầu vào/điều kiện thử:** Mô phỏng/thực hiện ba lần đọc lỗi liên tiếp và mất mẫu hợp lệ > 15 giây.
- **Các bước:** Gây lỗi cảm biến có kiểm soát; ghi thời điểm; quan sát chất lượng; chờ hết ân hạn 30 giây; phục hồi cảm biến.
- **Kết quả mong đợi:** Không hợp lệ/Cũ được hiển thị; quy tắc liên quan giữ tối đa 30 giây rồi dừng và tắt tải do Tự động; tạo một sự kiện lỗi và một sự kiện phục hồi.
- **Nơi lấy minh chứng:** Log UNO, trạng thái tải, ứng dụng, nhật ký máy chủ.
- **Tiêu chí đạt/không đạt:** Đạt khi mốc 15/30 giây và phân loại đúng; không đạt nếu dùng số đo lỗi, lặp nhật ký mỗi chu kỳ hoặc tắt tải Thủ công không liên quan.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT03 — Điều khiển đèn/quạt trong Thủ công

- **Chức năng truy vết:** DK-01, UD-01, DL-01.
- **Mục đích:** Xác minh lệnh có mã, ACK và trạng thái báo cáo thực tế.
- **Trạng thái ban đầu:** Ở nhà, Thủ công, trực tuyến, tải tắt.
- **Đầu vào/điều kiện thử:** Lệnh Bật/Tắt lần lượt cho đèn và quạt.
- **Các bước:** Bấm lệnh; quan sát trạng thái chờ; đối chiếu mã lệnh ở máy chủ/ESP32/UNO; kiểm tra đầu ra; nhận ACK; lặp lại với Tắt.
- **Kết quả mong đợi:** Mỗi lệnh thi hành một lần; giao diện chỉ đổi sau ACK/trạng thái báo cáo; nhật ký chứa nguồn Thủ công và kết quả.
- **Nơi lấy minh chứng:** Video/ảnh tải, log lệnh/ACK, giao diện và nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi bốn thao tác đúng và không cập nhật lạc quan; không đạt nếu trạng thái giao diện khác thiết bị hoặc lệnh lặp.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT04 — Lệnh trực tiếp khi đang Tự động

- **Chức năng truy vết:** DK-01, CD-01.
- **Mục đích:** Xác minh không có xung đột âm thầm giữa người dùng và quy tắc.
- **Trạng thái ban đầu:** Ở nhà, Tự động, thiết bị trực tuyến.
- **Đầu vào/điều kiện thử:** Người dùng gửi lệnh Bật/Tắt trực tiếp; một lần hủy và một lần xác nhận chuyển Thủ công.
- **Các bước:** Bấm điều khiển; hủy hộp xác nhận; kiểm tra không có lệnh thiết bị; lặp lại và xác nhận; theo dõi phương thức, ACK và tải.
- **Kết quả mong đợi:** Hủy không đổi gì; xác nhận chuyển Thủ công trước/như một giao dịch với lệnh, sau đó tải theo yêu cầu.
- **Nơi lấy minh chứng:** Quay màn hình, log API/MQTT/nối tiếp và trạng thái báo cáo.
- **Tiêu chí đạt/không đạt:** Đạt khi không có lệnh trực tiếp nào thi hành trong Tự động mà thiếu xác nhận; không đạt nếu quy tắc lập tức giành lại tải.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT05 — Vùng trễ và thời gian giữ của quạt

- **Chức năng truy vết:** TD-01.
- **Mục đích:** Xác minh hai ngưỡng quạt ngăn dao động.
- **Trạng thái ban đầu:** Ở nhà, Tự động; ngưỡng bật 30 °C, tắt 28 °C; dữ liệu hợp lệ.
- **Đầu vào/điều kiện thử:** Chuỗi nhiệt độ dưới 28, giữa 28–30, ≥ 30, dao động quanh 30/28.
- **Các bước:** Phát chuỗi bằng mô phỏng được kiểm soát hoặc kích thích thật; ghi quyết định/đầu ra và khoảng thời gian giữa các đổi trạng thái.
- **Kết quả mong đợi:** Bật ở ≥ 30, tắt ở ≤ 28, giữ trong vùng trễ và không đổi lại trước 10 giây trừ lệnh ưu tiên cao.
- **Nơi lấy minh chứng:** Log thuật toán có thời gian, trạng thái quạt và biểu đồ đầu vào thử.
- **Tiêu chí đạt/không đạt:** Đạt khi mọi điểm biên và thời gian giữ đúng; không đạt nếu rung bật/tắt hoặc dùng sai dấu so sánh.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT06 — Vùng trễ và thời gian giữ của đèn

- **Chức năng truy vết:** TD-02.
- **Mục đích:** Xác minh quy tắc ánh sáng 0–100% và vùng trễ.
- **Trạng thái ban đầu:** Ở nhà, Tự động; ngưỡng bật 30%, tắt 50%; dữ liệu hợp lệ.
- **Đầu vào/điều kiện thử:** Chuỗi ánh sáng ≤ 30, giữa 30–50, ≥ 50 và dao động quanh biên.
- **Các bước:** Thay đổi ánh sáng/mô phỏng; ghi mức chuẩn hóa, quyết định và thời điểm đổi.
- **Kết quả mong đợi:** Bật khi ≤ 30%, tắt khi ≥ 50%, giữ trong vùng trễ và tối thiểu 10 giây.
- **Nơi lấy minh chứng:** Log UNO, ảnh/video đèn và chuỗi đầu vào.
- **Tiêu chí đạt/không đạt:** Đạt khi đúng cực tính, điểm biên và chống dao động; không đạt nếu 0% bị hiểu là sáng nhất.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT07 — Xác thực cấu hình theo giao dịch toàn bộ

- **Chức năng truy vết:** CH-01, TD-01, TD-02.
- **Mục đích:** Xác minh cấu hình hợp lệ được áp dụng và cấu hình sai bị từ chối toàn bộ.
- **Trạng thái ban đầu:** Hệ thống trực tuyến với cấu hình phiên bản N.
- **Đầu vào/điều kiện thử:** Một bản hợp lệ; các bản sai phạm vi, sai vùng trễ và sai kiểu.
- **Các bước:** Gửi từng bản; theo dõi kiểm tra máy chủ/ESP32/UNO; đọc phiên bản báo cáo và thử điểm biên tự động hóa.
- **Kết quả mong đợi:** Bản hợp lệ thành N+1 ở cả ba tầng; mỗi bản sai có lỗi cụ thể và toàn bộ bản N+1 hợp lệ trước đó được giữ nguyên.
- **Nơi lấy minh chứng:** Phản hồi API, MQTT desired/reported, NVS/UNO log và giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi không có cập nhật một phần/lệch phiên bản; không đạt nếu trường hợp sai vẫn làm đổi một ngưỡng.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT08 — Giữ cấu hình và trạng thái qua khởi động lại

- **Chức năng truy vết:** CH-01, CD-01, CD-02, MN-01.
- **Mục đích:** Xác minh NVS/cache và trạng thái khởi động an toàn.
- **Trạng thái ban đầu:** Cấu hình không mặc định đã đồng bộ; một hồ sơ/phương thức được chọn; tải đang bật.
- **Đầu vào/điều kiện thử:** Khởi động lại ESP32 rồi khởi động lại toàn hệ thống theo quy trình an toàn.
- **Các bước:** Ghi trạng thái trước; reset; quan sát tải tức thời; đọc NVS/đồng bộ UNO/máy chủ; kiểm tra trạng thái sau.
- **Kết quả mong đợi:** Cấu hình, hồ sơ, phương thức được khôi phục đúng; đèn/quạt bắt đầu Tắt; Tự động chỉ chạy lại sau cấu hình + số đo hợp lệ; Thủ công giữ tải tắt.
- **Nơi lấy minh chứng:** Video khởi động, boot log, phiên bản cấu hình và trạng thái ứng dụng.
- **Tiêu chí đạt/không đạt:** Đạt khi không có xung nguy hiểm/trạng thái cấu hình mất; không đạt nếu tải bật ngoài ý muốn hoặc Tự động chạy bằng dữ liệu chưa hợp lệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT09 — Hồ sơ Ra ngoài

- **Chức năng truy vết:** CD-02, AN-01, AN-02, DK-01.
- **Mục đích:** Xác minh ràng buộc Ra ngoài là liên tục.
- **Trạng thái ban đầu:** Ở nhà, một tải đang bật, cửa ở trạng thái đã biết, không cảnh báo.
- **Đầu vào/điều kiện thử:** Lệnh chuyển Ra ngoài rồi lệnh bật tiện nghi.
- **Các bước:** Chuyển hồ sơ; theo dõi tắt tải, lệnh khóa, vùng bảo vệ và ACK; sau đó yêu cầu bật đèn/quạt.
- **Kết quả mong đợi:** Tải tắt, cửa được yêu cầu khóa, chu vi/xâm nhập trang bị; lệnh tiện nghi bị từ chối. Bất kỳ bước lỗi tạo Suy giảm, không giả thành công.
- **Nơi lấy minh chứng:** Video tải/servo, cảm biến cửa, log giao dịch và giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi các ràng buộc duy trì và lỗi từng phần hiển thị đúng; không đạt nếu có thể bật tiện nghi trực tiếp trong Ra ngoài.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT10 — Hồ sơ Ban đêm và vùng chu vi

- **Chức năng truy vết:** CD-02, AN-01, MR-01 nếu có.
- **Mục đích:** Xác minh Ban đêm bảo vệ chu vi nhưng không báo giả do chuyển động bên trong.
- **Trạng thái ban đầu:** Ở nhà, không cảnh báo, cảm biến chu vi và cảm biến trong phòng/mô phỏng sẵn sàng.
- **Đầu vào/điều kiện thử:** Chuyển Ban đêm; tạo chuyển động bên trong; sau đó mở cửa không được phép.
- **Các bước:** Chuyển hồ sơ; kiểm tra vùng trang bị; kích hoạt hai loại tín hiệu lần lượt.
- **Kết quả mong đợi:** Chuyển động nội bộ không gây báo an ninh; mở cửa chu vi gây cảnh báo; tiện nghi vẫn theo phương thức đang giữ.
- **Nơi lấy minh chứng:** Log vùng, video kích thích, cảnh báo và trạng thái tiện nghi.
- **Tiêu chí đạt/không đạt:** Đạt khi phân vùng đúng; không đạt nếu chuyển động trong phòng làm còi kêu hoặc cửa chu vi bị bỏ qua.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT11 — Trở về Ở nhà và giữ phương thức

- **Chức năng truy vết:** CD-01, CD-02, TD-01, TD-02.
- **Mục đích:** Xác minh không phục hồi mù đầu ra sau hồ sơ bảo vệ.
- **Trạng thái ban đầu:** Thực hiện hai lượt: Ra ngoài + Tự động; Ra ngoài + Thủ công. Tải đều đang bị cưỡng chế tắt.
- **Đầu vào/điều kiện thử:** Lệnh chuyển Ở nhà với cảm biến hợp lệ.
- **Các bước:** Về Ở nhà ở từng lượt; quan sát phương thức, vùng bảo vệ và đầu ra.
- **Kết quả mong đợi:** Giữ phương thức trước; Tự động đánh giá ngay; Thủ công tiếp tục tắt cho đến lệnh mới; cửa không tự mở.
- **Nơi lấy minh chứng:** Log trạng thái/giao dịch và video đầu ra.
- **Tiêu chí đạt/không đạt:** Đạt khi hai nhánh đúng; không đạt nếu phục hồi đầu ra Thủ công cũ hoặc tự mở cửa.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT12 — Độ trễ cảnh báo cục bộ

- **Chức năng truy vết:** AN-01, AT-01, AT-02, CB-01.
- **Mục đích:** Xác minh cảnh báo cục bộ không phụ thuộc mạng và đáp ứng mục tiêu thời gian.
- **Trạng thái ban đầu:** Cảm biến đã sẵn sàng, nguyên nhân tương ứng được trang bị, còi/LED bình thường.
- **Đầu vào/điều kiện thử:** Kích thích thử an toàn đã được chấp thuận và/hoặc mở cửa trái phép.
- **Các bước:** Ghi thời điểm tín hiệu đạt điều kiện xác nhận; đo thời điểm còi/LED kích hoạt; lặp theo nguồn.
- **Kết quả mong đợi:** Còi/LED hoạt động không quá 1 giây sau khi điều kiện phát hiện đã được thỏa; nguyên nhân đúng.
- **Nơi lấy minh chứng:** Video có mốc thời gian/logic analyzer nếu có, log UNO và cảnh báo.
- **Tiêu chí đạt/không đạt:** Đạt khi mọi nguồn bắt buộc trong giới hạn; không đạt nếu phải chờ Internet hoặc gắn sai nguyên nhân.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT13 — Tắt tiếng, hết nguyên nhân và xác nhận

- **Chức năng truy vết:** CB-01.
- **Mục đích:** Xác minh Tắt tiếng không xóa cảnh báo.
- **Trạng thái ban đầu:** Một nguyên nhân đang hoạt động, trạng thái Đang kêu.
- **Đầu vào/điều kiện thử:** Lệnh Tắt tiếng; nguyên nhân hết; lệnh Xác nhận; một nguyên nhân mới sau khi đã tắt tiếng.
- **Các bước:** Tắt tiếng; kiểm tra nguyên nhân còn; tạo nguyên nhân mới; cho mọi nguyên nhân hết; xác nhận.
- **Kết quả mong đợi:** Đã tắt tiếng vẫn giữ cảnh báo; nguyên nhân mới làm kêu lại; chỉ sang Chờ xác nhận khi tất cả hết; chỉ về Bình thường sau xác nhận.
- **Nơi lấy minh chứng:** Video còi, log máy trạng thái và nhật ký ứng dụng.
- **Tiêu chí đạt/không đạt:** Đạt khi đủ chuỗi trạng thái; không đạt nếu tắt tiếng/xóa một nguyên nhân làm mất nguyên nhân khác.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT14 — Mất Wi-Fi/MQTT nhưng logic cục bộ tiếp tục

- **Chức năng truy vết:** MN-01, MT-01, TD-01, TD-02, CB-01.
- **Mục đích:** Xác minh chức năng thiết yếu không phụ thuộc Internet.
- **Trạng thái ban đầu:** Tự động, cấu hình đã đồng bộ, trực tuyến.
- **Đầu vào/điều kiện thử:** Ngắt Wi-Fi/bộ môi giới; thay đổi nhiệt độ/ánh sáng và tạo sự kiện cục bộ.
- **Các bước:** Ngắt kết nối; quan sát khả dụng; thay đổi cảm biến qua ngưỡng; kiểm tra tải/còi; thử lệnh từ xa.
- **Kết quả mong đợi:** UNO vẫn đọc và tự động hóa/cảnh báo; lệnh từ xa không giả thành công; ứng dụng báo ngoại tuyến/dữ liệu cũ.
- **Nơi lấy minh chứng:** Video thiết bị, log UNO/ESP32 và ảnh ứng dụng.
- **Tiêu chí đạt/không đạt:** Đạt khi logic cục bộ đúng trong toàn thời gian mất mạng; không đạt nếu tải/cảnh báo dừng vì MQTT.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT15 — Gửi bù sự kiện và giữ khoảng trống telemetry

- **Chức năng truy vết:** MN-01, DL-01, BC-01.
- **Mục đích:** Xác minh chiến lược ngoại tuyến trung thực.
- **Trạng thái ban đầu:** Trực tuyến, dữ liệu đang lưu bình thường.
- **Đầu vào/điều kiện thử:** Mất mạng đủ lâu; tạo nhiều sự kiện; khôi phục mạng.
- **Các bước:** Ghi mốc mất; tạo sự kiện/cảnh báo và telemetry; nối lại; truy vấn nhật ký/biểu đồ.
- **Kết quả mong đợi:** Sự kiện/cảnh báo gửi bù đúng ID một lần; state mới nhất đồng bộ; telemetry bị thiếu tạo khoảng trống, không được dựng lại giả.
- **Nơi lấy minh chứng:** Hàng đợi ESP32, bản tin gửi bù, DB và ảnh biểu đồ.
- **Tiêu chí đạt/không đạt:** Đạt khi không trùng sự kiện và có khoảng trống thật; không đạt nếu đồ thị liên tục bằng số liệu bịa hoặc mất sự kiện trong giới hạn hàng đợi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT16 — Tự kết nối lại và hòa giải cấu hình/trạng thái

- **Chức năng truy vết:** MN-01, CH-01.
- **Mục đích:** Xác minh reconnect không phát lại lệnh hết hạn và lấy bản cấu hình đúng.
- **Trạng thái ban đầu:** Thiết bị ngoại tuyến với NVS phiên bản N; máy chủ có phiên bản N+1 hợp lệ.
- **Đầu vào/điều kiện thử:** Khôi phục Wi-Fi/MQTT; có một lệnh cũ đã hết hạn trong lịch sử.
- **Các bước:** Bật mạng; theo dõi backoff/kết nối; khả dụng; đồng bộ phiên bản; trạng thái báo cáo và hàng đợi.
- **Kết quả mong đợi:** ESP32 tự nối; áp dụng N+1 nguyên tử; UNO báo N+1; gửi state/sự kiện tồn; không thi hành lệnh hết hạn.
- **Nơi lấy minh chứng:** Boot/reconnect log, MQTT, NVS/UNO ACK, DB.
- **Tiêu chí đạt/không đạt:** Đạt khi đồng nhất phiên bản và không có hành động cũ; không đạt nếu cache ghi đè bản máy chủ mới hơn hoặc tải đổi vì lệnh hết hạn.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT17 — Arduino UNO khởi động lại an toàn

- **Chức năng truy vết:** MN-01, CH-01, TD-01, TD-02.
- **Mục đích:** Xác minh UNO không chạy với RAM chưa đồng bộ.
- **Trạng thái ban đầu:** ESP32 hoạt động, cấu hình hợp lệ, một tải đang bật.
- **Đầu vào/điều kiện thử:** Reset UNO.
- **Các bước:** Quan sát đầu ra tức thời; boot; yêu cầu/đáp ứng sync; số đo mới; đánh giá Tự động hoặc giữ Thủ công.
- **Kết quả mong đợi:** Tải tiện nghi về Tắt; UNO yêu cầu cấu hình; chỉ Tự động sau config + số đo hợp lệ; phát sự kiện reset/sync.
- **Nơi lấy minh chứng:** Video chân/tải, Serial hai board, trạng thái ứng dụng.
- **Tiêu chí đạt/không đạt:** Đạt khi không có bật ngoài ý muốn và trình tự đúng; không đạt nếu dùng cấu hình RAM rác.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT18 — Lệnh không được xác nhận

- **Chức năng truy vết:** DK-01, MN-01, UD-01.
- **Mục đích:** Xác minh timeout/ACK thất bại không biến thành thành công giả.
- **Trạng thái ban đầu:** Ở nhà, Thủ công, giao diện kết nối máy chủ; chặn đường ESP32–UNO hoặc ACK có kiểm soát.
- **Đầu vào/điều kiện thử:** Một lệnh Bật với ACK bị mất/trì hoãn quá hạn.
- **Các bước:** Gửi lệnh; theo dõi trạng thái Chờ; chờ timeout; khôi phục kết nối và đồng bộ state.
- **Kết quả mong đợi:** Giao diện báo timeout/không xác định, không báo Bật; sau sync hiển thị state thật; lệnh trùng ID không thi hành lại.
- **Nơi lấy minh chứng:** Quay màn hình, log mã lệnh/timeout và state sau sync.
- **Tiêu chí đạt/không đạt:** Đạt khi trạng thái trung thực; không đạt nếu nút chuyển thành Bật chỉ do yêu cầu đã gửi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT19 — Xác thực và chặn người chưa đăng nhập

- **Chức năng truy vết:** UD-01.
- **Mục đích:** Xác minh API/giao diện không dựa vào việc ẩn nút phía trình duyệt.
- **Trạng thái ban đầu:** Không có phiên; sau đó có phiên chủ phòng hợp lệ.
- **Đầu vào/điều kiện thử:** Truy cập trang bảo vệ, gửi trực tiếp lệnh/cấu hình không phiên/sai phiên, rồi đăng nhập đúng.
- **Các bước:** Thử các endpoint; kiểm tra mã phản hồi/không có MQTT; đăng nhập; lặp lệnh hợp lệ; đăng xuất và thử lại.
- **Kết quả mong đợi:** Mọi thao tác chưa xác thực bị chặn ở máy chủ và không đến thiết bị; phiên đúng được phép theo quy tắc.
- **Nơi lấy minh chứng:** Kết quả kiểm thử API, log xác thực, MQTT và nhật ký bảo mật.
- **Tiêu chí đạt/không đạt:** Đạt khi không có đường lách; không đạt nếu request trực tiếp thay đổi thiết bị/cấu hình.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT20 — Lưu, lọc và hết hạn dữ liệu

- **Chức năng truy vết:** DL-01.
- **Mục đích:** Xác minh phân loại, khử lặp, truy vấn và thời hạn 30 ngày.
- **Trạng thái ban đầu:** Cơ sở dữ liệu thử sạch hoặc fixture có kiểm soát.
- **Đầu vào/điều kiện thử:** Mẫu một phút, trạng thái, cấu hình, sự kiện/cảnh báo; một ID gửi lặp; dữ liệu có tuổi > 30 ngày.
- **Các bước:** Nạp dữ liệu; truy vấn theo loại/thời gian; gửi lại cùng ID; chạy tác vụ dọn với đồng hồ thử.
- **Kết quả mong đợi:** Loại dữ liệu đúng; ID lặp chỉ một bản; dữ liệu lịch sử/sự kiện quá hạn bị dọn theo chính sách; cấu hình hiện hành/tài khoản không bị xóa.
- **Nơi lấy minh chứng:** Kiểm thử tự động DB/API, truy vấn trước/sau và log tác vụ dọn.
- **Tiêu chí đạt/không đạt:** Đạt khi toàn vẹn/retention đúng; không đạt nếu xóa nhầm cấu hình hoặc giữ bản trùng.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT21 — Biểu đồ và khoảng trống dữ liệu

- **Chức năng truy vết:** BC-01, DL-01.
- **Mục đích:** Xác minh lịch sử 24 giờ/7 ngày/30 ngày và không nội suy dữ liệu giả.
- **Trạng thái ban đầu:** DB có mẫu một phút, các khoảng trống và điểm chất lượng lỗi có chủ ý.
- **Đầu vào/điều kiện thử:** Ba khoảng thời gian và ba đại lượng môi trường.
- **Các bước:** Mở biểu đồ; đổi bộ lọc; kiểm tra tooltip/đơn vị; đối chiếu điểm với DB và khoảng trống.
- **Kết quả mong đợi:** Điểm đúng, thứ tự thời gian đúng, khoảng trống hiển thị rõ, giá trị lỗi không biến thành 0.
- **Nơi lấy minh chứng:** Ảnh biểu đồ, phản hồi API và tập fixture/truy vấn DB.
- **Tiêu chí đạt/không đạt:** Đạt khi đối chiếu đúng mọi khoảng; không đạt nếu nối qua khoảng thiếu như số đo thật.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT22 — Servo, trạng thái cửa và xác minh chốt

- **Chức năng truy vết:** AN-02, AN-01.
- **Mục đích:** Xác minh không đánh đồng lệnh servo với cửa/chốt cơ khí.
- **Trạng thái ban đầu:** Ở nhà, không cảnh báo, servo/cảm biến cửa sẵn sàng, chưa có cảm biến chốt riêng.
- **Đầu vào/điều kiện thử:** Lệnh Khóa/Mở khi cửa Đóng, sau đó thay đổi trạng thái cửa độc lập.
- **Các bước:** Gửi từng lệnh; quan sát servo/ACK; mở/đóng cánh mô hình; xem giao diện và log.
- **Kết quả mong đợi:** Trạng thái cửa theo cảm biến; lệnh chốt theo servo; `xac_minh_co_khi=false`; giao diện không ghi “chốt chắc chắn” khi thiếu phản hồi riêng.
- **Nơi lấy minh chứng:** Video servo/cửa, log trạng thái và ảnh giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi ba khái niệm tách biệt; không đạt nếu lệnh Khóa tự làm giao diện tuyên bố cửa/chốt đã xác minh.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT23 — Cảm biến cửa và cảnh báo xâm nhập

- **Chức năng truy vết:** AN-01, CB-01.
- **Mục đích:** Xác minh cùng thao tác mở cửa có hành vi khác nhau theo hồ sơ/ủy quyền.
- **Trạng thái ban đầu:** Thực hiện ở Ở nhà, Ra ngoài và Ban đêm; cảm biến cửa hợp lệ.
- **Đầu vào/điều kiện thử:** Mở/đóng cửa bình thường; mở trái phép; mở trong cửa sổ giao dịch hợp lệ.
- **Các bước:** Lặp thao tác theo ba hồ sơ; quan sát khử dội, trạng thái và cảnh báo.
- **Kết quả mong đợi:** Ở nhà chỉ ghi trạng thái; Ra ngoài/Ban đêm mở trái phép gây cảnh báo ≤ 1 giây sau xác nhận; mở được ủy quyền không báo giả.
- **Nơi lấy minh chứng:** Video, log cảm biến/vùng/giao dịch và nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi phân loại đúng mọi nhánh; không đạt nếu bỏ sót xâm nhập hoặc báo giả cho giao dịch hợp lệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT24 — Mở khóa trong báo an ninh và báo an toàn

- **Chức năng truy vết:** AN-02, CB-01, CD-02.
- **Mục đích:** Xác minh chính sách mở khóa phân biệt loại cảnh báo.
- **Trạng thái ban đầu:** Hai lượt ở hồ sơ bảo vệ: (a) báo an ninh hoạt động; (b) chỉ báo an toàn hoạt động.
- **Đầu vào/điều kiện thử:** Lệnh Mở từ xa, xác nhận người dùng; ở lượt (a) sau đó cho nguyên nhân hết và xác nhận cảnh báo.
- **Các bước:** Gửi Mở ở từng lượt; kiểm tra ACK/servo/hồ sơ; hoàn tất nguyên nhân an ninh rồi thử lại.
- **Kết quả mong đợi:** (a) bị chặn đến khi nguyên nhân hết + xác nhận; (b) cho mở có xác nhận và chuyển Ở nhà trước nhưng cảnh báo an toàn không bị xóa; hệ thống không tự mở.
- **Nơi lấy minh chứng:** Video servo, log lệnh/CB-01/hồ sơ và giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi hai chính sách đúng; không đạt nếu báo an toàn tự mở hoặc mở khóa xóa cảnh báo.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT25 — MQ-2 làm nóng, hiệu chuẩn và mức tương đối

- **Chức năng truy vết:** AT-01.
- **Mục đích:** Xác minh không kết luận/hiển thị sai trong giai đoạn làm nóng và không tuyên bố ppm.
- **Trạng thái ban đầu:** MQ-2 nguội/khởi động mới, model và quy trình thử đã được chốt an toàn.
- **Đầu vào/điều kiện thử:** Tín hiệu ADC trong thời gian làm nóng và sau khi sẵn sàng.
- **Các bước:** Khởi động; theo dõi state; kiểm tra giao diện; hoàn tất hiệu chuẩn mô hình; đối chiếu ADC và mức 0–100%.
- **Kết quả mong đợi:** Hiển thị Làm nóng/Hiệu chuẩn trước sẵn sàng; sau đó hiển thị mức tương đối/chất lượng; không có đơn vị ppm hay tuyên bố nồng độ thật.
- **Nơi lấy minh chứng:** Boot/UNO log, dữ liệu mạng và ảnh trang An toàn.
- **Tiêu chí đạt/không đạt:** Đạt khi trạng thái và giới hạn trình bày đúng; không đạt nếu báo Bình thường chắc chắn trong warm-up hoặc hiển thị ppm.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT26 — Ngưỡng MQ-2 bảo trì và cảnh báo

- **Chức năng truy vết:** AT-01, CH-01, CB-01.
- **Mục đích:** Xác minh ngưỡng có giới hạn, cấu hình phiên bản và cảnh báo cục bộ.
- **Trạng thái ban đầu:** MQ-2 sẵn sàng, không cảnh báo, có quyền chủ phòng vào Bảo trì/Hiệu chuẩn.
- **Đầu vào/điều kiện thử:** Một ngưỡng hợp lệ; ngưỡng ngoài giới hạn; tín hiệu dưới/trên điều kiện xác nhận.
- **Các bước:** Lưu từng cấu hình; đối chiếu reported/version; kích thích an toàn theo hướng dẫn module; theo dõi còi/LED/cảnh báo.
- **Kết quả mong đợi:** Ngưỡng hợp lệ áp dụng; ngưỡng sai bị từ chối toàn bộ; vượt điều kiện tạo cảnh báo; không tự bật quạt/cắt tải/mở cửa.
- **Nơi lấy minh chứng:** Config log, NVS/UNO ACK, video thử, cảnh báo/nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi cả cấu hình và hành vi giới hạn đúng; không đạt nếu ngưỡng sai được nhận hoặc cảnh báo điều khiển cơ cấu ngoài còi/LED.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT27 — Cảm biến lửa và cảnh báo độc lập

- **Chức năng truy vết:** AT-02, CB-01.
- **Mục đích:** Xác minh cực tính/điều kiện phát hiện thật sau kiểm kê và cảnh báo đúng nguồn.
- **Trạng thái ban đầu:** Module sẵn sàng, MQ-2 không cảnh báo, quy trình kích thích an toàn đã duyệt.
- **Đầu vào/điều kiện thử:** Tín hiệu bình thường, tín hiệu thử đạt điều kiện và phục hồi.
- **Các bước:** Ghi baseline; tạo kích thích ở khoảng cách an toàn theo datasheet; quan sát tín hiệu, còi/LED, ứng dụng; loại bỏ kích thích và xác nhận.
- **Kết quả mong đợi:** Cảnh báo nguồn Lửa đúng cực tính, phản ứng cục bộ đúng; hết tín hiệu sang Chờ xác nhận; không tuyên bố chứng nhận phát hiện cháy.
- **Nơi lấy minh chứng:** Video an toàn, log UNO, cảnh báo/nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi phát hiện/phục hồi đúng và không báo từ baseline; không đạt nếu cực tính đảo hoặc nguồn sai.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT28 — Lỗi cảm biến an toàn là cảnh báo suy giảm

- **Chức năng truy vết:** AT-01, AT-02, CB-01.
- **Mục đích:** Xác minh lỗi không bị mạo danh là phát hiện khí/lửa.
- **Trạng thái ban đầu:** Cảm biến an toàn đang Bình thường, trực tuyến.
- **Đầu vào/điều kiện thử:** Ngắt/mô phỏng lỗi MQ-2 và cảm biến lửa theo khả năng phát hiện của module.
- **Các bước:** Gây lỗi từng nguồn; quan sát trạng thái/âm báo/nội dung; phục hồi.
- **Kết quả mong đợi:** `LOI_CAM_BIEN`, loại Hệ thống/suy giảm và mẫu/mức phân biệt; không có nội dung “phát hiện khí/lửa”; lưu lỗi/phục hồi một lần.
- **Nơi lấy minh chứng:** Log chẩn đoán, video còi/LED, ứng dụng và nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi phân biệt rõ; không đạt nếu báo giả nguy cơ hoặc im lặng trước mất bảo vệ có thể phát hiện.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT29 — Không thể vô hiệu hóa cảnh báo an toàn

- **Chức năng truy vết:** AT-01, AT-02, CB-01, UD-01.
- **Mục đích:** Xác minh giao diện/API chỉ cho tắt tiếng, không tắt giám sát an toàn.
- **Trạng thái ban đầu:** Một cảnh báo an toàn đang hoạt động.
- **Đầu vào/điều kiện thử:** Lệnh Tắt tiếng; thử request giả nhằm vô hiệu hóa phân hệ/ngưỡng ngoài giới hạn.
- **Các bước:** Tắt tiếng; kiểm tra sensor/alert vẫn hoạt động; gửi request trái phép trực tiếp; tạo tín hiệu mới.
- **Kết quả mong đợi:** Không có API/nút vô hiệu hóa; request bị từ chối; trạng thái vẫn cảnh báo; sự kiện mới làm còi kêu lại.
- **Nơi lấy minh chứng:** Giao diện, kiểm thử API, log cảm biến/còi và nhật ký bảo mật.
- **Tiêu chí đạt/không đạt:** Đạt khi không thể vô hiệu hóa qua UI/API/config; không đạt nếu Tắt tiếng làm dừng giám sát.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT30 — Nhiều nguyên nhân cảnh báo đồng thời

- **Chức năng truy vết:** CB-01, AT-01, AT-02, AN-01, DL-01.
- **Mục đích:** Xác minh cảnh báo tổng không làm mất nguyên nhân riêng.
- **Trạng thái ban đầu:** Không cảnh báo; các cảm biến sẵn sàng.
- **Đầu vào/điều kiện thử:** Kích hoạt lần lượt hai nguyên nhân (ví dụ MQ-2 + cửa/lửa), cho hết từng nguyên nhân và xác nhận.
- **Các bước:** Kích hoạt A; tắt tiếng; kích hoạt B; loại A; thử xác nhận sớm; loại B; xác nhận.
- **Kết quả mong đợi:** B làm còi kêu lại; A/B lưu riêng; hết A vẫn còn B; xác nhận sớm bị từ chối; chỉ về Bình thường sau hết cả hai + xác nhận.
- **Nơi lấy minh chứng:** Log danh sách nguyên nhân, video còi, UI và bản ghi DB.
- **Tiêu chí đạt/không đạt:** Đạt khi không mất/ghi đè nguyên nhân; không đạt nếu một nguồn kết thúc xóa toàn bộ cảnh báo.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT31 — An toàn và an ninh khi ngoại tuyến

- **Chức năng truy vết:** AT-01, AT-02, AN-01, CB-01, MN-01.
- **Mục đích:** Xác minh cảnh báo thiết yếu và gửi bù trong mất mạng.
- **Trạng thái ban đầu:** Thiết bị đã đồng bộ; sau đó Wi-Fi/MQTT bị ngắt.
- **Đầu vào/điều kiện thử:** Kích hoạt một cảnh báo an toàn và một an ninh trong giới hạn hàng đợi; khôi phục mạng.
- **Các bước:** Ngắt mạng; kích hoạt; tắt tiếng cục bộ nếu có cơ chế; nối lại; kiểm tra thứ tự/ID/state.
- **Kết quả mong đợi:** Còi/LED cục bộ hoạt động; không mất nguyên nhân; sau nối lại mỗi sự kiện gửi một lần, state hiện hành đúng và có dấu thời gian nguồn.
- **Nơi lấy minh chứng:** Video ngoại tuyến, hàng đợi ESP32, MQTT và DB.
- **Tiêu chí đạt/không đạt:** Đạt khi phản ứng không phụ thuộc mạng và gửi bù không trùng; không đạt nếu cảnh báo chỉ xuất hiện sau reconnect.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

## 5. Trường hợp kiểm thử có điều kiện

### KT32 — Phát hiện rung bằng SW-420

- **Chức năng truy vết:** AN-04, CB-01.
- **Mục đích:** Xác minh phát hiện tác động cửa và kiểm soát báo giả.
- **Trạng thái ban đầu:** AN-04 được duyệt/triển khai; cảm biến đã hiệu chỉnh; lần lượt Ở nhà và Ra ngoài.
- **Đầu vào/điều kiện thử:** Nhiễu nhỏ dưới điều kiện; chuỗi rung đạt điều kiện.
- **Các bước:** Kích thích theo hai mức ở hai hồ sơ; theo dõi xung thô/sự kiện xác nhận/cảnh báo.
- **Kết quả mong đợi:** Không báo với nhiễu nhỏ; Ở nhà chỉ ghi nếu chính sách cho phép; Ra ngoài cảnh báo khi đủ điều kiện.
- **Nơi lấy minh chứng:** Video, log xung/cửa sổ và nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi đúng ngưỡng/hồ sơ; nếu AN-04 không triển khai thì ghi KHÔNG ÁP DỤNG kèm quyết định phạm vi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT33 — Mã PIN tại chỗ

- **Chức năng truy vết:** AN-03, AN-02.
- **Mục đích:** Xác minh truy cập ngoại tuyến và khóa sau ba lần sai.
- **Trạng thái ban đầu:** AN-03 được triển khai; bàn phím/servo sẵn sàng; mạng có thể bị ngắt.
- **Đầu vào/điều kiện thử:** PIN đúng; ba PIN sai; PIN đúng trong 60 giây khóa và sau khi hết khóa.
- **Các bước:** Ngắt mạng; nhập chuỗi; kiểm tra servo, bộ đếm, còi/nhật ký; khôi phục mạng.
- **Kết quả mong đợi:** PIN đúng hợp lệ mở theo chính sách; ba sai khóa 60 giây; không truyền/lưu PIN rõ; gửi bù kết quả.
- **Nơi lấy minh chứng:** Video bàn phím/servo, log đã che bí mật, MQTT/DB sự kiện.
- **Tiêu chí đạt/không đạt:** Đạt khi giới hạn/ngoại tuyến/bảo mật đúng; nếu không triển khai thì KHÔNG ÁP DỤNG có quyết định.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT34 — Thông báo trình duyệt chống lặp

- **Chức năng truy vết:** TB-01, CB-01.
- **Mục đích:** Xác minh quyền, gửi một lần theo mã cảnh báo và fallback trong ứng dụng.
- **Trạng thái ban đầu:** TB-01 được triển khai; thử một trình duyệt cấp quyền và một phiên từ chối quyền.
- **Đầu vào/điều kiện thử:** Một mã cảnh báo được nhận lặp; một cảnh báo mới.
- **Các bước:** Kích hoạt; gửi lại cùng ID; quan sát thông báo; từ chối quyền ở phiên khác; kiểm tra cảnh báo trong ứng dụng.
- **Kết quả mong đợi:** Một thông báo/ID ở phiên cho phép; không spam; phiên từ chối vẫn thấy cảnh báo trong ứng dụng.
- **Nơi lấy minh chứng:** Quay màn hình, log gửi/trạng thái quyền và UI.
- **Tiêu chí đạt/không đạt:** Đạt khi chống lặp/fallback đúng; nếu không triển khai thì KHÔNG ÁP DỤNG có quyết định.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT35 — Hiện diện/siêu âm hoặc thiết bị phụ

- **Chức năng truy vết:** MR-01.
- **Mục đích:** Xác minh chức năng bổ sung không xung đột hoặc làm suy giảm nhóm A.
- **Trạng thái ban đầu:** MR-01 đã được định nghĩa/duyệt cụ thể và nhóm A hoạt động ổn định.
- **Đầu vào/điều kiện thử:** Bộ dữ liệu/động tác/lệnh theo mục tiêu MR-01, gồm lỗi cảm biến và Ban đêm.
- **Các bước:** Chạy luồng bình thường, biên, lỗi và đồng thời với nhóm A; theo dõi tài nguyên/thời gian đáp ứng.
- **Kết quả mong đợi:** Chức năng đúng đặc tả bổ sung; lỗi chỉ vô hiệu MR-01; chuyển động nội bộ Ban đêm không gây báo an ninh; nhóm A không suy giảm.
- **Nơi lấy minh chứng:** Kế hoạch con đã duyệt, log tài nguyên, video/UI và hồi quy nhóm A.
- **Tiêu chí đạt/không đạt:** Đạt khi tất cả tiêu chí con/hồi quy đúng; nếu không triển khai thì KHÔNG ÁP DỤNG có quyết định.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

## 6. Cổng hoàn thành kiểm thử

Một trường hợp chỉ được chuyển khỏi `CHƯA THỰC HIỆN` khi đã ghi:

1. phiên bản firmware/máy chủ/web/cấu hình và danh mục phần cứng;
2. ngày giờ, người thực hiện và môi trường;
3. liên kết/tên file minh chứng;
4. kết quả thực tế có số đo/log cần thiết;
5. đánh giá ĐẠT/KHÔNG ĐẠT/BỊ CHẶN, kèm mã lỗi nếu không đạt;
6. lần kiểm thử lại sau sửa, không ghi đè mất lịch sử lần trước.

**ĐIỂM DỪNG:** Ma trận này là kế hoạch chấp nhận, chưa phải báo cáo kết quả. Không có trường hợp nào đã được chạy trong Giai đoạn 1.
