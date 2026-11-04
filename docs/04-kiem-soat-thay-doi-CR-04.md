# KIỂM SOÁT THAY ĐỔI CR-04 — HIỂN THỊ CẢNH BÁO CHỜ XÁC NHẬN

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Mã thay đổi | CR-04 |
| Ngày | 28/09/2026 |
| Trạng thái | **ĐÃ DUYỆT CÙNG GIAI ĐOẠN 16 — 29/09/2026** |
| Nguồn phát hiện | Nối Thiết kế giao diện 1.0 với API tổng quan ở Giai đoạn 16 |
| Loại | Sửa lỗi hợp đồng tương thích; không đổi phạm vi, MQTT, firmware hoặc lược đồ DB |

## 2. Lỗi và nguyên nhân

Vòng đời cảnh báo yêu cầu nguyên nhân đã hết vẫn tồn tại ở trạng thái `awaiting_ack` để chủ phòng bấm **Xác nhận**. Repository đã lưu được bản ghi này, nhưng `DeviceOverview` chỉ trả `activeAlerts`. Khi nguyên nhân chuyển `active=false`, cảnh báo biến mất khỏi ảnh chụp web dù API xác nhận vẫn cần `alert_id`.

Nếu không sửa, giao diện có thể tắt tiếng khi cảnh báo đang hoạt động nhưng không thể hoàn tất đúng vòng đời sau khi nguyên nhân hết.

## 3. Thay đổi đã áp dụng

- Giữ nguyên `activeAlerts` để không phá vỡ thành phần hiện có.
- Bổ sung `alerts` vào `DeviceOverview`, chứa cả cảnh báo active và cảnh báo đã hết nguyên nhân nhưng còn chờ xác nhận.
- Sự kiện SSE `alert.updated` bổ sung trường `alerts`; vẫn giữ `active_alerts`.
- Thêm kiểm thử hồi quy: cảnh báo `awaiting_ack`, `active=false` có trong `overview.alerts` nhưng không nằm trong `activeAlerts`.
- Không đổi MQTT topic/payload, firmware, bảng DB, mã chức năng hoặc mã kiểm thử chấp nhận.

## 4. Tác động và quyết định phiên bản

| Thành phần | Tác động |
|---|---|
| Máy chủ/API | Mở rộng phản hồi tương thích; client cũ có thể bỏ qua trường mới. |
| Cơ sở dữ liệu | Không migration; dữ liệu đã có đủ để trả danh sách. |
| Ứng dụng web | Dùng `activeAlerts` cho thanh cảnh báo và `alerts` để hiện mục chờ xác nhận. |
| Firmware/MQTT | Không đổi. |
| Tài liệu G14/G15 | Giữ bản đã duyệt; CR-04 ghi dấu bản sửa sau mốc khóa. |

## 5. Tiêu chí đóng

- Typecheck/build máy chủ đạt.
- Kiểm thử mới chứng minh phân biệt `alerts` và `activeAlerts`.
- Giao diện chỉ bật **Xác nhận** khi không còn nguyên nhân active.
- Không làm các cổng hồi quy Giai đoạn 10–15 thất bại.

CR-04 đã được đóng khi người dùng duyệt cùng đầu ra Giai đoạn 16 ngày 29/09/2026. Không có nội dung nào trong thay đổi này là kết quả phần cứng.
