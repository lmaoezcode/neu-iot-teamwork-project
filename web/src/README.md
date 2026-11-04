# Ứng dụng web phòng thông minh

Ứng dụng Giai đoạn 16 là SPA TypeScript không phụ thuộc framework, gồm route guard, API client, SSE có polling dự phòng, tám tuyến tiếng Việt, biểu đồ SVG giữ khoảng trống, nhật ký, cấu hình và vòng đời lệnh/cảnh báo.

Chạy máy chủ ở cổng 3000 rồi chạy `pnpm web:dev` từ gốc. Vite chuyển tiếp `/api` và `/health` tới `WEB_API_TARGET` (mặc định `http://127.0.0.1:3000`); trình duyệt không kết nối MQTT trực tiếp.
