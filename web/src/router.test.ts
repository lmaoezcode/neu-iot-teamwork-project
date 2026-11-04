import { describe, expect, it } from 'vitest';
import { guardedRoute, normalizeRoute, routeLabel, routes } from './router';

describe('router', () => {
  it('nhận đủ bảy trang nghiệp vụ và bỏ dấu gạch chéo cuối', () => {
    expect(routes).toHaveLength(7);
    expect(normalizeRoute('/an-ninh-an-toan/')).toBe('/an-ninh-an-toan');
  });

  it('đưa đường dẫn không tồn tại về Tổng quan', () => {
    expect(normalizeRoute('/khong-ton-tai')).toBe('/tong-quan');
  });

  it('buộc người chưa xác thực về Đăng nhập', () => {
    expect(guardedRoute('/dieu-khien', false)).toBe('/dang-nhap');
  });

  it('không giữ người đã xác thực ở trang Đăng nhập', () => {
    expect(guardedRoute('/dang-nhap', true)).toBe('/tong-quan');
    expect(routeLabel('/cai-dat-tu-dong')).toBe('Cài đặt tự động');
  });
});
