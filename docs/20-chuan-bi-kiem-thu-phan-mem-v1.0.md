# CHUẨN BỊ KIỂM THỬ PHẦN MỀM 1.0

## 1. Trạng thái và ranh giới

| Thuộc tính | Giá trị |
|---|---|
| Trạng thái | **CHUẨN BỊ SỚM — G17 CHƯA ĐÓNG** |
| Giai đoạn hiện hành | Giai đoạn 17 — Tích hợp |
| Giai đoạn đích | Giai đoạn 18 — Kiểm thử phần mềm |
| Điều kiện mở chính thức | G17 có đủ bằng chứng board, nguồn, UART, Wi-Fi/MQTT và đầu-cuối vật lý rồi được người dùng duyệt |
| Nguồn chuẩn | Ma trận kiểm thử 1.2 và `config/stage18-test-readiness.json` |

Tài liệu này chỉ sắp xếp việc có thể chuẩn bị trước. Nó **không mở G18**, không cập nhật kết quả chấp nhận và không thay bằng chứng phần cứng. Toàn bộ **32 ca** đang áp dụng tiếp tục là `CHƯA THỰC HIỆN`.

## 2. Mục tiêu chuẩn bị

- Tận dụng bộ hồi quy hiện tại gồm 28 kiểm thử server, 31 kiểm thử web, host test firmware và runner G17 15/15. Các mốc đã khóa của G15/G16 vẫn lần lượt là 22 và 30 kiểm thử; số mới chỉ phản ánh phần hardening bổ sung sau đó.
- Chỉ rõ phần nào có thể tái tạo tự động, phần nào mới là mô phỏng và phần nào bắt buộc thao tác thật.
- Ngăn việc dùng kết quả cấp mô-đun hoặc loopback để tự ghi `ĐẠT` cho ca chấp nhận.
- Cho phép bắt đầu G18 nhanh và có thứ tự ngay sau khi G17 được đóng đúng quy trình.

## 3. Phân nhóm 32 ca

| Nhóm sẵn sàng | Số ca | Mã | Ý nghĩa |
|---|---:|---|---|
| `software_automated` | 3 | KT19, KT20, KT21 | Có thể thi hành chính thức trong G18 hoàn toàn bằng phần mềm; hiện vẫn chưa được cập nhật kết quả |
| `software_manual` | 1 | KT34 | Có unit test nhưng còn cần trình duyệt thật và thao tác quyền thông báo |
| `hybrid` | 18 | KT02, KT03, KT04, KT07, KT08, KT09, KT13–KT18, KT24, KT26, KT29, KT30, KT36, KT39 | Đã có bao phủ phần mềm/mô phỏng nhưng kết luận cuối cần thiết bị hoặc thao tác thực |
| `hardware_primary` | 9 | KT06, KT10, KT11, KT12, KT25, KT27, KT28, KT31, KT38 | Bản chất tiêu chí là tín hiệu, thời gian hoặc đầu ra vật lý; phần mềm chỉ hỗ trợ quan sát |
| `conditional` | 1 | KT35 | Chỉ thực hiện nếu người dùng kích hoạt chức năng nhóm C MR-01 |

Danh sách máy đọc trong `config/stage18-test-readiness.json` lưu đường dẫn bao phủ tự động và bằng chứng còn thiếu cho từng ca. Trường `acceptance_result` cố định là `CHƯA THỰC HIỆN` trong giai đoạn chuẩn bị.

## 4. Cổng tự kiểm tra bản đồ

Chạy từ gốc dự án:

```powershell
pnpm check:stage18-readiness
```

Checker xác nhận:

1. manifest khớp chính xác 32 tiêu đề `KTxx` của Ma trận 1.2;
2. không dùng lại KT01, KT05, KT22, KT23, KT32, KT33 hoặc KT37;
3. mọi đường dẫn kiểm thử tự động đều tồn tại;
4. đúng phân nhóm 3/1/18/9/1;
5. KT19–KT21 được tách là ca thuần phần mềm, KT34 giữ thao tác trình duyệt và KT35 giữ điều kiện nhóm C;
6. cả manifest lẫn Ma trận vẫn không cập nhật ca nào khỏi `CHƯA THỰC HIỆN`.

## 5. Bộ lệnh phần mềm đã có

```powershell
pnpm typecheck
pnpm test
pnpm test:resilience
pnpm check:stage17
pnpm integration:stage17
pnpm check:stage18-readiness
pnpm preflight:stage18
```

`preflight:stage18` build lại sản phẩm, chạy các test server/web liên quan và runner loopback cho KT19–KT21. Nó ghi `data/logs/stage18-software-preflight.json` với kết quả `PREFLIGHT_PASS`, đồng thời cố định `acceptance_result` là `CHƯA THỰC HIỆN` và `hardware_evidence=false`.

Lượt tiền kiểm ngày 29/09/2026 đã đạt: build server/web; **15/15** test server chọn lọc; **13/13** test web chọn lọc; runner loopback **15/15**. Đây là `PREFLIGHT_PASS`, không phải kết quả `ĐẠT` của KT19, KT20 hoặc KT21.

Hồi quy chịu lỗi bổ sung cùng ngày đạt **6/6**: timeout lệnh và kết quả muộn; 1.000 payload MQTT tùy ý; tối đa 512 đột biến telemetry một byte; topic gần đúng/traversal; 25 chu kỳ reconnect ở lớp dịch vụ; và cách web hiển thị trạng thái `unknown` mà không báo thành công giả. Runner G17 còn lặp **3 chu kỳ broker Mosquitto thật**. Host test UNO/ESP32 đã được mở rộng để loại mọi tiền tố khung bị cắt, delimiter sai vị trí và khung thử hỏng một bit. Tất cả vẫn là kiểm tra phần mềm/host, không phải bằng chứng UART hoặc board thật.

Các lệnh trên là kiểm tra phát triển và chuẩn bị. Khi G18 mở chính thức, từng ca cần một biên bản riêng ghi đầu vào, thời gian, môi trường, kết quả, đường dẫn log/ảnh và quyết định theo đúng tiêu chí của Ma trận 1.2.

## 6. Thứ tự thực hiện sau khi G17 đóng

1. Chạy hồi quy kiểu, unit test và integration runner trên phiên bản đã tích hợp phần cứng.
2. Thi hành KT19, KT20 và KT21 trước vì không phụ thuộc board; lưu biên bản riêng cho từng ca.
3. Thi hành KT34 trên trình duyệt thật với cả nhánh cấp quyền và từ chối quyền.
4. Dùng kết quả G19 phần cứng cho các ca `hybrid` và `hardware_primary`; không suy diễn từ simulator.
5. Giữ KT35 ở trạng thái điều kiện nếu MR-01 chưa được kích hoạt.
6. Chỉ cập nhật Ma trận sau khi từng gói bằng chứng được đối chiếu với tiêu chí đạt/không đạt.

## 7. Điểm dừng

Việc chuẩn bị bản đồ G18 có thể hoàn thành khi chưa có board. Tuy nhiên, dự án vẫn ở G17 cho đến khi các cổng vật lý trong tài liệu tích hợp được thực hiện và duyệt. Không dùng tài liệu này để bỏ qua G17 hoặc chuyển thẳng sang G18/G19.
