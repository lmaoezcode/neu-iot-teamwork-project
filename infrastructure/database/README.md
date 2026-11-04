# Vận hành cơ sở dữ liệu SQLite

## 1. Phạm vi

Các công cụ ở đây phục vụ cơ sở dữ liệu của một phòng thông minh. Chúng áp dụng migration có kiểm tra checksum, dọn dữ liệu hết hạn theo lô nhỏ và tạo bản sao nhất quán bằng giao diện sao lưu trực tuyến của SQLite.

Tệp mặc định là `data/smartroom.sqlite3` tính từ gốc dự án. Biến `DB_FILE` hoặc tham số `--db` có thể chọn tệp khác. Đường dẫn tương đối luôn được quy về gốc dự án, không phụ thuộc thư mục gọi lệnh.

Yêu cầu: Node.js từ 22, pnpm và phụ thuộc workspace đã được cài đặt.

## 2. Migration và kiểm tra toàn vẹn

Chạy từ thư mục gốc:

```powershell
pnpm db:migrate
```

Chọn tệp riêng:

```powershell
pnpm db:migrate -- --db .\data\smartroom-thu.sqlite3
```

Lệnh tự tạo thư mục/tệp nếu chưa tồn tại, áp dụng migration còn thiếu rồi in `journalMode`, `foreignKeys`, `integrity`, `userVersion` và checksum. Migration đã áp dụng là bất biến: nếu tên hoặc checksum không khớp, lệnh dừng thay vì sửa âm thầm cơ sở dữ liệu.

## 3. Dọn dữ liệu hết hạn

```powershell
pnpm db:retention
```

Có thể ghi đè chính sách cho một lần chạy:

```powershell
pnpm db:retention -- --retention-days 30 --batch-size 500
```

Mỗi bảng chỉ xóa tối đa số dòng của `batch-size` trong một giao dịch. Tác vụ bảo vệ cấu hình desired/reported hiện hành, trạng thái mới nhất, lệnh đang chờ, cảnh báo còn hoạt động và outbox chưa xử lý. Máy chủ cũng chạy tác vụ này định kỳ theo `RETENTION_INTERVAL_SECONDS`.

## 4. Sao lưu và phục hồi

Tạo bản sao có tên thời gian trong `data/backups/`:

```powershell
pnpm db:backup
```

Hoặc chọn đích mới, chưa tồn tại:

```powershell
pnpm db:backup -- --output .\data\backups\truoc-tich-hop.sqlite3
```

Công cụ không ghi đè tệp có sẵn. Sau sao lưu, nó mở lại bản sao, áp dụng kiểm tra migration và yêu cầu `PRAGMA integrity_check` trả về `ok`. Vì dùng giao diện sao lưu trực tuyến, không cần sao chép thủ công tệp WAL/SHM.

Quy trình phục hồi an toàn:

1. dừng máy chủ ứng dụng;
2. giữ nguyên tệp lỗi để có thể điều tra, không ghi đè ngay;
3. chạy `db:migrate` với `--db` trỏ vào bản sao để kiểm tra lại checksum/toàn vẹn;
4. sửa `DB_FILE` trong `config/server.local.env` để trỏ tới bản sao đã kiểm tra;
5. khởi động máy chủ và kiểm tra `/health`, đăng nhập, cấu hình hiện hành và nhật ký;
6. chỉ coi phục hồi hoàn tất sau khi các kiểm tra trên thành công.

## 5. Bảo mật và giới hạn bằng chứng

- Tệp DB và bản sao chứa mã băm mật khẩu, phiên, cấu hình, lịch sử và nhật ký; chỉ cấp quyền đọc cho tài khoản chạy máy chủ.
- Không commit tệp DB, WAL, SHM hoặc bản sao. `data/backups/` đã được loại khỏi quản lý mã nguồn.
- Không chỉnh migration đã áp dụng; tạo migration tăng phiên bản cho thay đổi lược đồ sau này.
- Kết quả công cụ/kiểm thử trong Giai đoạn 15 là bằng chứng phần mềm trên máy phát triển, không phải bằng chứng cảm biến hoặc phần cứng thật.
