# MA TRẬN TRUY VẾT VÀ KIỂM THỬ — PHIÊN BẢN 1.1

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 1.1 |
| Trạng thái | **ĐÃ DUYỆT — 26/09/2026** |
| Đặc tả nguồn | `docs/01-dac-ta-he-thong-v1.1.md` |
| Số trường hợp đang áp dụng | 32, gồm 30 bắt buộc và 2 có điều kiện |
| Mã ngừng áp dụng | KT01, KT05, KT22, KT23, KT32, KT33; chỉ giữ để truy vết lịch sử và không tái sử dụng |
| Quy tắc kết quả | Chỉ điền ĐẠT/KHÔNG ĐẠT khi có bằng chứng thật; hiện tất cả trường hợp đang áp dụng là `CHƯA THỰC HIỆN` |
| Quyết định phần cứng | Không mua thêm linh kiện; kiểm thử được điều chỉnh theo LDR, SRF04, MQ-2, cảm biến lửa, servo và tải có trong kit |

## 2. Quy ước đánh giá và bằng chứng

- **ĐẠT:** mọi tiêu chí bắt buộc của trường hợp đều thỏa và có minh chứng truy xuất được.
- **KHÔNG ĐẠT:** ít nhất một tiêu chí bắt buộc sai hoặc thiếu hành vi an toàn; phải ghi mã lỗi/liên kết minh chứng.
- **BỊ CHẶN:** chỉ dùng lúc thực thi nếu thiếu điều kiện vật lý hoặc điều kiện ngoài kiểm soát; không được đổi thành ĐẠT.
- **KHÔNG ÁP DỤNG:** chỉ dùng cho KT34–KT35 khi chức năng B/C tương ứng chính thức không được triển khai; phải dẫn quyết định phạm vi.
- **CHƯA THỰC HIỆN:** giá trị duy nhất được phép ghi cho kết quả thực tế ở thời điểm hiện tại.

Mỗi minh chứng sau này phải nằm trong thư mục kiểm thử được thiết kế ở Giai đoạn 10 và có tối thiểu: thời gian, phiên bản mã/cấu hình, log hoặc ảnh/video phù hợp và người thực hiện phần vật lý nếu có.

## 3. Truy vết chức năng nhóm A

| Chức năng bắt buộc | Trường hợp kiểm thử chính |
|---|---|
| MT-03 | KT14, KT15, KT21, KT36 |
| MT-02 | KT02 |
| DK-01 | KT03, KT04, KT09, KT18 |
| TD-02 | KT02, KT06, KT07, KT11, KT14 |
| CD-01 | KT04, KT08, KT11 |
| CD-02 | KT08, KT09, KT10, KT11, KT24 |
| CH-01 | KT07, KT08, KT16, KT26 |
| AN-05 | KT09, KT10, KT12, KT30, KT31, KT38 |
| AN-02 | KT09, KT24, KT37 |
| AT-01 | KT07, KT25, KT26, KT28, KT31 |
| AT-02 | KT27, KT28, KT31 |
| CB-01 | KT12, KT13, KT24, KT29, KT30, KT31 |
| MN-01 | KT14, KT15, KT16, KT17, KT18, KT31 |
| UD-01 | KT03, KT19, KT36 |
| DL-01 | KT15, KT20, KT21, KT30, KT36, KT38 |
| BC-01 | KT21 |

Mọi chức năng nhóm A có ít nhất một trường hợp kiểm thử. TB-01 và MR-01 được truy vết lần lượt bởi KT34 và KT35 ở nhóm có điều kiện.

## 4. Trường hợp kiểm thử bắt buộc

### KT02 — Phát hiện lỗi và dữ liệu ánh sáng cũ

- **Chức năng truy vết:** MT-02, TD-02.
- **Mục đích:** Xác minh dữ liệu ánh sáng sai hoặc quá hạn không tiếp tục điều khiển đèn Tự động vô thời hạn.
- **Trạng thái ban đầu:** Ở nhà, Tự động, đèn đang bật bởi quy tắc và LDR đang cho dữ liệu hợp lệ.
- **Đầu vào/điều kiện thử:** Tạo ba lần đọc lỗi liên tiếp và sau đó không có mẫu hợp lệ quá 15 giây.
- **Các bước:** Gây lỗi LDR có kiểm soát; ghi thời điểm; quan sát chất lượng; chờ hết ân hạn 30 giây; phục hồi cảm biến.
- **Kết quả mong đợi:** Dữ liệu chuyển Không hợp lệ/Cũ; quy tắc giữ đầu ra tối đa 30 giây rồi tắt đèn do Tự động; tạo đúng một sự kiện lỗi và một sự kiện phục hồi; tải Thủ công không bị tác động.
- **Nơi lấy minh chứng:** Log UNO, trạng thái đèn, giao diện và nhật ký máy chủ.
- **Tiêu chí đạt/không đạt:** Đạt khi mốc 15/30 giây và phân loại đúng; không đạt nếu tiếp tục dùng số đo lỗi, ghi lặp sự kiện mỗi chu kỳ hoặc tắt tải Thủ công không liên quan.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT03 — Điều khiển đèn/quạt trong Thủ công

- **Chức năng truy vết:** DK-01, UD-01, DL-01.
- **Mục đích:** Xác minh lệnh trực tiếp có mã lệnh, ACK và trạng thái báo cáo thực tế.
- **Trạng thái ban đầu:** Ở nhà, Thủ công, trực tuyến, đèn và quạt tắt.
- **Đầu vào/điều kiện thử:** Lệnh Bật/Tắt lần lượt cho đèn và quạt.
- **Các bước:** Gửi lệnh; quan sát trạng thái chờ; đối chiếu mã lệnh ở máy chủ/ESP32/UNO; kiểm tra đầu ra; nhận ACK; lặp với lệnh Tắt.
- **Kết quả mong đợi:** Mỗi lệnh thi hành đúng một lần; giao diện chỉ đổi sau ACK/trạng thái báo cáo; nhật ký chứa nguồn Thủ công và kết quả.
- **Nơi lấy minh chứng:** Video/ảnh tải, log lệnh/ACK, giao diện và nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi đủ bốn thao tác đúng và không cập nhật lạc quan; không đạt nếu giao diện khác thiết bị hoặc lệnh bị thi hành lặp.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT04 — Lệnh trực tiếp khi đang Tự động

- **Chức năng truy vết:** DK-01, CD-01.
- **Mục đích:** Xác minh không có xung đột âm thầm giữa người dùng và quy tắc Tự động.
- **Trạng thái ban đầu:** Ở nhà, Tự động, thiết bị trực tuyến; quạt đang tắt theo chính sách Tự động của phiên bản 1.1.
- **Đầu vào/điều kiện thử:** Người dùng gửi lệnh trực tiếp; một lần hủy và một lần xác nhận chuyển Thủ công.
- **Các bước:** Bấm điều khiển; hủy hộp xác nhận; kiểm tra không có lệnh thiết bị; lặp lại, xác nhận; theo dõi phương thức, ACK và tải.
- **Kết quả mong đợi:** Hủy không đổi gì; xác nhận chuyển Thủ công trước hoặc trong cùng giao dịch với lệnh, sau đó tải theo yêu cầu.
- **Nơi lấy minh chứng:** Quay màn hình, log API/MQTT/nối tiếp và trạng thái báo cáo.
- **Tiêu chí đạt/không đạt:** Đạt khi không lệnh trực tiếp nào thi hành trong Tự động mà thiếu xác nhận; không đạt nếu quy tắc lập tức giành lại tải.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT06 — Vùng trễ và thời gian giữ của đèn

- **Chức năng truy vết:** TD-02.
- **Mục đích:** Xác minh quy tắc mức sáng 0–100%, hai ngưỡng và thời gian giữ.
- **Trạng thái ban đầu:** Ở nhà, Tự động; ngưỡng bật 30%, tắt 50%; dữ liệu hợp lệ.
- **Đầu vào/điều kiện thử:** Chuỗi mức sáng ≤ 30%, giữa 30–50%, ≥ 50% và dao động quanh hai biên.
- **Các bước:** Thay đổi ánh sáng có kiểm soát; ghi mức chuẩn hóa, quyết định và thời điểm đổi trạng thái.
- **Kết quả mong đợi:** Đèn bật khi ≤ 30%, tắt khi ≥ 50%, giữ nguyên trong vùng trễ và không đổi lại trước 10 giây trừ lệnh ưu tiên cao hơn.
- **Nơi lấy minh chứng:** Log UNO, ảnh/video đèn và chuỗi đầu vào.
- **Tiêu chí đạt/không đạt:** Đạt khi đúng cực tính, điểm biên và chống dao động; không đạt nếu 0% bị hiểu là sáng nhất hoặc sai thời gian giữ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT07 — Xác thực cấu hình theo giao dịch toàn bộ

- **Chức năng truy vết:** CH-01, TD-02, AT-01.
- **Mục đích:** Xác minh cấu hình hợp lệ được áp dụng còn cấu hình sai bị từ chối toàn bộ.
- **Trạng thái ban đầu:** Hệ thống trực tuyến với cấu hình phiên bản N.
- **Đầu vào/điều kiện thử:** Một bản ngưỡng đèn hợp lệ; các bản sai phạm vi, sai vùng trễ, sai kiểu; một yêu cầu đổi ngưỡng MQ-2 ngoài giao diện bảo trì hoặc ngoài giới hạn kỹ thuật.
- **Các bước:** Gửi từng bản; theo dõi kiểm tra tại máy chủ/ESP32/UNO; đọc phiên bản báo cáo và thử điểm biên tự động hóa.
- **Kết quả mong đợi:** Bản hợp lệ thành N+1 ở ba tầng; mỗi bản sai có lỗi cụ thể và toàn bộ bản hợp lệ trước đó được giữ nguyên; ngưỡng MQ-2 chỉ đổi qua quyền bảo trì hợp lệ.
- **Nơi lấy minh chứng:** Phản hồi API, dữ liệu desired/reported, NVS/UNO log và giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi không có cập nhật một phần hoặc lệch phiên bản; không đạt nếu một trường sai vẫn làm đổi trường khác.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT08 — Giữ cấu hình và trạng thái qua khởi động lại

- **Chức năng truy vết:** CH-01, CD-01, CD-02, MN-01.
- **Mục đích:** Xác minh NVS/cache và trạng thái khởi động an toàn.
- **Trạng thái ban đầu:** Cấu hình không mặc định đã đồng bộ; một hồ sơ/phương thức được chọn; có tải đang bật.
- **Đầu vào/điều kiện thử:** Khởi động lại ESP32 rồi khởi động lại toàn hệ thống theo quy trình an toàn.
- **Các bước:** Ghi trạng thái trước; reset; quan sát tải tức thời; đọc NVS/đồng bộ UNO/máy chủ; kiểm tra trạng thái sau.
- **Kết quả mong đợi:** Cấu hình, hồ sơ và phương thức được khôi phục đúng; đèn/quạt bắt đầu Tắt; Tự động chỉ chạy đèn sau cấu hình + mức sáng hợp lệ; Thủ công giữ tải tắt.
- **Nơi lấy minh chứng:** Video khởi động, boot log, phiên bản cấu hình và trạng thái ứng dụng.
- **Tiêu chí đạt/không đạt:** Đạt khi không có xung đầu ra ngoài ý muốn hoặc mất cấu hình; không đạt nếu Tự động chạy bằng dữ liệu chưa hợp lệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT09 — Hồ sơ Ra ngoài

- **Chức năng truy vết:** CD-02, AN-05, AN-02, DK-01.
- **Mục đích:** Xác minh ràng buộc Ra ngoài được duy trì liên tục.
- **Trạng thái ban đầu:** Ở nhà, một tải đang bật, vùng cửa trống, không cảnh báo.
- **Đầu vào/điều kiện thử:** Lệnh chuyển Ra ngoài rồi lệnh bật tiện nghi.
- **Các bước:** Chuyển hồ sơ; theo dõi tắt tải, lệnh khóa servo, trang bị SRF04 và ACK; sau đó yêu cầu bật đèn/quạt.
- **Kết quả mong đợi:** Tải tắt, phát lệnh khóa với `xac_minh_co_khi=false`, vùng cửa được trang bị; lệnh tiện nghi bị từ chối. Bất kỳ bước lỗi nào tạo trạng thái Suy giảm, không giả thành công.
- **Nơi lấy minh chứng:** Video tải/servo/SRF04, log giao dịch và giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi các ràng buộc duy trì và lỗi từng phần hiển thị đúng; không đạt nếu bật được tiện nghi trong Ra ngoài hoặc giao diện tuyên bố cửa đã khóa chắc chắn.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT10 — Hồ sơ Ban đêm và vùng chu vi

- **Chức năng truy vết:** CD-02, AN-05.
- **Mục đích:** Xác minh Ban đêm chỉ bảo vệ vùng cửa do SRF04 quan sát, không báo giả vì hoạt động ngoài vùng đó.
- **Trạng thái ban đầu:** Ở nhà, không cảnh báo, SRF04 sẵn sàng và vùng cửa trống.
- **Đầu vào/điều kiện thử:** Chuyển Ban đêm; tạo hoạt động bên trong nhưng ngoài vùng đo; sau đó đưa đối tượng vào vùng cửa.
- **Các bước:** Chuyển hồ sơ; kiểm tra vùng trang bị; tạo hai loại kích thích lần lượt.
- **Kết quả mong đợi:** Hoạt động ngoài vùng SRF04 không gây báo an ninh; đối tượng xâm nhập vùng cửa gây cảnh báo; tiện nghi vẫn theo phương thức đang giữ.
- **Nơi lấy minh chứng:** Log vùng, video kích thích, cảnh báo và trạng thái tiện nghi.
- **Tiêu chí đạt/không đạt:** Đạt khi phân vùng đúng; không đạt nếu hoạt động ngoài vùng làm còi kêu hoặc xâm nhập vùng cửa bị bỏ qua.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT11 — Trở về Ở nhà và giữ phương thức

- **Chức năng truy vết:** CD-01, CD-02, TD-02.
- **Mục đích:** Xác minh không phục hồi mù đầu ra sau hồ sơ bảo vệ.
- **Trạng thái ban đầu:** Thực hiện hai lượt: Ra ngoài + Tự động và Ra ngoài + Thủ công; các tải đều đang bị cưỡng chế tắt.
- **Đầu vào/điều kiện thử:** Lệnh chuyển Ở nhà với mức sáng hợp lệ.
- **Các bước:** Về Ở nhà ở từng lượt; quan sát phương thức, vùng bảo vệ, đèn và quạt.
- **Kết quả mong đợi:** Giữ phương thức trước; Tự động đánh giá ngay đèn theo ánh sáng và giữ quạt Tắt; Thủ công tiếp tục giữ các tải Tắt đến lệnh mới; khóa không tự mở.
- **Nơi lấy minh chứng:** Log trạng thái/giao dịch và video đầu ra.
- **Tiêu chí đạt/không đạt:** Đạt khi hai nhánh đúng; không đạt nếu phục hồi tải Thủ công cũ, chạy quạt tự động hoặc tự mở khóa.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT12 — Độ trễ cảnh báo cục bộ

- **Chức năng truy vết:** AN-05, AT-01, AT-02, CB-01.
- **Mục đích:** Xác minh cảnh báo cục bộ không phụ thuộc mạng và đáp ứng mục tiêu thời gian.
- **Trạng thái ban đầu:** Cảm biến đã sẵn sàng, vùng/nguồn tương ứng được kích hoạt, còi và LED bình thường.
- **Đầu vào/điều kiện thử:** Lần lượt tạo điều kiện thử an toàn cho SRF04, MQ-2 và cảm biến lửa theo quy trình chưa gây nguy hiểm.
- **Các bước:** Ghi thời điểm tín hiệu đạt điều kiện xác nhận; đo thời điểm còi/LED kích hoạt; lặp theo từng nguồn.
- **Kết quả mong đợi:** Còi/LED hoạt động không quá 1 giây sau khi điều kiện phát hiện được thỏa; nguyên nhân cảnh báo đúng.
- **Nơi lấy minh chứng:** Video có mốc thời gian hoặc thiết bị đo phù hợp, log UNO và bản ghi cảnh báo.
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
- **Tiêu chí đạt/không đạt:** Đạt khi đủ chuỗi trạng thái; không đạt nếu tắt tiếng hoặc xóa một nguyên nhân làm mất nguyên nhân khác.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT14 — Mất Wi-Fi/MQTT nhưng logic cục bộ tiếp tục

- **Chức năng truy vết:** MN-01, MT-03, TD-02, CB-01.
- **Mục đích:** Xác minh chức năng thiết yếu không phụ thuộc Internet.
- **Trạng thái ban đầu:** Tự động, cấu hình đã đồng bộ, thiết bị trực tuyến.
- **Đầu vào/điều kiện thử:** Ngắt Wi-Fi/bộ môi giới; thay đổi ánh sáng qua ngưỡng và tạo một sự kiện cảnh báo cục bộ.
- **Các bước:** Ngắt kết nối; quan sát khả dụng; thay đổi cảm biến; kiểm tra đèn/còi; thử lệnh từ xa.
- **Kết quả mong đợi:** UNO vẫn đọc LDR, tự động hóa đèn và cảnh báo; quạt vẫn theo trạng thái cục bộ hợp lệ; lệnh từ xa không giả thành công; ứng dụng báo Ngoại tuyến/Dữ liệu cũ.
- **Nơi lấy minh chứng:** Video thiết bị, log UNO/ESP32 và ảnh ứng dụng.
- **Tiêu chí đạt/không đạt:** Đạt khi logic cục bộ đúng suốt thời gian mất mạng; không đạt nếu tự động hóa/cảnh báo dừng vì MQTT.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT15 — Gửi bù sự kiện và giữ khoảng trống telemetry

- **Chức năng truy vết:** MN-01, MT-03, DL-01, BC-01.
- **Mục đích:** Xác minh chiến lược ngoại tuyến trung thực.
- **Trạng thái ban đầu:** Trực tuyến, dữ liệu đang lưu bình thường.
- **Đầu vào/điều kiện thử:** Mất mạng đủ lâu; tạo nhiều sự kiện; khôi phục mạng.
- **Các bước:** Ghi mốc mất mạng; tạo sự kiện/cảnh báo và telemetry ánh sáng; nối lại; truy vấn nhật ký/biểu đồ.
- **Kết quả mong đợi:** Sự kiện/cảnh báo gửi bù đúng ID một lần; trạng thái mới nhất đồng bộ; mẫu ánh sáng bị thiếu tạo khoảng trống, không được dựng lại giả.
- **Nơi lấy minh chứng:** Hàng đợi ESP32, bản tin gửi bù, cơ sở dữ liệu và ảnh biểu đồ.
- **Tiêu chí đạt/không đạt:** Đạt khi không trùng sự kiện và có khoảng trống thật; không đạt nếu đồ thị liên tục bằng dữ liệu bịa hoặc mất sự kiện trong giới hạn hàng đợi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT16 — Tự kết nối lại và hòa giải cấu hình/trạng thái

- **Chức năng truy vết:** MN-01, CH-01.
- **Mục đích:** Xác minh kết nối lại không phát lại lệnh hết hạn và lấy đúng bản cấu hình.
- **Trạng thái ban đầu:** Thiết bị ngoại tuyến với NVS phiên bản N; máy chủ có phiên bản N+1 hợp lệ.
- **Đầu vào/điều kiện thử:** Khôi phục Wi-Fi/MQTT; có một lệnh cũ đã hết hạn trong lịch sử.
- **Các bước:** Bật mạng; theo dõi khoảng chờ tăng dần, khả dụng, đồng bộ phiên bản và trạng thái báo cáo.
- **Kết quả mong đợi:** ESP32 tự nối lại; lấy N+1, xác thực và đồng bộ UNO; công bố trạng thái hiện hành; không thi hành lệnh cũ.
- **Nơi lấy minh chứng:** Log kết nối, NVS, MQTT và cơ sở dữ liệu.
- **Tiêu chí đạt/không đạt:** Đạt khi ba tầng cùng phiên bản và không phát lại lệnh; không đạt nếu NVS cũ ghi đè nguồn chính thức hoặc lệnh cũ chạy lại.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT17 — Arduino UNO khởi động lại an toàn

- **Chức năng truy vết:** MN-01, CH-01, TD-02.
- **Mục đích:** Xác minh UNO không dùng cấu hình/dữ liệu rác sau reset.
- **Trạng thái ban đầu:** ESP32 đang chạy; cấu hình đã đồng bộ; có thể có tải đang bật.
- **Đầu vào/điều kiện thử:** Reset riêng UNO.
- **Các bước:** Quan sát chân đầu ra lúc reset; theo dõi yêu cầu đồng bộ; cấp cấu hình; chờ số đo ánh sáng hợp lệ.
- **Kết quả mong đợi:** Đèn/quạt về Tắt; UNO yêu cầu đồng bộ; đèn Tự động chỉ chạy sau cấu hình + mức sáng hợp lệ; quạt giữ Tắt cho đến lệnh Thủ công; phát đúng một sự kiện khởi động.
- **Nơi lấy minh chứng:** Video đầu ra và log hai board.
- **Tiêu chí đạt/không đạt:** Đạt khi không có bật ngoài ý muốn và trình tự đồng bộ đúng; không đạt nếu quy tắc chạy trước dữ liệu hợp lệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT18 — Lệnh không được xác nhận

- **Chức năng truy vết:** DK-01, MN-01, UD-01.
- **Mục đích:** Xác minh giao diện không hiển thị thành công giả.
- **Trạng thái ban đầu:** Thủ công, ứng dụng trực tuyến với máy chủ; đường ESP32–UNO bị ngắt có kiểm soát.
- **Đầu vào/điều kiện thử:** Gửi lệnh Bật đèn/quạt và để quá hạn ACK.
- **Các bước:** Gửi lệnh; quan sát trạng thái chờ; đợi timeout; khôi phục đường nối tiếp; đồng bộ lại.
- **Kết quả mong đợi:** Giao diện báo thất bại/không xác định với lý do; không tự đổi trạng thái; sau đồng bộ hiển thị trạng thái báo cáo thực tế.
- **Nơi lấy minh chứng:** Quay màn hình, log máy chủ/ESP32 và trạng thái UNO.
- **Tiêu chí đạt/không đạt:** Đạt khi không có thành công giả; không đạt nếu UI đổi ngay khi gửi hoặc giữ trạng thái suy đoán sau timeout.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT19 — Xác thực và chặn người chưa đăng nhập

- **Chức năng truy vết:** UD-01.
- **Mục đích:** Xác minh một tài khoản chủ phòng và các API điều khiển được bảo vệ.
- **Trạng thái ban đầu:** Có tài khoản chủ phòng; phiên đăng nhập hợp lệ và một trình duyệt chưa đăng nhập.
- **Đầu vào/điều kiện thử:** Truy cập trang/API, gửi lệnh và đổi cấu hình khi chưa đăng nhập hoặc phiên hết hạn.
- **Các bước:** Thử từng thao tác không phiên; đăng nhập; thử thao tác hợp lệ; hết hạn/đăng xuất; thử lại.
- **Kết quả mong đợi:** Không phiên nhận 401/403 phù hợp và không sinh lệnh; phiên hợp lệ thao tác được; mật khẩu không xuất hiện rõ trong log/cơ sở dữ liệu.
- **Nơi lấy minh chứng:** Phản hồi HTTP, log kiểm toán và ảnh giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi mọi đường ghi đều được bảo vệ; không đạt nếu gọi trực tiếp API có thể bỏ qua đăng nhập.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT20 — Lưu, lọc và hết hạn dữ liệu

- **Chức năng truy vết:** DL-01.
- **Mục đích:** Xác minh phân loại dữ liệu và chính sách lưu 30 ngày.
- **Trạng thái ban đầu:** Cơ sở dữ liệu kiểm thử có mẫu ánh sáng, trạng thái, cấu hình, sự kiện và cảnh báo ở nhiều thời điểm.
- **Đầu vào/điều kiện thử:** Bản ghi mới, bản ghi trùng ID, dữ liệu quá 30 ngày và truy vấn bộ lọc.
- **Các bước:** Nạp bộ dữ liệu thử có kiểm soát; chạy lưu/chống lặp/dọn dẹp; truy vấn theo loại và thời gian.
- **Kết quả mong đợi:** Mẫu/sự kiện hết hạn bị dọn đúng chính sách; cấu hình hiện hành/tài khoản không bị xóa; ID trùng không tạo bản sao; bộ lọc đúng.
- **Nơi lấy minh chứng:** Kiểm thử tự động, truy vấn cơ sở dữ liệu và giao diện Nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi toàn vẹn và thời hạn đúng; không đạt nếu xóa cấu hình hiện hành hoặc giữ bản ghi trùng.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT21 — Biểu đồ mức sáng và khoảng trống dữ liệu

- **Chức năng truy vết:** MT-03, BC-01, DL-01.
- **Mục đích:** Xác minh biểu đồ lịch sử ánh sáng và cách trình bày thiếu dữ liệu trung thực.
- **Trạng thái ban đầu:** Có mẫu một phút và một khoảng mất dữ liệu đã biết.
- **Đầu vào/điều kiện thử:** Chọn khoảng 24 giờ, 7 ngày và 30 ngày.
- **Các bước:** Mở từng khoảng; đối chiếu điểm với cơ sở dữ liệu; kiểm tra khoảng mất dữ liệu, múi giờ và tooltip chất lượng.
- **Kết quả mong đợi:** Điểm/timestamp đúng; khoảng thiếu bị ngắt, không nối hoặc nội suy như số đo thật; giao diện thích ứng.
- **Nơi lấy minh chứng:** Ảnh biểu đồ, truy vấn cơ sở dữ liệu và kiểm thử giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi số điểm/khoảng trống khớp; không đạt nếu tạo dữ liệu giả hoặc sai thời gian.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT24 — Mở khóa trong báo an ninh và báo an toàn

- **Chức năng truy vết:** AN-02, CB-01, CD-02.
- **Mục đích:** Xác minh chính sách mở khóa khác nhau theo loại cảnh báo.
- **Trạng thái ban đầu:** Khóa đang ở lệnh Khóa; thực hiện hai lượt với báo AN_NINH và AN_TOAN.
- **Đầu vào/điều kiện thử:** Lệnh mở từ xa; nguyên nhân còn/hết; xác nhận người dùng.
- **Các bước:** Trong báo an ninh, thử mở khi nguyên nhân còn rồi sau khi hết + xác nhận; trong báo an toàn, thử mở có xác nhận khi nguyên nhân còn.
- **Kết quả mong đợi:** Báo an ninh chặn mở đến khi nguyên nhân hết và được xác nhận; báo an toàn cho phép chủ phòng mở có xác nhận nhưng không tự mở và không xóa cảnh báo; trạng thái vẫn chỉ là lệnh servo.
- **Nơi lấy minh chứng:** Log chính sách/ACK, video servo và máy trạng thái cảnh báo.
- **Tiêu chí đạt/không đạt:** Đạt khi hai nhánh khác đúng thiết kế; không đạt nếu an ninh cho mở sớm hoặc an toàn tự mở/xóa cảnh báo.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT25 — MQ-2 làm nóng, hiệu chuẩn và mức tương đối

- **Chức năng truy vết:** AT-01.
- **Mục đích:** Xác minh không dùng số đo MQ-2 trước khi sẵn sàng và không tuyên bố ppm.
- **Trạng thái ban đầu:** Hệ thống nguội, cấu hình phần cứng MQ-2 đã được khóa theo module thật.
- **Đầu vào/điều kiện thử:** Khởi động và quan sát toàn bộ giai đoạn làm nóng/ổn định được xác định ở Giai đoạn 5.
- **Các bước:** Cấp nguồn theo thiết kế; ghi trạng thái/ADC; chờ điều kiện sẵn sàng; quan sát mức tương đối trên ứng dụng.
- **Kết quả mong đợi:** Trước sẵn sàng hiển thị LAM_NONG, không phát cảnh báo từ giá trị chưa hợp lệ; sau sẵn sàng hiển thị ADC/mức 0–100% và chất lượng; không có nhãn ppm.
- **Nơi lấy minh chứng:** Log UNO, biểu đồ ADC thử, ảnh giao diện và dữ liệu lưu.
- **Tiêu chí đạt/không đạt:** Đạt khi khóa đúng giai đoạn và đơn vị; không đạt nếu số chưa sẵn sàng được coi là bình thường/cảnh báo hoặc gọi là ppm.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT26 — Ngưỡng MQ-2 bảo trì và cảnh báo

- **Chức năng truy vết:** AT-01, CH-01.
- **Mục đích:** Xác minh ngưỡng MQ-2 chỉ chỉnh được trong Bảo trì/Hiệu chuẩn và không vô hiệu hóa bảo vệ.
- **Trạng thái ban đầu:** MQ-2 sẵn sàng, có ngưỡng hợp lệ và người dùng ở quyền thông thường.
- **Đầu vào/điều kiện thử:** Đổi ngưỡng ngoài bảo trì; giá trị ngoài giới hạn; giá trị hợp lệ trong bảo trì; tín hiệu vượt ngưỡng.
- **Các bước:** Gửi ba loại cấu hình; kiểm tra phiên bản; tạo tín hiệu thử theo quy trình an toàn; quan sát cảnh báo.
- **Kết quả mong đợi:** Hai yêu cầu sai bị từ chối toàn bộ; yêu cầu hợp lệ được đồng bộ; vượt ngưỡng kích hoạt cảnh báo nhưng không tự bật quạt, cắt tải hoặc mở khóa.
- **Nơi lấy minh chứng:** Phản hồi cấu hình, log phiên bản, video còi/LED và nhật ký.
- **Tiêu chí đạt/không đạt:** Đạt khi quyền/giới hạn/hành vi cơ cấu đúng; không đạt nếu có thể đặt ngưỡng vô hiệu hóa hoặc điều khiển tải ngoài phạm vi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT27 — Cảm biến lửa và cảnh báo độc lập

- **Chức năng truy vết:** AT-02, CB-01.
- **Mục đích:** Xác minh phát hiện dấu hiệu lửa hoạt động ở mọi hồ sơ/phương thức.
- **Trạng thái ban đầu:** Cảm biến lửa đã xác minh cực tính/ngưỡng, không có cảnh báo.
- **Đầu vào/điều kiện thử:** Tín hiệu thử an toàn lần lượt ở Ở nhà, Ra ngoài và Ban đêm.
- **Các bước:** Kích thích theo quy trình an toàn; quan sát phát hiện, còi/LED, ứng dụng và nhật ký; xóa kích thích rồi xác nhận.
- **Kết quả mong đợi:** Cảnh báo AN_TOAN xuất hiện trong cả ba hồ sơ, độc lập Tự động/Thủ công; không tự điều khiển quạt, tải điện hoặc cửa.
- **Nơi lấy minh chứng:** Video, log UNO/MQTT và bản ghi cảnh báo.
- **Tiêu chí đạt/không đạt:** Đạt khi ba lượt nhất quán; không đạt nếu hồ sơ/phương thức vô hiệu hóa hoặc gây hành động ngoài phạm vi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT28 — Lỗi cảm biến an toàn là cảnh báo suy giảm

- **Chức năng truy vết:** AT-01, AT-02, CB-01.
- **Mục đích:** Phân biệt lỗi cảm biến với phát hiện khí/lửa.
- **Trạng thái ban đầu:** Cảm biến đang bình thường và không có cảnh báo an toàn.
- **Đầu vào/điều kiện thử:** Tạo mất/giá trị bất khả tín lần lượt cho MQ-2 và cảm biến lửa theo phương pháp kiểm thử đã phê duyệt.
- **Các bước:** Gây lỗi; quan sát mã/chất lượng; phục hồi; đối chiếu giao diện và nhật ký.
- **Kết quả mong đợi:** Tạo nguyên nhân HE_THONG/LOI_CAM_BIEN riêng, không ghi “phát hiện khí” hoặc “phát hiện lửa”; phục hồi có sự kiện tương ứng.
- **Nơi lấy minh chứng:** Log lỗi, giao diện cảnh báo và cơ sở dữ liệu.
- **Tiêu chí đạt/không đạt:** Đạt khi phân loại và thông điệp đúng; không đạt nếu báo động nguy cơ giả hoặc im lặng trước suy giảm.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT29 — Không thể vô hiệu hóa cảnh báo an toàn

- **Chức năng truy vết:** CB-01, UD-01.
- **Mục đích:** Xác minh giao diện/API không có đường tắt phân hệ an toàn.
- **Trạng thái ban đầu:** Người dùng đã đăng nhập; có một cảnh báo an toàn đang hoạt động.
- **Đầu vào/điều kiện thử:** Tìm/thử thao tác tắt phân hệ; Tắt tiếng còi; thay đổi hồ sơ/phương thức.
- **Các bước:** Kiểm tra giao diện và API; gửi Tắt tiếng; đổi Tự động/Thủ công và hồ sơ; quan sát nguyên nhân.
- **Kết quả mong đợi:** Không có lệnh vô hiệu hóa; Tắt tiếng chỉ dừng còi; nguyên nhân/trạng thái vẫn tồn tại và hoạt động không phụ thuộc hồ sơ/phương thức.
- **Nơi lấy minh chứng:** Kiểm thử API, quay màn hình và log máy trạng thái.
- **Tiêu chí đạt/không đạt:** Đạt khi không thể vô hiệu hóa; không đạt nếu bất kỳ thao tác tiện nghi/hồ sơ nào xóa hoặc ngăn bảo vệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT30 — Nhiều nguyên nhân cảnh báo đồng thời

- **Chức năng truy vết:** CB-01, AT-01, AT-02, AN-05, DL-01.
- **Mục đích:** Xác minh một cảnh báo tổng hợp giữ được nhiều nguyên nhân độc lập.
- **Trạng thái ban đầu:** Ra ngoài hoặc Ban đêm; cảm biến sẵn sàng; không cảnh báo.
- **Đầu vào/điều kiện thử:** Kích hoạt hai hoặc ba nguyên nhân; cho từng nguyên nhân hết ở thời điểm khác nhau.
- **Các bước:** Tạo nguyên nhân thứ nhất rồi thứ hai; tắt tiếng; tạo hoặc tái kích hoạt nguyên nhân; lần lượt loại bỏ; xác nhận cuối.
- **Kết quả mong đợi:** Danh sách nguyên nhân đầy đủ; mức tổng theo nguyên nhân cao nhất; nguyên nhân mới làm còi kêu lại; chỉ Chờ xác nhận khi tất cả hết; nhật ký không mất bản ghi.
- **Nơi lấy minh chứng:** Log máy trạng thái, video còi, giao diện và truy vấn dữ liệu.
- **Tiêu chí đạt/không đạt:** Đạt khi vòng đời đúng cho mọi thứ tự; không đạt nếu một nguyên nhân ghi đè/xóa nguyên nhân khác.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT31 — An toàn và an ninh khi ngoại tuyến

- **Chức năng truy vết:** AT-01, AT-02, AN-05, CB-01, MN-01.
- **Mục đích:** Xác minh ba nguồn cảnh báo bắt buộc vẫn hoạt động khi Internet bị mất.
- **Trạng thái ban đầu:** Ra ngoài hoặc Ban đêm; cảm biến sẵn sàng; cấu hình đã đồng bộ; sau đó ngắt mạng.
- **Đầu vào/điều kiện thử:** Lần lượt tạo điều kiện MQ-2, lửa và xâm nhập vùng SRF04; sau đó khôi phục mạng.
- **Các bước:** Ngắt mạng; kích hoạt từng nguồn; quan sát phản ứng cục bộ/hàng đợi; nối lại; kiểm tra gửi bù.
- **Kết quả mong đợi:** Mỗi nguồn kích còi/LED cục bộ và được xếp hàng; không tự điều khiển quạt/cửa/tải; nối lại gửi sự kiện đúng ID một lần.
- **Nơi lấy minh chứng:** Video ngoại tuyến, log UNO/ESP32, hàng đợi và cơ sở dữ liệu sau nối lại.
- **Tiêu chí đạt/không đạt:** Đạt khi bảo vệ cục bộ và gửi bù đầy đủ; không đạt nếu phải có mạng hoặc hành động ngoài phạm vi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT36 — Thu thập và hiển thị mức sáng đầu-cuối

- **Chức năng truy vết:** MT-03, UD-01, DL-01.
- **Mục đích:** Xác minh mức sáng hợp lệ đi trọn chuỗi UNO → ESP32 → máy chủ → ứng dụng.
- **Trạng thái ban đầu:** Hệ thống trực tuyến; LDR và mạch chia áp đã kiểm kê/hiệu chỉnh; không có lỗi.
- **Đầu vào/điều kiện thử:** Tối thiểu ba chu kỳ lấy mẫu; che và chiếu sáng LDR ở các mức quan sát được.
- **Các bước:** Khởi động; theo dõi log UNO/ESP32; mở Tổng quan; thay đổi ánh sáng; đối chiếu ADC, mức 0–100%, thời điểm và chất lượng ở từng tầng.
- **Kết quả mong đợi:** Mức sáng thay đổi đúng chiều đã hiệu chỉnh, nằm trong 0–100%, cập nhật ứng dụng không quá 5 giây trong mạng bình thường và tạo mẫu lưu theo chính sách một phút.
- **Nơi lấy minh chứng:** Log hai board, bản tin mạng, ảnh Tổng quan và bản ghi cơ sở dữ liệu.
- **Tiêu chí đạt/không đạt:** Đạt khi giá trị/thời gian/chất lượng khớp toàn chuỗi; không đạt nếu sai miền, sai chiều hoặc dữ liệu lỗi được trình bày là hợp lệ.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT37 — Servo khóa/mở ở mức trạng thái lệnh

- **Chức năng truy vết:** AN-02.
- **Mục đích:** Xác minh servo thi hành lệnh nhưng hệ thống không suy diễn trạng thái cửa/chốt cơ khí khi không có phản hồi riêng.
- **Trạng thái ban đầu:** Thiết kế nguồn/cơ khí đã vượt cổng an toàn Giai đoạn 5; Ở nhà; không cảnh báo an ninh.
- **Đầu vào/điều kiện thử:** Lệnh Khóa và Mở khóa hợp lệ; một lần mô phỏng servo không phản hồi.
- **Các bước:** Gửi từng lệnh; quan sát servo và ACK; kiểm tra trường `lenh_chot_khoa`, trạng thái servo và `xac_minh_co_khi`; gây timeout có kiểm soát.
- **Kết quả mong đợi:** Lệnh hợp lệ thi hành/ACK đúng; `xac_minh_co_khi=false` trong mọi trường hợp; giao diện không ghi “Cửa đã khóa/mở”; timeout tạo Không xác định/Suy giảm.
- **Nơi lấy minh chứng:** Video servo, log lệnh/ACK và ảnh giao diện.
- **Tiêu chí đạt/không đạt:** Đạt khi trạng thái lệnh và bằng chứng cơ khí được tách rõ; không đạt nếu hệ thống khẳng định trạng thái cửa/chốt không được đo.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT38 — Phát hiện xâm nhập vùng cửa bằng SRF04

- **Chức năng truy vết:** AN-05, CB-01, DL-01.
- **Mục đích:** Xác minh kịch bản an ninh thật bằng cảm biến siêu âm có trong kit.
- **Trạng thái ban đầu:** SRF04 đã xác minh chân/điện áp và hiệu chỉnh vùng; Ra ngoài hoặc Ban đêm; vùng cửa trống và được trang bị.
- **Đầu vào/điều kiện thử:** Đưa đối tượng vào vùng theo điều kiện xác nhận; gây một nhiễu ngắn không đủ điều kiện; sau đó đưa đối tượng ra.
- **Các bước:** Ghi khoảng cách nền; tạo nhiễu ngắn; tạo xâm nhập hợp lệ; quan sát trạng thái vùng/cảnh báo; loại bỏ nguyên nhân và xác nhận.
- **Kết quả mong đợi:** Nhiễu ngắn không báo; xâm nhập hợp lệ chuyển `PHAT_HIEN_DOI_TUONG`, kích cảnh báo cục bộ và ghi sự kiện; khi cảm biến lỗi dùng `KHONG_XAC_DINH`, không suy ra trạng thái cửa.
- **Nơi lấy minh chứng:** Video SRF04/còi, log khoảng cách và điều kiện xác nhận, bản ghi sự kiện.
- **Tiêu chí đạt/không đạt:** Đạt khi khử nhiễu, phát hiện và phân loại đúng; không đạt nếu báo từ nhiễu, bỏ lọt điều kiện thử hoặc ghi thành “cửa mở”.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

## 5. Trường hợp kiểm thử có điều kiện

### KT34 — Thông báo trình duyệt chống lặp

- **Chức năng truy vết:** TB-01, CB-01.
- **Mục đích:** Xác minh thông báo ngoài trang mở không bị gửi lặp theo cùng mã cảnh báo.
- **Trạng thái ban đầu:** TB-01 được duyệt/triển khai; trình duyệt đã cấp quyền; một phiên đăng nhập hợp lệ.
- **Đầu vào/điều kiện thử:** Một cảnh báo mới, bản cập nhật cùng ID và một cảnh báo ID mới.
- **Các bước:** Kích hoạt; quan sát thông báo; gửi lại/cập nhật cùng ID; kích hoạt ID mới; thử trường hợp từ chối quyền.
- **Kết quả mong đợi:** Mỗi ID chỉ tạo một thông báo mới; cập nhật không spam; từ chối quyền không làm mất cảnh báo trong ứng dụng.
- **Nơi lấy minh chứng:** Quay màn hình, log dịch vụ thông báo và trạng thái đã gửi.
- **Tiêu chí đạt/không đạt:** Đạt khi chống lặp và fallback đúng; nếu TB-01 không triển khai thì ghi KHÔNG ÁP DỤNG kèm quyết định phạm vi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

### KT35 — Cảm biến âm thanh hoặc thiết bị phụ

- **Chức năng truy vết:** MR-01.
- **Mục đích:** Xác minh chức năng phụ chỉ khi được chốt mà không ảnh hưởng nhóm A.
- **Trạng thái ban đầu:** MR-01 đã được duyệt với module cụ thể còn lại trong kit; SRF04 không được dùng lại vì đã dành cho AN-05.
- **Đầu vào/điều kiện thử:** Tín hiệu hợp lệ và nhiễu theo tiêu chí riêng của module đã chọn.
- **Các bước:** Kích thích; quan sát lọc, sự kiện hoặc đầu ra; kiểm tra ngoại tuyến; chạy hồi quy nhóm A liên quan.
- **Kết quả mong đợi:** Hành vi đúng đặc tả bổ sung, có ACK/nhật ký nếu có lệnh và không làm giảm tài nguyên/độ tin cậy nhóm A.
- **Nơi lấy minh chứng:** Log, video module/tải và kết quả hồi quy.
- **Tiêu chí đạt/không đạt:** Đạt khi chức năng riêng và hồi quy đều đúng; nếu MR-01 không triển khai thì ghi KHÔNG ÁP DỤNG kèm quyết định phạm vi.
- **Kết quả thực tế:** `CHƯA THỰC HIỆN`.

## 6. Mã kiểm thử ngừng áp dụng trong phiên bản 1.1

| Mã lịch sử | Ý nghĩa cũ | Lý do ngừng | Thay thế/truy vết mới |
|---|---|---|---|
| KT01 | Đọc nhiệt độ, độ ẩm và ánh sáng đầu-cuối | Không mua cảm biến nhiệt độ/độ ẩm; không đổi ý nghĩa KT01 | KT36 cho mức sáng |
| KT05 | Tự động quạt theo nhiệt độ | TD-01 ngừng; quạt chỉ còn điều khiển Thủ công | KT03 cho điều khiển quạt Thủ công |
| KT22 | Servo, trạng thái cửa và xác minh chốt | Không có cảm biến cửa/chốt; không được khẳng định trạng thái cơ khí | KT37 cho trạng thái lệnh servo |
| KT23 | Cảm biến cửa và cảnh báo xâm nhập | Không mua cảm biến cửa | KT38 cho vùng cửa SRF04 |
| KT32 | Phát hiện rung bằng SW-420 | Không mua và không triển khai SW-420 | Không có |
| KT33 | Mã PIN tại chỗ | Không mua và không triển khai bàn phím | Không có |

Các mã trên không được dùng lại cho hành vi khác ở những phiên bản sau.

## 7. Cổng hoàn thành kiểm thử

Một trường hợp chỉ được chuyển khỏi `CHƯA THỰC HIỆN` khi:

1. phần cứng và phần mềm liên quan có phiên bản nhận diện được;
2. điều kiện ban đầu và dữ liệu thử được ghi lại;
3. có đủ minh chứng tại các nơi đã nêu;
4. kết quả thực tế được mô tả, không chỉ ghi ĐẠT/KHÔNG ĐẠT;
5. sai lệch có mã lỗi hoặc liên kết issue;
6. người dùng xác nhận phần thao tác vật lý khi GPT không thể tự thực hiện;
7. không dùng mô phỏng để tuyên bố thiết bị thật đã đạt nếu tiêu chí yêu cầu phần cứng thật.

Ở thời điểm phát hành tài liệu này, toàn bộ 32 trường hợp đang áp dụng vẫn là `CHƯA THỰC HIỆN`; không có kết quả thực nghiệm nào được suy diễn từ thiết kế.

## 8. Lịch sử sửa đổi

| Phiên bản | Trạng thái | Nội dung | Lý do/ảnh hưởng |
|---|---|---|---|
| 1.0 | Đã thay thế — chỉ giữ lịch sử | 24 kiểm thử ban đầu của Đặc tả 1.0 | Nguồn lịch sử để truy vết. |
| 1.1 | **ĐÃ DUYỆT — 26/09/2026** | 32 kiểm thử đang áp dụng: 30 bắt buộc, 2 có điều kiện; bảo lưu sáu mã ngừng; thay kiểm thử DHT/cửa/rung/PIN bằng kiểm thử ánh sáng, servo trạng thái lệnh và SRF04 | Đồng bộ quyết định không mua thêm linh kiện mà không tái sử dụng mã hoặc bịa kết quả. |

**TRẠNG THÁI KHÓA:** Ma trận 1.1 là đường cơ sở kiểm thử đã duyệt. Toàn bộ kết quả thực tế vẫn là `CHƯA THỰC HIỆN`; chưa có kiểm thử nào được đánh dấu ĐẠT.
