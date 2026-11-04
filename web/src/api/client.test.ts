import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';
import type { CommandInput, SessionResponse } from '../types';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

const session: SessionResponse = {
  authenticated: true,
  user: { id: 'owner-1', username: 'owner', role: 'owner' },
  csrf_token: 'csrf-test',
  expires_at: '2026-09-28T13:00:00.000Z'
};

const command: CommandInput = { operation: 'set_device', target: 'lamp', value: 'on' };

describe('ApiClient', () => {
  it('gửi cookie và CSRF cho thao tác thay đổi trạng thái', async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce(json(session))
      .mockResolvedValueOnce(json({ accepted: true, applied: false, command: { commandId: 'cmd-1' } }));
    const client = new ApiClient(mock as unknown as typeof fetch);
    await client.session();
    await client.command(command);

    const request = mock.mock.calls[1];
    expect(request?.[0]).toBe('/api/commands');
    const init = request?.[1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('csrf-test');
  });

  it('không gửi lệnh thay đổi khi chưa có CSRF', async () => {
    const mock = vi.fn();
    const client = new ApiClient(mock as unknown as typeof fetch);
    await expect(client.command(command)).rejects.toMatchObject({ status: 403, errorCode: 'csrf_missing' });
    expect(mock).not.toHaveBeenCalled();
  });

  it('chuẩn hóa lỗi mạng thành ApiError có mã ổn định', async () => {
    const client = new ApiClient(vi.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch);
    await expect(client.overview()).rejects.toMatchObject({ status: 0, errorCode: 'network_unavailable' });
  });

  it('gọi xử lý hết phiên và giữ thông báo lỗi từ máy chủ khi nhận 401', async () => {
    const unauthorized = vi.fn();
    const client = new ApiClient(
      vi.fn().mockResolvedValue(json({ error_code: 'session_expired', message: 'Phiên đã hết hạn.' }, 401)) as unknown as typeof fetch,
      unauthorized
    );
    await expect(client.overview()).rejects.toMatchObject({ status: 401, errorCode: 'session_expired' });
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('mã hóa bộ lọc nhật ký vào chuỗi truy vấn', async () => {
    const mock = vi.fn().mockResolvedValue(json({ items: [], nextCursor: null }));
    const client = new ApiClient(mock as unknown as typeof fetch);
    await client.logs({ type: 'safety', severity: 'critical', limit: 25 });
    const path = String(mock.mock.calls[0]?.[0]);
    expect(path).toContain('type=safety');
    expect(path).toContain('severity=critical');
    expect(path).toContain('limit=25');
  });
});
