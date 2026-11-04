# XÂY DỰNG BỘ MÔI GIỚI MQTT — PHIÊN BẢN 1.0

## 1. Thông tin kiểm soát

| Thuộc tính | Giá trị |
|---|---|
| Tên tài liệu | Xây dựng và vận hành bộ môi giới MQTT cho phòng thông minh |
| Phiên bản | 1.0 |
| Trạng thái | **ĐÃ DUYỆT — 26/09/2026** |
| Giai đoạn | Giai đoạn 13 — Xây dựng MQTT |
| Ngày tạo | 26/09/2026 |
| Đầu vào đã khóa | Thiết kế MQTT 1.0, Cấu trúc dự án 1.0 và Firmware ESP32 1.0 |
| Đầu ra | Cấu hình Mosquitto, tài khoản, ACL, script khởi tạo/chạy/thử và kiểm tra tĩnh |
| Chưa thuộc giai đoạn | Mã máy chủ, cơ sở dữ liệu, web, tích hợp ESP32 thật, TLS công khai và kết quả phần cứng |

Tài liệu này ghi công việc phần mềm của Giai đoạn 13. Các kiểm tra broker cục bộ nếu được chạy chỉ chứng minh cấu hình/xác thực/ACL trên máy phát triển; không được thay cho KT14–KT21 hoặc bằng chứng ESP32 kết nối Wi-Fi thật.

## 2. Kết quả triển khai

Đầu ra nằm tại `infrastructure/mqtt/`:

| Thành phần | Kết quả |
|---|---|
| `mosquitto.conf.template` | Mẫu cấu hình có token đường dẫn, không chứa bí mật hoặc đường dẫn máy cụ thể |
| `acl` | ACL tường minh cho `room-01-device` và `smartroom-backend` |
| `client.example.conf` | Hồ sơ MQTT 3.1.1 mẫu, chỉ chứa giá trị thay thế |
| `scripts/Common-Mqtt.ps1` | Tìm bộ cài, sinh đường dẫn, tạo cấu hình và hồ sơ client tạm |
| `scripts/Initialize-Mqtt.ps1` | Tạo hai mật khẩu băm SHA-512 PBKDF2 và kiểm tra cấu hình bằng broker |
| `scripts/Start-Mqtt.ps1` | Kiểm tra cấu hình rồi chạy Mosquitto ở tiền cảnh |
| `scripts/Test-Mqtt.ps1` | Smoke test xác thực, ACL, retained message và cách ly thiết bị |
| `tools/check-stage13.mjs` | Kiểm tra tĩnh cấu hình, ACL, bí mật, tài liệu và truy vết |

Thư mục `infrastructure/mqtt/runtime/` chỉ được sinh khi chạy, chứa password hash, cấu hình tuyệt đối, dữ liệu bền vững và log; toàn bộ thư mục bị `.gitignore` loại khỏi quản lý mã nguồn.

## 3. Lựa chọn hiện thực

### 3.1. Bộ môi giới và phiên bản

- Bộ môi giới: **Eclipse Mosquitto**.
- Phiên bản mục tiêu: **2.1.x**, bản x64 chính thức trên Windows; phiên bản tham chiếu hiện hành khi tạo tài liệu là 2.1.2.
- Giao thức client: **MQTT 3.1.1**, đúng ADR-07-01.
- Cấu hình xác thực/ACL dùng `mosquitto_password_file` và `mosquitto_acl_file`, là hai plugin chính thức có từ Mosquitto 2.1.
- Không dùng `per_listener_settings`, `password_file` hoặc `acl_file` kiểu cũ vì các tùy chọn này đã bị đánh dấu không khuyến nghị trong nhánh 2.1.
- Dùng hash `sha512-pbkdf2`: công cụ trong bộ cài Windows 2.1.2 đã tạo/đọc thành công định dạng này, trong khi thử `argon2id` trên đúng bộ cài trả lỗi `Unable to hash password`. Đây là quyết định dựa trên chạy thật của công cụ cục bộ, không phải suy đoán khả năng.

Mosquitto 2.0 không phải đích chạy của bộ script hiện tại vì chưa có hai plugin nói trên và chưa có `--test-config`/hồ sơ client `-o`. Việc khóa 2.1.x giúp quy trình kiểm tra có một đường duy nhất, thay vì âm thầm hạ mức bảo mật theo phiên bản.

### 3.2. Listener và giới hạn

| Thuộc tính | Giá trị | Lý do |
|---|---:|---|
| Cổng | TCP 1883 | ESP32 và máy chủ hoạt động trong cùng LAN ở bản thử nghiệm |
| Địa chỉ mặc định | `0.0.0.0` | Cho phép ESP32 cùng LAN kết nối; có thể khóa vào IP LAN cụ thể khi khởi tạo |
| Truy cập ẩn danh | Tắt | Mọi client phải có danh tính riêng |
| QoS tối đa | 1 | Thiết kế không dùng QoS 2 |
| Payload tối đa | 2.048 byte | Khớp ADR-07-09 |
| Gói MQTT tối đa | 4.096 byte | Đủ phần topic/header bên ngoài payload 2.048 byte và chặn gói bất thường lớn |
| Kết nối đồng thời | 20 | Dư cho một ESP32, một máy chủ và công cụ thử nhưng vẫn có giới hạn |
| Lưu bền vững | Có, tự lưu mỗi 60 giây | Bảo toàn retained snapshot sau broker restart |
| TLS | Chưa bật | Chỉ chấp nhận trong LAN; cấm đưa listener này ra Internet |

`message_size_limit` kiểm soát payload còn `max_packet_size` kiểm soát toàn bộ gói. Với MQTT 3.1.1, client không luôn nhận được reason code chi tiết khi vượt giới hạn; vì vậy firmware và máy chủ vẫn phải tự chặn payload quá 2.048 byte trước khi gửi.

## 4. Danh tính, xác thực và ACL

### 4.1. Tài khoản

| Tài khoản | Đối tượng | Mật khẩu |
|---|---|---|
| `room-01-device` | ESP32 của `room-01` | Người vận hành tạo; băm SHA-512 PBKDF2; không dùng chung tài khoản máy chủ |
| `smartroom-backend` | Dịch vụ máy chủ | Người vận hành tạo riêng; băm SHA-512 PBKDF2 |

Tài khoản MQTT không phải tài khoản đăng nhập web. Client ID ESP32 là `smartroom-room-01-device`; tài khoản chỉ dùng xác thực và không thay `device_id` trong topic/payload.

### 4.2. Ma trận quyền hiện thực

| Tài khoản | Đọc | Ghi |
|---|---|---|
| `room-01-device` | `config/desired`, `commands/request`, `sync/request` của `room-01` | `availability`, `telemetry/sensors`, `state/reported`, `config/reported`, `commands/result`, `events`, `alerts/events`, `alerts/reported`, `sync/status`, `diagnostics` của `room-01` |
| `smartroom-backend` | `smartroom/v1/devices/#` | `smartroom/v1/devices/#` |

Không có quyền mặc định. Thiết bị không được ghi desired/command, không được đọc hoặc ghi phòng khác và không có wildcard. Máy chủ có wildcard đúng phạm vi gốc thiết bị để Giai đoạn 14 quản lý một thiết bị hiện tại mà không thay cấu hình broker khi bổ sung ID hợp lệ về sau.

## 5. QoS, retain và trách nhiệm ngoài broker

ACL chỉ kiểm soát quyền topic; Mosquitto không dùng ACL này để ép QoS/retain riêng cho từng topic. Trách nhiệm được chia như sau:

| Quy tắc | Nơi thực thi |
|---|---|
| QoS 0 cho telemetry/diagnostics; QoS 1 cho dữ liệu nghiệp vụ | ESP32 và máy chủ |
| Retain chỉ cho availability, state/config reported/desired và alerts/reported | ESP32 và máy chủ |
| Không retain command/event/alert event/sync request | Máy chủ/ESP32 và kiểm thử tích hợp |
| TTL, `command_id`, chống lặp và ACK/NACK nghiệp vụ | Máy chủ, ESP32 và UNO |
| Giới hạn payload/gói | Client kiểm tra trước; broker là lớp chặn cuối |
| Lịch sử dữ liệu | Cơ sở dữ liệu ở Giai đoạn 15; không dùng retained message làm lịch sử |

## 6. Quy trình vận hành

### 6.1. Khởi tạo

```powershell
.\infrastructure\mqtt\scripts\Initialize-Mqtt.ps1
```

Script thực hiện theo thứ tự:

1. tìm Mosquitto 2.1.x;
2. tạo thư mục runtime;
3. gọi `mosquitto_passwd` ở chế độ tương tác và SHA-512 PBKDF2 cho hai tài khoản, không đưa mật khẩu vào dòng lệnh;
4. thay token bằng đường dẫn tuyệt đối;
5. gọi `mosquitto --test-config`;
6. chỉ báo hoàn tất nếu mọi bước trả mã thành công.

Tạo lại credential phải dùng `-Force`; thao tác này chủ động thay cả hai mật khẩu và khiến client cũ không kết nối được cho đến khi cập nhật bí mật cục bộ.

### 6.2. Chạy

```powershell
.\infrastructure\mqtt\scripts\Start-Mqtt.ps1
```

Broker chạy ở tiền cảnh để người vận hành thấy lỗi và dừng bằng `Ctrl+C`. Dự án không tự cài dịch vụ Windows, không tự mở tường lửa và không tự công khai listener.

### 6.3. Smoke test

```powershell
.\infrastructure\mqtt\scripts\Test-Mqtt.ps1
```

Bộ thử kiểm tra:

1. kết nối ẩn danh bị từ chối;
2. tài khoản đúng nhưng mật khẩu sai bị từ chối;
3. thiết bị ghi được availability của chính nó;
4. máy chủ đọc được retained state;
5. thiết bị không ghi được `config/desired`;
6. máy chủ ghi và thiết bị đọc được `config/desired`;
7. thiết bị không ghi hoặc đọc được topic của `room-02`;
8. retained dữ liệu thử được xóa ở cuối.

Mật khẩu thử nằm trong hồ sơ tạm dưới `runtime/` bị loại khỏi quản lý mã nguồn và được xóa trong khối `finally`; không ghi vào log kết quả.

## 7. Kết nối với ESP32 và máy chủ

### 7.1. ESP32

`firmware/esp32/include/secrets.hpp` phải dùng:

- IP LAN của máy chạy broker, không dùng `localhost`;
- cổng 1883;
- tài khoản `room-01-device`;
- mật khẩu thiết bị;
- `device_id=room-01`.

ESP32 tiếp tục đặt LWT, clean session và keep-alive như Firmware ESP32 1.0. Broker không biến PUBACK thành xác nhận chấp hành của UNO.

### 7.2. Máy chủ

Giai đoạn 14 sẽ dùng:

```text
MQTT_URL=mqtt://<ip-lan>:1883
MQTT_CLIENT_ID=smartroom-backend
MQTT_USERNAME=smartroom-backend
MQTT_PASSWORD=<bí mật cục bộ>
```

Ứng dụng web không nhận credential MQTT và không kết nối broker trực tiếp.

## 8. An toàn vận hành và giới hạn đã biết

- TCP 1883 không mã hóa username, password và payload trên đường truyền. Chỉ dùng trong LAN riêng/tin cậy; không dùng Wi-Fi công cộng và không NAT/port-forward.
- Nếu cần truy cập ngoài LAN, phải mở một thay đổi thiết kế cho TLS 8883, chứng thư, hostname và quy trình gia hạn; không chỉ đổi số cổng.
- File password băm vẫn là dữ liệu nhạy cảm và chỉ nằm trong runtime cục bộ.
- Script không tự tạo quy tắc Windows Firewall. Nếu cần, người dùng chỉ cho phép TCP 1883 trên profile Private và phạm vi subnet LAN.
- Broker persistence lưu retained/session, không thay sao lưu cơ sở dữ liệu nghiệp vụ.
- Một tài khoản thiết bị hiện gắn cứng với `room-01`. Bổ sung thiết bị đòi hỏi tài khoản và ACL riêng, không tái sử dụng credential.

## 9. Cổng xác minh Giai đoạn 13

| Mã | Nội dung | Tiêu chí | Trạng thái |
|---|---|---|---|
| G13-FILE-01 | Cây file | Đủ template, ACL, script, hướng dẫn và checker | **ĐẠT — kiểm tra tĩnh** |
| G13-CONFIG-01 | Cú pháp broker | Mosquitto 2.1.x chấp nhận cấu hình sinh bằng `--test-config` | **ĐẠT — Mosquitto 2.1.2, 26/09/2026** |
| G13-AUTH-01 | Xác thực | Ẩn danh bị từ chối, hai tài khoản hợp lệ kết nối được | **ĐẠT — smoke test cục bộ** |
| G13-ACL-01 | Quyền thiết bị | Được ghi báo cáo/đọc desired của mình; bị chặn ghi desired | **ĐẠT — smoke test cục bộ** |
| G13-ISOLATION-01 | Cách ly phòng | `room-01-device` không đọc/ghi được `room-02` | **ĐẠT — smoke test cục bộ** |
| G13-RETAIN-01 | Retain | Máy chủ/thiết bị nhận đúng retained message được phép | **ĐẠT — smoke test cục bộ** |
| G13-SECRET-01 | Bí mật | Không commit password/runtime; không dùng `-b` khi tạo tài khoản | **ĐẠT — kiểm tra tĩnh; runtime thử đã xóa** |
| G13-TRACE-01 | Truy vết | Topic/tài khoản/giới hạn khớp Thiết kế MQTT 1.0 và firmware | **ĐẠT — kiểm tra tĩnh** |

### 9.1. Bằng chứng chạy trên máy phát triển

Ngày 26/09/2026, bộ Mosquitto portable 2.1.2 lấy từ trang chính thức đã được dùng để kiểm tra:

- `mosquitto --test-config`: cấu hình hợp lệ;
- listener thử: `127.0.0.1:1883`, không mở ra LAN trong lúc kiểm tra;
- `Test-Mqtt.ps1`: **8 đạt, 0 không đạt**;
- retained dữ liệu thử đã được xóa;
- broker thử đã dừng, credential ngẫu nhiên và toàn bộ `runtime/` thử đã được xóa;
- dịch vụ Windows do bộ cài tạo mặc định đã được gỡ; dự án chỉ giữ bản công cụ portable bị `.gitignore` loại khỏi nguồn.

Hồi quy cuối cùng cùng ngày:

- `check-stage10.mjs`, `check-stage11.mjs`, `check-stage12.mjs`: không có lỗi;
- `check-stage13.mjs`: **14 đạt, 0 không đạt**;
- bộ phân tích PowerShell: cả 4 script MQTT hợp lệ;
- 3 chương trình kiểm thử host của giao thức/luồng UNO và codec ESP32 tiếp tục đạt;
- không còn dịch vụ Mosquitto tự khởi động và không còn thư mục runtime thử.

Mosquitto phát một ghi chú khuyến nghị dùng `max_packet_size` thay `message_size_limit`. Cấu hình chủ động giữ **cả hai**: `message_size_limit=2048` chặn chính xác payload theo ADR-07-09, còn `max_packet_size=4096` chặn toàn bộ gói. Đây là ghi chú khuyến nghị, không phải lỗi cấu hình; broker đã tải plugin, xác thực và chuyển bản tin thành công.

Không cập nhật một ca `KTxx` nào thành `ĐẠT` tại Giai đoạn 13. Các ca chính thức vẫn cần máy chủ/firmware/tích hợp hoặc phần cứng theo ma trận 1.2.

## 10. Lịch sử sửa đổi và điểm duyệt

| Phiên bản | Trạng thái | Nội dung | Lý do/ảnh hưởng |
|---|---|---|---|
| 1.0 | **ĐÃ DUYỆT — 26/09/2026** | Hiện thực Mosquitto 2.1.x, hai tài khoản, ACL tối thiểu, persistence, giới hạn, script vận hành/thử; cấu hình và 8 smoke test cục bộ đã đạt | Người dùng duyệt đầu ra Giai đoạn 13; chưa coi là bằng chứng ESP32 thật đã kết nối broker |

**TRẠNG THÁI KHÓA:** Giai đoạn 13 được người dùng duyệt ngày 26/09/2026. Cấu hình Mosquitto 2.1.2, xác thực, ACL và 8 smoke test broker cục bộ đã đạt; Giai đoạn 14 được phép dùng bộ môi giới này để xây dựng máy chủ. Việc khóa không được hiểu là ESP32 thật đã kết nối broker.

## 11. Tài liệu tham khảo kỹ thuật

1. Eclipse Mosquitto, *Download*: <https://mosquitto.org/download/>.
2. Eclipse Mosquitto, *mosquitto.conf man page*: <https://mosquitto.org/man/mosquitto-conf-5.html>.
3. Eclipse Mosquitto, *Password file Plugin*: <https://mosquitto.org/documentation/plugins/password-file/>.
4. Eclipse Mosquitto, *ACL file Plugin*: <https://mosquitto.org/documentation/plugins/acl-file/>.
5. Eclipse Mosquitto, *mosquitto_passwd man page*: <https://mosquitto.org/man/mosquitto_passwd-1.html>.
6. Eclipse Mosquitto, *mosquitto_pub* và *mosquitto_sub man pages*: <https://mosquitto.org/man/>.
