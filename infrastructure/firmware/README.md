# Công cụ firmware cho lượt phần cứng Giai đoạn 17

Các script trong thư mục này chuẩn bị thao tác board nhưng không tự tuyên bố cổng phần cứng đạt.

## 1. Liệt kê cổng COM

Chỉ cắm một board tại một thời điểm rồi chạy:

```powershell
.\infrastructure\firmware\Get-BoardPorts.ps1
```

Với máy có nhiều cổng COM, chụp mốc khi chưa cắm board rồi so sánh từng board:

```powershell
.\infrastructure\firmware\Get-BoardPorts.ps1 -SaveSnapshot .\data\logs\hardware\ports-baseline.json
# Chỉ cắm UNO
.\infrastructure\firmware\Get-BoardPorts.ps1 -CompareSnapshot .\data\logs\hardware\ports-baseline.json -SaveSnapshot .\data\logs\hardware\ports-uno.json
# Rút UNO, chỉ cắm ESP32
.\infrastructure\firmware\Get-BoardPorts.ps1 -CompareSnapshot .\data\logs\hardware\ports-baseline.json -SaveSnapshot .\data\logs\hardware\ports-esp32.json
```

Cổng mang nhãn `Mới xuất hiện` là ứng viên của board duy nhất vừa cắm. Snapshot luôn ghi `hardware_evidence=false`; người dùng vẫn phải đối chiếu thao tác vật lý. Tên chip USB như CH340 không đủ để phân biệt hai board nếu cả hai cùng dùng CH340.

## 2. Tiền kiểm máy phát triển, không chạm board

```powershell
pnpm check:hardware-preparation
```

Lệnh kiểm tra PlatformIO/kho cục bộ, binary hai firmware, ba cờ an toàn, công cụ vận hành và Mosquitto portable. Nó chỉ ghi `data/logs/hardware/stage17-hardware-preparation.json` với `hardware_evidence=false`, `upload_performed=false` và mọi cổng con người vẫn `CHƯA THỰC HIỆN`. Lệnh không đọc nội dung secret, không khởi động broker và không nạp board.

## 3. Ghi biên bản Checkpoint 1 chờ duyệt

Sau khi đã có ba snapshot, ảnh và số đo thật, ghép dữ liệu bằng:

```powershell
.\infrastructure\firmware\Record-HardwareCheckpoint1.ps1 `
  -BaselineSnapshot .\data\logs\hardware\ports-baseline.json `
  -UnoSnapshot .\data\logs\hardware\ports-uno.json `
  -Esp32Snapshot .\data\logs\hardware\ports-esp32.json `
  -UnoRailV 5.01 -Esp32RailV 4.98 -GroundDeltaV 0.02 `
  -PhotoPath .\duong-dan\uno.jpg,.\duong-dan\esp32.jpg
```

Các số trong ví dụ chỉ minh họa cú pháp, không được sao chép làm kết quả. Công cụ yêu cầu đúng một COM mới cho mỗi board, kiểm tra số học theo dải nguồn và ghi `review_status=PENDING_GPT_REVIEW`, `gate_decision=CHƯA ĐÁNH GIÁ`. Giá trị ngoài dải tạo `STOP_OUT_OF_RANGE`; giá trị trong dải vẫn không phải quyết định `ĐẠT`.

## 4. Build không nạp

```powershell
.\infrastructure\firmware\Upload-Firmware.ps1 -Board uno -BuildOnly
.\infrastructure\firmware\Upload-Firmware.ps1 -Board esp32 -BuildOnly
```

Script từ chối build/nạp UNO nếu ba cờ MQ-2, flame hoặc còi không còn bằng `0`. Build ESP32 không cần secret; nạp ESP32 yêu cầu `include/secrets.hpp` đã thay giá trị mẫu.

Script ép PlatformIO dùng `tools/.pio-core/` trong dự án, không ghi trạng thái vào hồ sơ người dùng. Ngày 29/09/2026, cả hai lệnh build-only đã đạt; kết quả này không đồng nghĩa firmware đã được nạp hoặc chạy trên board.

## 5. Nạp có xác nhận

Ví dụ sau khi đã xác minh cổng:

```powershell
.\infrastructure\firmware\Upload-Firmware.ps1 -Board uno -Port COM3
.\infrastructure\firmware\Upload-Firmware.ps1 -Board esp32 -Port COM4
```

Mỗi lượt build lại trước khi nạp và yêu cầu xác nhận mức `High`. Có thể dùng `-WhatIf` để xem trước. Không dùng `-Confirm:$false` trong lượt đầu.

Trước khi nạp:

- cấp mỗi board bằng đúng một cáp USB riêng;
- chưa nối MQ-2, flame, còi, servo, motor hoặc relay;
- chưa nối UART hai board nếu mức logic chưa đo;
- xác nhận đúng cổng COM bằng cách cắm từng board riêng.

## 6. Thu log serial có giới hạn

Xem trước trước khi mở cổng serial:

```powershell
.\infrastructure\firmware\Capture-SerialLog.ps1 -Port COM3 -DurationSeconds 60 -WhatIf
.\infrastructure\firmware\Capture-SerialLog.ps1 -Port COM3 -DurationSeconds 60
```

Công cụ chỉ nhận 115200 baud, giữ DTR/RTS tắt, dừng sau thời gian cấu hình và ghi log thô vào `data/logs/hardware/`. Việc mở serial vẫn có thể làm một số board reset; chỉ chạy sau khi đã xác nhận COM. Log rỗng được ghi trung thực và capture không tự chứng minh board đạt.

Có thể kiểm tra toàn bộ nhánh an toàn của công cụ mà không cần board:

```powershell
pnpm test:hardware-tooling
```

Bài hồi quy dùng fixture và `-WhatIf`, không mở serial hoặc nạp firmware.

## 7. Che log trước khi gửi

```powershell
.\infrastructure\firmware\Redact-IntegrationLog.ps1 -InputPath .\duong-dan\serial.log
```

Bản che mặc định nằm trong `data/logs/hardware/`. Công cụ che token, cookie, SSID, userinfo trong URL MQTT, MAC và IP ngoài loopback. Nó từ chối xử lý trực tiếp `secrets.hpp`, `server.local.env` hoặc `.env`; các file đó không được gửi. Luôn mở bản `.redacted.log` và rà soát thủ công trước khi chia sẻ.

Mẫu hồi quy giả tại `tests/integration/fixtures/stage17-redaction-*.fixture` đã xác nhận các lớp thông tin trên được che; mẫu không chứa credential thật.

Phiếu ghi số đo và đường dẫn minh chứng nằm tại `docs/19a-phieu-bang-chung-phan-cung.md`.
