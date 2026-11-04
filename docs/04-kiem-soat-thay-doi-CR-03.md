# KIỂM SOÁT THAY ĐỔI CR-03 — TÍNH DUY NHẤT CỦA `message_id` ESP32

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Mã thay đổi | CR-03 |
| Ngày | 28/09/2026 |
| Trạng thái | **ĐÃ DUYỆT — 28/09/2026** |
| Nguồn phát hiện | Kiểm tra tích hợp tĩnh máy chủ–MQTT–firmware ở Giai đoạn 14 |
| Loại | Sửa lỗi tương thích; không đổi phạm vi, topic, JSON hay hành vi nghiệp vụ |

## 2. Lỗi và nguyên nhân

Firmware ESP32 tạo `message_id` của `config/reported` từ `config_version`. Một phiên bản cấu hình có thể phát lần lượt `pending` rồi `applied` hoặc `rejected`, nên hai payload khác nhau có cùng ID. Máy chủ tuân thủ MQTT 1.0 sẽ khử trùng lặp theo ID và có thể bỏ nhầm kết quả cuối.

Ngoài ra, ID telemetry/state trước đây có boot ID của ESP32 nhưng không có boot ID của UNO. Nếu UNO khởi động lại trong khi ESP32 vẫn chạy, bộ đếm cục bộ của UNO có thể bắt đầu lại và va chạm ID cũ.

## 3. Thay đổi đã áp dụng

- Hàm tạo ID chung bổ sung `uno_boot_id`; phần hiển thị device/category được giới hạn để ID không vượt 64 byte.
- Mỗi lần phát `config/reported` dùng một bộ đếm thông điệp mới, còn `config_version` vẫn nằm trong `data` và không đổi ý nghĩa.
- Không đổi tên topic, QoS, retain, schema JSON, API, cấu hình, mã chức năng hay mã kiểm thử.

## 4. Tác động và quyết định phiên bản

| Thành phần | Tác động |
|---|---|
| Thiết kế MQTT 1.0 | Không đổi; mã được sửa để tuân thủ yêu cầu ID duy nhất đã khóa. |
| Firmware ESP32 | Bản dựng bảo trì `1.0+r1`; cần build lại, chưa phải bằng chứng đã nạp board. |
| Máy chủ | Tiếp tục khử trùng lặp theo `(device_id, message_id)`; không thêm ngoại lệ sai chuẩn. |
| Kiểm thử | Build đích, host vector và kiểm thử máy chủ phải chạy lại. |
| Phiên bản tài liệu thiết kế | Không tăng vì không đổi giao diện đã duyệt; CR-03 lưu dấu sửa lỗi hiện thực. |

## 5. Tiêu chí đóng

- ESP32 build thành công sau sửa lỗi.
- Các vector host của ESP32 vẫn đạt.
- Kiểm thử máy chủ chứng minh `pending` và `applied` có thể đi qua khử trùng lặp bằng ID riêng.
- Không tuyên bố đã nạp hoặc chạy phần cứng trước khi có bằng chứng vật lý.

Kết quả ngày 28/09/2026:

| Cổng | Kết quả |
|---|---|
| Build ESP32 đích | **ĐẠT** — RAM 17,9%, flash 67,7% |
| `check-stage12.mjs` | **ĐẠT** — không có lỗi |
| Vector codec ESP32 trên host | **ĐẠT** |
| Kiểm thử máy chủ `pending → applied` cùng `config_version` và hai ID riêng | **ĐẠT** |
| Nạp/chạy board thật | **CHƯA THỰC HIỆN** — không phải điều kiện phê duyệt bản sửa phần mềm |

CR-03 được người dùng duyệt cùng Giai đoạn 14 ngày 28/09/2026 và được đóng. Việc đóng không được hiểu là firmware đã nạp hoặc chạy trên board thật.
