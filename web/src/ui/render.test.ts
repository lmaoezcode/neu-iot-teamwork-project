import { describe, expect, it } from 'vitest';
import { initialState } from '../state/store';
import type { AppRoute, AppState } from '../types';
import { renderApplication, renderLogin } from './render';

function authenticated(route: AppRoute): AppState {
  return {
    ...initialState(),
    route,
    returnRoute: route,
    initializing: false,
    session: {
      authenticated: true,
      user: { id: 'owner-1', username: 'owner', role: 'owner' },
      csrf_token: 'csrf',
      expires_at: '2026-09-28T13:00:00.000Z'
    }
  };
}

describe('renderApplication', () => {
  it('hiển thị biểu mẫu đăng nhập tiếng Việt mà không nhúng mật khẩu', () => {
    const state = initialState();
    state.initializing = false;
    const html = renderLogin(state);
    expect(html).toContain('Tên tài khoản');
    expect(html).toContain('autocomplete="current-password"');
    expect(html).not.toContain('localStorage');
  });

  it('có liên kết bỏ qua và điều hướng đủ các trang sau xác thực', () => {
    const html = renderApplication(authenticated('/tong-quan'));
    expect(html).toContain('Bỏ qua đến nội dung chính');
    expect(html).toContain('/an-ninh-an-toan');
    expect(html).toContain('/nhat-ky');
  });

  it('gắn nhãn MÔ PHỎNG cho quạt và khóa trên trang điều khiển', () => {
    const html = renderApplication(authenticated('/dieu-khien'));
    expect(html.match(/MÔ PHỎNG/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('không có servo/chốt đang hoạt động');
  });

  it('không trình bày MQ-2 như phép đo ppm hay cảm biến lửa thương mại', () => {
    const html = renderApplication(authenticated('/an-ninh-an-toan'));
    expect(html).toContain('không phải ppm');
    expect(html).toContain('Không phải thiết bị báo cháy thương mại');
    expect(html).not.toMatch(/\d+\s*ppm/i);
  });
});
