# KIỂM SOÁT THAY ĐỔI CR-01 — THAY BỘ KIT VÀ HIỆU CHỈNH PHẠM VI TRƯỚC DUYỆT 1.1

## 1. Quyết định

- **Thay đổi:** dùng bộ **BLK UNO R3 và 55+ mạch điện tử cơ bản** thay cho phương án UNO R3 Plus trước đó.
- **Giữ nguyên:** tên đề tài, kiến trúc tổng quát UNO + ESP32, khung 29 giai đoạn và mục tiêu giám sát–điều khiển–tự động hóa.
- **Quyết định phạm vi ngày 26/09/2026:** không mua thêm linh kiện; ngừng nhiệt độ/độ ẩm, tự động quạt theo nhiệt độ, cảm biến cửa, SW-420 và bàn phím PIN; giữ quạt điều khiển thủ công; dùng SRF04 cho an ninh vùng cửa; giữ servo nhưng không tuyên bố xác minh cửa/chốt.
- **Phân biệt nguyên nhân:** các chức năng trên chỉ bị ngừng vì có quyết định phạm vi rõ ràng, không phải do hệ thống tự suy diễn rằng thiếu linh kiện thì phải xóa chức năng.

## 2. Quy tắc đánh giá tác động

| Loại tác động | Cách xử lý |
|---|---|
| Linh kiện khác nhưng chức năng tương đương | Cập nhật Danh mục phần cứng/Giai đoạn 5; không đổi đặc tả nghiệp vụ |
| Linh kiện ngoài bộ cơ sở | Không mua; thay bằng linh kiện sẵn có hoặc mở quyết định phạm vi, không âm thầm đổi nghĩa mã chức năng |
| Tải động có trong kit nhưng chưa chứng minh nguồn | Đánh dấu `CHỜ_GĐ5_XÁC_MINH_NGUỒN`; không loại ở Giai đoạn 2 |
| Người dùng chủ động bỏ/thay chức năng | Mở lại Giai đoạn 1, tăng phiên bản, cập nhật ma trận kiểm thử và README |
| Kiểm thử phụ thuộc linh kiện chưa có | Giữ nguyên mã kiểm thử; khi thực thi ghi `BỊ_CHẶN`, không tái sử dụng mã |

## 3. Tác động hiện tại

- **Đặc tả 1.1:** giữ nguyên ý nghĩa các mã còn hoạt động; đưa mã bị ngừng vào bảng lịch sử; thêm mã mới cho giám sát ánh sáng và an ninh SRF04 thay vì tái sử dụng mã cũ.
- **Ma trận kiểm thử 1.1:** có 32 ca đang áp dụng (30 bắt buộc, 2 có điều kiện); giữ nguyên ý nghĩa mã còn hoạt động, bảo lưu sáu mã ngừng và dùng số mới cho kiểm thử thay thế.
- **Danh mục phần cứng 1.1:** không có danh sách mua; DHT22/AM2302, MC-38, SW-420, bàn phím và RTC chuyển `KHÔNG_DÙNG`; SRF04 chuyển sang nhóm A; servo, động cơ và relay tiếp tục `CHỜ_GĐ5_XÁC_MINH_NGUỒN`.
- **Quy trình:** 29 giai đoạn không đổi.

## 4. Trạng thái

**ĐÃ DUYỆT — 26/09/2026** cùng Đặc tả, Ma trận kiểm thử và Danh mục phần cứng phiên bản 1.1. Giai đoạn 1–2 đã khóa; thay đổi tiếp theo phải mở yêu cầu kiểm soát thay đổi mới.
