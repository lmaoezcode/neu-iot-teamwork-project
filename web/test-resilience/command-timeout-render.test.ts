import { describe, expect, it } from 'vitest';
import { initialState } from '../src/state/store';
import { renderApplication } from '../src/ui/render';

describe('hiển thị lệnh không được xác nhận', () => {
  it('ghi Không xác định và lý do timeout thay vì báo áp dụng thành công', () => {
    const state = initialState();
    state.initializing = false;
    state.route = '/dieu-khien';
    state.returnRoute = '/dieu-khien';
    state.session = {
      authenticated: true,
      user: { id: 'owner-1', username: 'owner', role: 'owner' },
      csrf_token: 'csrf',
      expires_at: '2026-09-29T06:00:00.000Z'
    };
    state.pendingCommand = {
      commandId: 'cmd-timeout-preflight',
      deviceId: 'room-01',
      requestedBy: 'owner-1',
      request: {
        command_id: 'cmd-timeout-preflight',
        operation: 'set_device',
        target: 'lamp',
        value: 'on',
        issued_at: '2026-09-29T05:00:00.000Z',
        expires_at: '2026-09-29T05:00:30.000Z',
        ttl_ms: 30_000,
        expected_state_version: 44,
        base_config_version: 1,
        new_config_version: 2,
        options: { user_confirmed: true, force_manual: true, transition_home: false }
      },
      status: 'unknown',
      reasonCode: 'device_result_timeout',
      actualState: {},
      createdAt: '2026-09-29T05:00:00.000Z',
      publishedAt: '2026-09-29T05:00:00.100Z',
      resultAt: '2026-09-29T05:00:31.000Z'
    };

    const html = renderApplication(state);
    expect(html).toContain('Không xác định — đang đồng bộ');
    expect(html).toContain('Thiết bị chưa xác nhận đúng hạn');
    expect(html).not.toContain('Thiết bị đã xác nhận áp dụng lệnh');
  });
});
