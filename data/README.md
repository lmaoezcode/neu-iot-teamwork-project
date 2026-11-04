# Dữ liệu runtime

Thư mục này dành cho `smartroom.sqlite3`, hai tệp WAL/SHM liên quan, log và thư mục `backups/` cục bộ. Dữ liệu thật không được commit hoặc đưa vào báo cáo nếu chưa được người dùng cung cấp làm minh chứng.

Không sao chép riêng tệp `.sqlite3` khi máy chủ đang chạy. Dùng công cụ sao lưu trực tuyến được mô tả tại [`infrastructure/database/README.md`](../infrastructure/database/README.md).
