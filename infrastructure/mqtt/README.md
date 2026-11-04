# Bộ môi giới MQTT cho phòng thông minh

Thư mục này hiện thực Giai đoạn 13 bằng **Eclipse Mosquitto 2.1.x**, MQTT 3.1.1, một listener TCP 1883 trong mạng LAN, xác thực bắt buộc và ACL theo thiết bị. Phiên bản đã dùng để kiểm tra phải được ghi trong `docs/15-xay-dung-mqtt-v1.0.md`.

## 1. Ranh giới triển khai

- Cổng 1883 chỉ dùng trong mạng LAN cô lập; **không chuyển tiếp cổng ra Internet**.
- Không cho phép kết nối ẩn danh.
- Không lưu mật khẩu rõ trong repository. `mosquitto_passwd` tạo tệp băm SHA-512 PBKDF2 ở `runtime/passwords`.
- Payload MQTT tối đa 2.048 byte; toàn gói MQTT tối đa 4.096 byte; QoS tối đa là 1.
- Retain, QoS theo topic, TTL lệnh và lược đồ JSON vẫn do firmware/máy chủ tuân thủ theo Thiết kế MQTT 1.0; ACL broker chỉ kiểm soát hướng đọc/ghi.
- Cơ sở dữ liệu máy chủ vẫn là nguồn chính thức của cấu hình. Broker chỉ vận chuyển và giữ retained snapshot.

## 2. Thành phần

| File | Vai trò |
|---|---|
| `mosquitto.conf.template` | Mẫu cấu hình không chứa đường dẫn máy hoặc bí mật |
| `acl` | Quyền tối thiểu cho thiết bị `room-01` và máy chủ |
| `client.example.conf` | Mẫu hồ sơ client; bản có mật khẩu chỉ đặt trong `runtime/` |
| `scripts/Initialize-Mqtt.ps1` | Tạo hai tài khoản, sinh cấu hình tuyệt đối và kiểm tra cú pháp |
| `scripts/Start-Mqtt.ps1` | Kiểm tra lại cấu hình rồi chạy broker ở tiền cảnh |
| `scripts/Test-Mqtt.ps1` | Thử ẩn danh/mật khẩu sai, ACL hai chiều, cách ly đọc/ghi giữa phòng và retained message |
| `runtime/` | Mật khẩu băm, cấu hình sinh, dữ liệu và log cục bộ; không commit |

## 3. Tài khoản và quyền

| Tài khoản | Quyền |
|---|---|
| `room-01-device` | Đọc `config/desired`, `commands/request`, `sync/request`; chỉ ghi các topic báo cáo của `room-01` |
| `smartroom-backend` | Đọc/ghi `smartroom/v1/devices/#`; ứng dụng web không dùng trực tiếp tài khoản này |

Mật khẩu hai tài khoản phải khác nhau. Client ID của ESP32 vẫn là `smartroom-room-01-device`; tên tài khoản không được dùng thay cho `device_id`.

## 4. Chuẩn bị trên Windows

1. Cài bản x64 chính thức của Mosquitto 2.1.x từ <https://mosquitto.org/download/>. Các script cũng nhận `-MosquittoHome` nếu cài vào vị trí riêng.
2. Mở PowerShell tại thư mục dự án.
3. Khởi tạo một lần; lệnh sẽ hỏi hai mật khẩu mà không hiển thị ký tự:

```powershell
.\infrastructure\mqtt\scripts\Initialize-Mqtt.ps1
```

Mặc định listener bind `0.0.0.0:1883` để ESP32 trong cùng LAN truy cập được. Có thể giới hạn theo IP LAN cụ thể:

```powershell
.\infrastructure\mqtt\scripts\Initialize-Mqtt.ps1 -BindAddress 192.168.1.10 -Force
```

`-Force` xóa và tạo lại file mật khẩu; chỉ dùng khi chủ động đổi toàn bộ credential.

## 5. Chạy và kiểm tra

Terminal 1:

```powershell
.\infrastructure\mqtt\scripts\Start-Mqtt.ps1
```

Terminal 2:

```powershell
.\infrastructure\mqtt\scripts\Test-Mqtt.ps1
```

Bộ thử yêu cầu nhập lại hai mật khẩu, tạo hồ sơ client tạm trong `runtime/` bị bỏ qua và tự xóa sau khi chạy. Bộ thử không nạp firmware và không được coi là kết quả phần cứng.

Kiểm tra tĩnh độc lập broker:

```powershell
npm run check:stage13
```

## 6. Thử gửi/nhận thủ công

Sao chép `client.example.conf` thành `runtime/backend-client.conf`, thay tài khoản/mật khẩu máy chủ rồi chạy từ thư mục cài Mosquitto. Không truyền mật khẩu bằng tham số dòng lệnh.

Nhận trạng thái báo cáo:

```powershell
mosquitto_sub -o .\infrastructure\mqtt\runtime\backend-client.conf -h 127.0.0.1 -p 1883 -t "smartroom/v1/devices/room-01/state/reported" -q 1 -v
```

Gửi yêu cầu đồng bộ không retain:

```powershell
mosquitto_pub -o .\infrastructure\mqtt\runtime\backend-client.conf -h 127.0.0.1 -p 1883 -t "smartroom/v1/devices/room-01/sync/request" -q 1 -m '{"schema":"smartroom.mqtt","schema_version":1,"message_id":"sync-manual-01","device_id":"room-01","sent_at":null,"time_quality":"unsynced","data":{"sync_id":"sync-manual-01"}}'
```

## 7. Kết nối firmware và máy chủ

- `firmware/esp32/include/secrets.hpp`: đặt IP LAN của máy chạy broker, cổng 1883, tài khoản `room-01-device` và mật khẩu tương ứng.
- Biến môi trường máy chủ: `MQTT_URL=mqtt://<ip-lan>:1883`, `MQTT_USERNAME=smartroom-backend`, `MQTT_PASSWORD=<mật-khẩu>`.
- Chỉ mở luật tường lửa TCP 1883 cho mạng **Private/LAN** khi ESP32 cần kết nối. Không mở cho mạng Public.
- Nếu triển khai ngoài LAN, phải thiết kế listener TLS 8883 và quản lý chứng thư; cấu hình hiện tại không được dùng qua Internet.

## 8. Khắc phục nhanh

| Hiện tượng | Kiểm tra |
|---|---|
| Script không tìm thấy Mosquitto | Truyền `-MosquittoHome 'C:\Program Files\Mosquitto'` |
| `Not authorized` | Đúng tài khoản, đúng topic/hướng và đúng mật khẩu |
| ESP32 không kết nối được nhưng localhost được | IP broker, mạng Private, tường lửa và hai thiết bị cùng LAN |
| Broker từ chối cấu hình | Chạy lại `Initialize-Mqtt.ps1`; yêu cầu Mosquitto 2.1.x có hai plugin file |
| Không thấy bản tin lệnh cũ | Đúng thiết kế: `commands/request` và `sync/request` không retain |
