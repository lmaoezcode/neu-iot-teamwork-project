import { describe, expect, it, vi } from 'vitest';
import { NotificationManager, type NotificationPort } from './notifications';
import type { AlertRecord } from './types';

function alert(alertId: string, active = true): AlertRecord {
  return {
    alertId, deviceId: 'room-01', causeId: 1, type: 'safety', severity: 'critical', source: 'mq2',
    lifecycle: active ? 'sounding' : 'awaiting_ack', active, reasonCode: 'threshold_exceeded', detail: {},
    updatedAt: '2026-09-28T00:00:00.000Z'
  };
}

function port(permission: NotificationPermission): NotificationPort & { show: ReturnType<typeof vi.fn> } {
  return {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permission),
    show: vi.fn()
  };
}

describe('NotificationManager', () => {
  it('báo unsupported khi trình duyệt không có API thông báo', async () => {
    const manager = new NotificationManager(null);
    expect(manager.permission()).toBe('unsupported');
    await expect(manager.request()).resolves.toBe('unsupported');
  });

  it('không tạo thông báo trước khi người dùng cấp quyền', () => {
    const fake = port('default');
    const manager = new NotificationManager(fake);
    expect(manager.notifyNewActive([alert('a1')])).toBe(0);
    expect(fake.show).not.toHaveBeenCalled();
  });

  it('chỉ thông báo nguyên nhân đang hoạt động và chống gửi lặp theo alertId', () => {
    const fake = port('granted');
    const manager = new NotificationManager(fake);
    expect(manager.notifyNewActive([alert('a1'), alert('a2', false)])).toBe(1);
    expect(manager.notifyNewActive([alert('a1')])).toBe(0);
    expect(fake.show).toHaveBeenCalledOnce();
  });

  it('chỉ xin quyền khi phương thức request được gọi rõ ràng', async () => {
    const fake = port('granted');
    const manager = new NotificationManager(fake);
    await expect(manager.request()).resolves.toBe('granted');
    expect(fake.requestPermission).toHaveBeenCalledOnce();
  });
});
