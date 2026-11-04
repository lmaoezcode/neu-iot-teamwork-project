# AGENT.md — Tổng quan dự án Hệ thống Phòng thông minh IoT

> Tài liệu này dành cho người (và AI agent) mới vào dự án: dự án làm gì, kiến trúc ra sao, từng thư mục/file có chức năng gì, cách chạy và những quy tắc cần giữ.
> Nguồn: README.md, `docs/` (đặc tả, kiến trúc, MQTT, phần cứng) và mã nguồn `server/`, `web/`, `firmware/`, `tools/`, `tests/`, `infrastructure/`.
> Trạng thái ghi theo README tại thời điểm đọc: **Giai đoạn 17 — Tích hợp** (G1–G16 đã khóa).

---

## 1. Dự án làm gì

Bài tập lớn: **Thiết kế hệ thống giám sát, điều khiển và tự động hóa phòng thông minh dựa trên mạng kết nối vạn vật (IoT)** cho **một phòng** (`device_id` mặc định `room-01`), một chủ phòng.

Hệ thống gồm 4 lớp, nối từ cảm biến tới trình duyệt:

```
Cảm biến/LED ──► Arduino UNO ──UART──► ESP32 ──Wi-Fi/MQTT──► Mosquitto ──► Máy chủ Node ──HTTP/SSE──► Web
 (phần cứng)     (logic cục bộ)       (cầu nối)               (broker)     (Fastify+SQLite)          (Vite/TS)
```

Chức năng chính (phạm vi đã duyệt: **16 chức năng nhóm A, 1 nhóm B, 1 nhóm C**):

| Mã | Chức năng |
|---|---|
| MT-03, MT-02 | Giám sát mức sáng (LDR) và chất lượng/lỗi dữ liệu ánh sáng |
| DK-02 | Điều khiển đèn **thật**, quạt **mô phỏng** |
| TD-02 | Tự động bật/tắt đèn theo ánh sáng (hai ngưỡng + trễ) |
| CD-01, CD-02 | Chế độ Tự động/Thủ công; ba hồ sơ phòng: Ở nhà / Ra ngoài / Ban đêm |
| CH-01 | Cấu hình ngưỡng/hiệu chuẩn có phiên bản (desired ↔ reported) |
| AN-05 | Phát hiện đối tượng vùng cửa bằng siêu âm SRF04 |
| AN-06 | **Mô phỏng** khóa/mở cửa (không servo, không xác minh cơ khí) |
| AT-01, AT-02 | An toàn: khí MQ-2 và cảm biến lửa (độc lập nhau) |
| CB-01 | Vòng đời cảnh báo: sounding → muted → awaiting_ack → normal |
| MN-01 | Mạng, đồng bộ, hoạt động ngoại tuyến, phục hồi kết nối |
| UD-01 | Ứng dụng web + xác thực chủ phòng |
| DL-01 | Lưu trữ + nhật ký |
| BC-01 | Biểu đồ lịch sử |
| TB-01 (B) | Thông báo trình duyệt |
| MR-01 (C) | Cảm biến âm thanh / tải phụ (dự phòng) |

`DK-01` (tải thật cho đèn/quạt) và `AN-02` (khóa servo) đã **ngừng** theo CR-02, thay bằng DK-02 và AN-06. DHT22, MC-38, SW-420, bàn phím 4×4, RTC ghi `KHÔNG_DÙNG`.

---

## 2. Kiến trúc

### 2.1. Các thành phần và trách nhiệm

| Thành phần | Công nghệ | Trách nhiệm |
|---|---|---|
| **Arduino UNO** (`firmware/uno`) | C++ / PlatformIO (AVR) | Đọc cảm biến, chạy logic phòng **cục bộ** (tự động đèn, hồ sơ, an toàn, cảnh báo, còi, khóa/quạt mô phỏng), vẫn chạy khi mất mạng. Tự bảo vệ: khởi động lại thì mọi đầu ra tiện nghi về TẮT. |
| **ESP32** (`firmware/esp32`) | C++ / PlatformIO (Arduino-ESP32) | **Chủ** của liên kết UART với UNO; cầu nối UART ↔ MQTT; Wi-Fi/MQTT, NTP, lưu cấu hình ở NVS, hàng đợi ngoại tuyến trên LittleFS, đồng bộ lại sau mất kết nối, chống lặp lệnh. |
| **Mosquitto** (`infrastructure/mqtt`) | MQTT 3.1.1 | Vận chuyển bản tin; giữ retained (state, config desired/reported, availability); LWT; ACL tối thiểu. Không phải nguồn dữ liệu chính thức. |
| **Máy chủ** (`server`) | Node ≥ 22, Fastify, TypeScript, MQTT.js, SQLite | **Nguồn chính thức** của cấu hình mong muốn; API REST + SSE; xác thực phiên + CSRF; vòng đời lệnh có ACK; ghi DB; chống trùng bản tin. |
| **CSDL** | SQLite (WAL, bảng `STRICT`) | Lưu snapshot, mẫu cảm biến theo phút, state, cấu hình, lệnh, cảnh báo, người dùng, phiên, audit, inbox/outbox MQTT. |
| **Web** (`web`) | TypeScript + Vite (SPA thuần, không framework) | Giao diện tiếng Việt, 8 tuyến, SSE + polling dự phòng, lệnh có ACK. |

### 2.2. Nguyên tắc kiến trúc quan trọng

1. **Máy chủ + DB là nguồn chính thức của cấu hình.** Broker chỉ vận chuyển; retain không phải lịch sử. Sau reconnect, server so `desired` trong DB với `reported` từ thiết bị.
2. **Hai trạng thái cấu hình**: `desired` (server ghi, version tăng) và `reported` (thiết bị báo lại sau khi áp dụng). Web hiển thị "đang chờ" tới khi `reported` khớp.
3. **Lệnh có ACK, không báo thành công giả**: API trả `202 {accepted:true, applied:false}`; trạng thái chuyển `pending → applied/rejected/duplicate_ok/expired/unknown` chỉ khi thiết bị phản hồi. Hết hạn → `unknown`, không tự sửa trạng thái thiết bị, vẫn hòa giải được kết quả đến muộn.
4. **Chống lặp bằng ID**: MQTT QoS 1 có thể giao lặp → `message_id` (server dùng inbox), `command_id` (ESP32 có cache 8 lệnh).
5. **UNO tự trị**: mất ESP32/Internet vẫn chạy logic cục bộ; ESP32 khởi động lại thì nạp NVS → đồng bộ UNO → rồi mới hòa giải với server.
6. **`online` chỉ phát sau khi hòa giải UNO**: trạng thái `syncing → online/degraded`; LWT `offline` retained.
7. **Mô phỏng phải có nhãn**: quạt/khóa là LED + trạng thái phần mềm, luôn mang `actuator_mode = simulated`, `mechanical_verified = false`.
8. **An toàn không thể vô hiệu hóa**: chỉ cho **tắt tiếng** còi; nguyên nhân cảnh báo vẫn tồn tại. Cảm biến lỗi → cảnh báo hệ thống riêng, không ghi "phát hiện khí/lửa".

### 2.3. Phần cứng (theo `docs/07-thiet-ke-phan-cung-v1.0.md` và code)

Không mua thêm linh kiện; dùng kit **BLK UNO R3 + 55 mạch cơ bản** và **ESP32 DevKit V1**. Hai board cấp nguồn USB riêng, **không nối chung rail 5 V**.

| Chân UNO | Chức năng |
|---|---|
| A0 | LDR (ánh sáng) |
| A1 | MQ-2 (khí; khởi động nóng 60 s) |
| D2 / D7 | SRF04 ECHO / TRIG |
| D3 | Còi (qua C1815; chỉ dùng khi dòng đo ≤ 50 mA) |
| D4 | Cảm biến lửa (DO) |
| D5 | LED khóa mô phỏng |
| D6 | LED đèn phòng (thật) |
| D8 | Nút tắt tiếng cục bộ (INPUT_PULLUP) |
| D9 | LED quạt mô phỏng |
| D10 / D11 | LINK RX / TX tới ESP32 (SoftwareSerial) |
| D12 | LED cảnh báo |
| D13 | LED trạng thái cục bộ |

ESP32: UART2 — GPIO16 (RX, qua chia áp 2k/3k), GPIO17 (TX, qua 2 tầng C1815 nâng mức). Tránh GPIO0/2/12/15 (strap).

### 2.4. Giao thức UNO ↔ ESP32 (`docs/08-…`)

- UART **19200 8N1**, khung **COBS + CRC-16**, ESP32 là chủ (poll); có ACK/NACK, `session_id`, `sequence`, `correlation_id`.
- Loại bản tin (`firmware/uno/include/domain.hpp`): HELLO/SESSION (bắt tay), POLL/IDLE, SNAPSHOT_*, SYNC_COMPLETE, ACK/NACK, `CONFIG_SET/REPORT`, `CONTROL_SET`, `SENSOR/STATE/EVENT/ALERT/HEALTH_REPORT`.
- Opcode điều khiển: `set_device`, `set_control_mode`, `set_room_profile`, `set_lock`, `alert_action`.
- Mã lý do (`ReasonCode`) chia nhóm: 0x01xx khung/giao thức, 0x02xx phiên, 0x03xx giá trị/phiên bản, 0x04xx quy tắc nghiệp vụ (Ra ngoài chặn, cần xác nhận, chặn an ninh…), 0x05xx áp dụng thất bại.
- Payload tối đa 42 byte; báo cáo 24 byte.

### 2.5. MQTT (`docs/09-…`, `infrastructure/mqtt/acl`)

Cây chủ đề: `smartroom/v1/devices/<device_id>/…`

| Topic | Hướng | QoS | Retain |
|---|---|---|---|
| `availability` (online/syncing/degraded/offline) | thiết bị → server | 1 | có (+LWT) |
| `telemetry/sensors` | thiết bị → server | 0 | không |
| `state/reported` | thiết bị → server | 1 | có |
| `config/desired` | server → thiết bị | 1 | có |
| `config/reported` | thiết bị → server | 1 | có |
| `commands/request` | server → thiết bị | 1 | không |
| `commands/result` | thiết bị → server | 1 | không |
| `events`, `alerts/events` | thiết bị → server | 1 | không |
| `alerts/reported` | thiết bị → server | 1 | có |
| `sync/request`, `sync/status` | hai chiều | 1 | không |
| `diagnostics` | thiết bị → server | 0 | không |

Tải tin là JSON bọc **envelope** `{schema:"smartroom.mqtt", schema_version:1, message_id, device_id, sent_at, time_quality, esp_boot_id, uno_boot_id, link_session_id, data}`.
ACL: `room-01-device` chỉ đọc `config/desired`, `commands/request`, `sync/request` và chỉ ghi các topic báo cáo; `smartroom-backend` đọc/ghi `smartroom/v1/devices/#`.

---

## 3. Chức năng từng thư mục / file

### 3.1. `server/` — máy chủ Fastify

| File | Chức năng |
|---|---|
| `src/index.ts` | Điểm vào: nạp `config/server.local.env` (hoặc `SERVER_ENV_FILE`), tạo app, lắng nghe, tắt êm khi SIGINT/SIGTERM. |
| `src/app.ts` | `createApp()`: dựng Fastify (cookie, CORS, giới hạn body 16 KB), khởi tạo repository (SQLite), MQTT client, `EventHub`, `SessionStore`, `SmartRoomService`; error handler thống nhất `{error_code,message,request_id,details}`; `GET /health`. Có `AppOverrides` để test thay repository/MQTT/đồng hồ. |
| `src/config/env.ts` | Đọc & kiểm tra biến môi trường (cổng, DB, MQTT, mật khẩu chủ phòng, secret phiên, retention…). Từ chối giá trị mẫu `THAY_BANG_…`, secret ngắn. |
| `src/api/routes.ts` | Toàn bộ REST + SSE (xem 3.1.1). Kiểm tra Origin, session cookie, CSRF cho mọi thao tác ghi, giới hạn đăng nhập. |
| `src/services/smart-room-service.ts` | **Lõi nghiệp vụ**: subscribe MQTT, parse/validate bản tin, chống trùng, cập nhật overview/state/alert, gửi lệnh và cấu hình desired, quản lý vòng đời lệnh (timeout → `unknown`), outbox publish, nhật ký, lịch sử. |
| `src/services/errors.ts` | `ServiceError(status, code, message, details)`. |
| `src/types/domain.ts` | Kiểu miền: envelope MQTT, telemetry, reported state, config, command, alert, overview, log, history; `initialConfigSettings`. |
| `src/validation/schemas.ts` | Schema (zod) cho request API và payload MQTT (chặt, loại payload sai). |
| `src/mqtt/client.ts`, `mqttjs-client.ts` | Cổng `MqttPort` + hiện thực MQTT.js 3.1.1; `DisabledMqttClient` khi `MQTT_ENABLED=false`. |
| `src/realtime/event-stream.ts` | `EventHub`: bộ đệm replay SSE (`Last-Event-ID`), subscribe/publish. |
| `src/security/` | `password.ts` (băm/kiểm mật khẩu), `session-store.ts` (phiên + CSRF, lưu DB), `login-limiter.ts` (chống dò mật khẩu theo IP). |
| `src/data/repository.ts` | Giao diện `DataRepository`. |
| `src/data/sqlite-repository.ts`, `sqlite-database.ts` | Hiện thực SQLite bền vững: migration/checksum, inbox/outbox, retention, backup. |
| `src/data/memory-repository.ts` | Repository bộ nhớ tạm (G14) — dùng cho test. |
| `migrations/001_initial.sql` | Lược đồ: `devices, device_snapshots, sensor_minute_samples, state_reports, availability_events, configuration_revisions, commands, system_events, alert_causes, alert_transitions, users, web_sessions, audit_log, mqtt_inbox, mqtt_outbox, sync_runs`. Migration đã áp dụng **bất biến**. |
| `scripts/` | `migrate-database.ts`, `run-retention.ts`, `backup-database.ts`, `hash-password.ts`. |
| `test/` | 28 test: API, lệnh timeout, cảnh báo CR-04, SSE, MQTT fuzz (1.000 payload), schema, mật khẩu, reconnect-soak 25 chu kỳ, service, SQLite. `helpers/` có fake MQTT + fixture. |

#### 3.1.1. API (`routeCatalog`)

| Endpoint | Ghi chú |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/session` | Cookie `smartroom_session` (HttpOnly, SameSite=Strict); login trả `csrf_token`. |
| `GET /api/overview` | Tổng quan thiết bị (availability, telemetry, state, diagnostics, config, alert). `stale_after_seconds: 15`. |
| `GET /api/config`, `PUT /api/config/desired` | Ghi cấu hình cần `base_config_version`; trả 202. |
| `POST /api/commands`, `GET /api/commands/{id}` | Gửi lệnh / tra trạng thái ACK. |
| `POST /api/alerts/{id}/mute`, `…/ack` | Tắt tiếng / xác nhận cảnh báo (cũng đi qua lệnh có ACK). |
| `GET /api/history`, `GET /api/logs` | Biểu đồ ánh sáng có khoảng trống (`missing_buckets_omitted`); nhật ký phân trang. |
| `GET /api/events/stream` | SSE: replay theo `Last-Event-ID`, heartbeat 15 s, snapshot khi lệch cửa sổ replay. |
| `GET /health` | Sức khỏe + chế độ lưu trữ. |

Mọi thao tác ghi: kiểm tra `Origin` = `WEB_ORIGIN`, session hợp lệ, header `x-csrf-token`.

### 3.2. `web/` — ứng dụng Vite/TypeScript

| File | Chức năng |
|---|---|
| `src/main.ts`, `app.ts` | Khởi động SPA; `app.ts` (~28 KB) điều phối trang, đăng nhập, gọi API, hiển thị cảnh báo/lệnh. |
| `src/router.ts` | 8 tuyến: `/dang-nhap`, `/tong-quan`, `/dieu-khien`, `/trang-thai-phong`, `/cai-dat-tu-dong`, `/an-ninh-an-toan`, `/lich-su`, `/nhat-ky`; route guard theo đăng nhập. |
| `src/api/client.ts` | Client HTTP có CSRF, xử lý lỗi/timeout. |
| `src/realtime/sse-client.ts`, `state/realtime.ts` | SSE + polling dự phòng; `state/store.ts` store trạng thái. |
| `src/domain/` | `config-validation.ts` (kiểm tra cấu hình phía client), `history.ts`, `format.ts`. |
| `src/ui/render.ts` | Dựng giao diện (~45 KB), nhãn `MÔ PHỎNG`, trạng thái chờ/lỗi/ngoại tuyến/`unknown`, a11y. |
| `src/notifications.ts` | Thông báo trình duyệt (TB-01). |
| `src/styles.css`, `types.ts` | CSS responsive; kiểu dữ liệu API. |
| `vite.config.ts` | Dev server cổng 5173, proxy tới server. |
| `test-resilience/` | Kiểm tra UI không báo thành công giả khi lệnh timeout. |

### 3.3. `firmware/uno/` — Arduino UNO

| File | Chức năng |
|---|---|
| `src/main.cpp` → `app.cpp` (~50 KB) | Vòng lặp chính: khai báo chân, đọc cảm biến mỗi 2 s, báo cáo sức khỏe mỗi 5 s, logic tự động đèn (hai ngưỡng, giữ ≥ 10 s, dữ liệu cũ > 30 s thì dừng), hồ sơ phòng, vùng cửa, vòng đời cảnh báo, còi/LED, nút tắt tiếng, giao dịch cache chống lặp, xử lý khung UART. |
| `src/sensors.cpp`, `include/sensors.hpp` | Đọc LDR, MQ-2 (warm-up 60 s), cảm biến lửa, SRF04; chuẩn hóa %, chất lượng dữ liệu. |
| `src/protocol.cpp`, `include/protocol.hpp` | COBS + CRC-16, mã hóa/giải mã khung. |
| `include/domain.hpp` | Enum/struct dùng chung: `MessageType`, `ReasonCode`, `Config`, `SensorSnapshot`, `RuntimeState`, `AlertCause`, `Frame`… |
| `platformio.ini` | Build AVR (flash ~51,9%, RAM tĩnh ~53,1%). |

### 3.4. `firmware/esp32/` — ESP32

| File | Chức năng |
|---|---|
| `src/main.cpp`, `app.cpp` | `begin()`: Serial, NVS, hàng đợi ngoại tuyến, boot ID ngẫu nhiên; `tick()`: chạy `UnoLink` rồi `MqttGateway`. |
| `src/uno_link.cpp` | Máy trạng thái UART phía chủ: HELLO → SESSION → ReconcileConfig → Snapshot → Sync → Operational; retry, timeout, giải mã các báo cáo, kiểm tra sequence/trùng. |
| `src/mqtt_gateway.cpp` (~60 KB) | Wi-Fi/MQTT (backoff), NTP, LWT, xuất bản telemetry/state/config/alert/health/availability; nhận desired config, lệnh, sync; hàng đợi vào 4 bản tin; cache kết quả lệnh; replay hàng đợi ngoại tuyến. |
| `src/offline_queue.cpp` | Hàng đợi bền trên LittleFS, đánh dấu tràn. |
| `src/config_store.cpp` | Lưu/nạp cấu hình ở NVS. |
| `include/secrets.example.hpp` | Mẫu Wi-Fi/MQTT — **không** commit bản thật. |

### 3.5. `infrastructure/`

| Thư mục | Nội dung |
|---|---|
| `mqtt/` | `mosquitto.conf.template`, `acl`, `client.example.conf`, script PowerShell `Initialize-Mqtt / Start-Mqtt / Test-Mqtt` (8 smoke test broker). |
| `server/` | `Initialize-Server.ps1` (hỏi kín mật khẩu, tạo `config/server.local.env`), `Start-Server.ps1`. |
| `database/` | README vận hành SQLite (migrate, retention, backup, phục hồi). |
| `firmware/` | Script PowerShell G17: `Get-BoardPorts` (nhận diện COM), `Upload-Firmware`, `Capture-SerialLog`, `Redact-IntegrationLog`, `Record-HardwareCheckpoint1`, `Test-HardwarePreparation`. |

### 3.6. `tools/`, `tests/`, `config/`, `data/`, `docs/`

- `tools/check-stage10…18-readiness.mjs`: kiểm tra tự động theo từng giai đoạn (cấu trúc, truy vết, ranh giới, cờ an toàn). `uno_*_host_test.cpp`, `esp32_protocol_host_test.cpp` + `host-stubs/`: test giao thức/ứng dụng firmware chạy trên máy host (loại khung bị cắt / hỏng 1 bit). `.pio-venv`, `.pio-core`, `.mosquitto`, `.downloads` là môi trường cục bộ, **bị loại khỏi Git**.
- `tests/integration/`: `simulated-device.mjs` (thiết bị **MÔ PHỎNG**), `stage17-software-chain.mjs` (Mosquitto thật + server + SQLite + Vite proxy + SSE + ACK + 3 chu kỳ broker mất/có, **15/15**), fixture, `hardware-evidence-tooling.ps1` (14/14). `tests/acceptance/stage18-software-preflight.mjs`: tiền kiểm KT19–KT21.
- `config/`: `env.example`, `integration-compatibility.json` (ma trận phiên bản), `stage18-test-readiness.json` (ánh xạ 32 ca kiểm thử).
- `data/`: DB SQLite, log, backup (bị loại khỏi Git).
- `docs/`: 00 quy trình 29 giai đoạn · 01 đặc tả (v1.2 hiện hành) · 02 ma trận kiểm thử (32 ca) · 03 danh mục phần cứng · 04 CR-01…04 · 05 kiến trúc · 06 UML · 07 phần cứng · 08 giao thức UART · 09 MQTT · 10 dữ liệu · 11 giao diện · 12 cấu trúc dự án · 13–14 firmware · 15 MQTT build · 16 server · 17 DB · 18 web · 19/19a tích hợp + phiếu bằng chứng · 20 chuẩn bị kiểm thử. Bản v1.0/v1.1 là lịch sử, **không dùng** ánh xạ servo/motor cũ.

---

## 4. Luồng dữ liệu chính

**Cảm biến → web.** UNO đọc cảm biến → `SENSOR_REPORT` (UART) → ESP32 `onSensorReport` → publish `telemetry/sensors` (QoS 0) → server `handleMqttMessage` (parse, kiểm `device_id`, chống trùng) → ghi DB (mẫu theo phút) → `EventHub` → SSE `state.updated` → web cập nhật. Mất kết nối: web giữ giá trị cuối kèm nhãn "Dữ liệu cũ/Ngoại tuyến".

**Lệnh điều khiển.** Web `POST /api/commands` (CSRF) → `submitCommand` kiểm tra điều kiện, ghi `commands` (`pending`), publish `commands/request` → ESP32 `processCommand` → `CONTROL_SET` xuống UNO → UNO áp dụng/từ chối (`ACK/NACK` + reason code) → ESP32 publish `commands/result` → server cập nhật trạng thái → SSE → web. Quá hạn ⇒ `unknown`.

**Cấu hình.** Web `PUT /api/config/desired` → server ghi revision mới, tăng `config_version`, publish `config/desired` (retained) → ESP32 gửi `CONFIG_SET` cho UNO → UNO áp dụng nguyên tử → `config/reported`. Server là nguồn chính thức; reconnect thì so version.

**Cảnh báo.** UNO phát `ALERT_REPORT` (add/clear/retrigger/snapshot) → MQTT `alerts/events` + `alerts/reported` → server giữ nhiều nguyên nhân cùng lúc; web cho tắt tiếng/xác nhận; tắt tiếng **không** xóa nguyên nhân; nguyên nhân mới bật lại còi.

---

## 5. Cách chạy

Yêu cầu: Node ≥ 22, pnpm 11, PowerShell (Windows), PlatformIO (có sẵn trong `tools/.pio-venv`), Mosquitto portable (`tools/.mosquitto`).

```powershell
pnpm install
# Broker + tài khoản: theo infrastructure/mqtt/README.md
infrastructure\server\Initialize-Server.ps1     # tạo config/server.local.env (mật khẩu hỏi kín)
infrastructure\server\Start-Server.ps1          # hoặc: pnpm server:dev   (http://127.0.0.1:3000)
pnpm web:dev                                    # http://localhost:5173

pnpm db:migrate | db:retention | db:backup      # vận hành SQLite
pnpm server:hash-password                       # tạo mã băm mật khẩu chủ phòng
```

Kiểm thử:

```powershell
pnpm typecheck && pnpm build && pnpm test       # server 28 + web 31
pnpm test:resilience                            # nhóm chịu lỗi 6/6
pnpm integration:stage17                        # chuỗi tích hợp loopback 15/15 (cần Mosquitto portable)
pnpm preflight:stage18                          # tiền kiểm KT19–KT21
pnpm check:stage10 … check:stage18-readiness    # kiểm tra theo giai đoạn
pnpm test:hardware-tooling                      # công cụ board bằng fixture/-WhatIf
```

---

## 6. Quy tắc cho người/agent làm việc trong repo

1. **Không bịa số liệu/kết quả.** Chỉ đánh `ĐẠT` khi có kết quả thật và minh chứng. Kết quả phần mềm/mô phỏng gắn nhãn `MÔ PHỎNG`, không dùng làm bằng chứng phần cứng. 32 ca trong Ma trận 1.2 hiện đều `CHƯA THỰC HIỆN`.
2. **Không commit bí mật**: `config/server.local.env`, `secrets.hpp`, file DB/WAL/SHM, backup, Wi-Fi/MQTT thật. Log phải qua `Redact-IntegrationLog.ps1`.
3. **Không sửa migration đã áp dụng**; thay đổi lược đồ = migration mới tăng phiên bản.
4. **Không tái sử dụng mã** chức năng (`XX-nn`), mã kiểm thử (`KTnn`), `Gx-*` cho ý nghĩa khác. Đổi phạm vi phải qua Change Request (`docs/04-…`) và đúng quy trình 29 giai đoạn.
5. **Không nối servo/motor/relay** trong bản 1.2; quạt/khóa luôn là mô phỏng. MQ-2, cảm biến lửa, còi mặc định vô hiệu hóa cho tới khi qua cổng đo.
6. **Không nối chung hai rail 5 V** của UNO và ESP32; mọi tín hiệu UART qua chuyển mức.
7. **Không thêm chức năng tắt phân hệ an toàn**; chỉ tắt tiếng.
8. Thay đổi giao thức dây/MQTT/schema phải cập nhật đồng bộ: firmware (UNO + ESP32), `server/src/validation/schemas.ts`, `server/src/types/domain.ts`, `web/src/types.ts`, `config/integration-compatibility.json`, ACL và `docs/`, rồi chạy lại `check:stageNN` tương ứng.

### 6.1. Quy tắc viết hướng dẫn kiểu Lego

Áp dụng cho mọi hướng dẫn lắp mạch, đo, nạp firmware hoặc thao tác vật lý dành cho người mới (ví dụ `docs/22-…`). Mục tiêu: người chưa từng học điện tử làm theo từng bước vẫn ra đúng kết quả, như xem tờ hướng dẫn lắp Lego.

1. **Mở đầu bằng "túi linh kiện"**: bảng liệt kê đúng linh kiện, giá trị và số lượng cần cho phần đó (ví dụ "Điện trở 330 Ω × 4"), kèm dụng cụ. Thiếu thứ gì thì dừng, không thay thế tùy ý.
2. **Một bước = một hành động**: mỗi bước chỉ làm một việc nhỏ, đánh số liên tục, câu lệnh ngắn bắt đầu bằng động từ ("Cắm…", "Nối…", "Chụp…"). Không gộp nhiều việc trong một bước.
3. **Chỉ rõ vị trí chính xác**: ghi tên chân/lỗ cụ thể ("chân dài của LED vào lỗ J10; điện trở 330 Ω từ J11 sang D6"). Không dùng "nối vào chỗ thích hợp".
4. **Mỗi bước có hình**: gắn một mã hình `HINH-…` (xem `docs/21-…`). Chưa có ảnh thật thì dùng placeholder cùng mã. Hình giữ chỗ không phải bằng chứng.
5. **Mỗi bước có "Kiểm tra"**: một câu nói rõ kết quả đúng trông như thế nào ("LED chưa sáng; hai chân LED không chạm nhau"). Nếu sai thì quay lại bước nào.
6. **Đặt mốc dừng an toàn**: đánh dấu rõ chỗ "RÚT USB / chưa cấp nguồn", "DỪNG nếu số đo ngoài dải [x–y]". Không cho cấp nguồn, nối GPIO đích hoặc nạp firmware trước khi qua cổng đo tương ứng; thứ tự theo `docs/07` mục 17.
7. **Chia theo cụm lắp (module)**: mỗi cụm (LED, nút, LDR, SRF04…) là một chương nhỏ, lắp và kiểm xong mới sang cụm kế. Có tiêu đề, thời gian dự kiến và việc cần có từ cụm trước.
8. **Không giả định kiến thức**: giải thích ngắn thuật ngữ ở lần đầu (anode/cathode, GND, ADC). Ghi giá trị thật, ví dụ vạch màu điện trở, không chỉ viết "điện trở nhỏ".
9. **Chỉ dùng giá trị và chân đã khóa trong tài liệu thiết kế**: tham chiếu `docs/07`, `docs/08`, `docs/09`; không tự thêm linh kiện (ví dụ điện trở kéo xuống không có trong thiết kế). Nếu hướng dẫn khác tài liệu thiết kế, tài liệu thiết kế thắng; báo chỗ khác và hỏi người dùng.
10. **Cuối hướng dẫn có "Việc cần gửi lại"**: danh sách ảnh theo mã, số đo thật, lỗi gặp. Không tự ghi `ĐẠT`; chỉ ghi giá trị thật vào `docs/19a`.
11. **Chỉ dẫn là MÔ PHỎNG hay THẬT phải ghi rõ**: ảnh/kết quả từ demo hoặc thiết bị giả luôn gắn nhãn mô phỏng, không phải bằng chứng phần cứng.

---

## 7. Trạng thái hiện tại (theo README)

- Đã xong và khóa: G1–G16 (đặc tả, kiến trúc, phần cứng, giao thức, MQTT, dữ liệu, giao diện, firmware, broker, server, SQLite, web). CR-01…CR-04 đã duyệt.
- **G17 — Tích hợp đang mở**: phần mềm đạt (server 28/28, web 31/31, resilience 6/6, loopback 15/15, tool board 14/14, hai firmware build thành công). **Chưa** nạp board, đo nguồn/mức logic UART, thử Wi-Fi từ ESP32 và mạch thật.
- G18 (kiểm thử): mới có tiền kiểm `PREFLIGHT_PASS`; chưa mở.
