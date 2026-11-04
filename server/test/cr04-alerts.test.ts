import { describe, expect, it } from 'vitest';
import { MemoryRepository } from '../src/data/memory-repository.js';

describe('CR-04 — cảnh báo chờ xác nhận', () => {
  it('giữ cảnh báo đã hết nguyên nhân trong overview nhưng không coi là active', async () => {
    const repository = new MemoryRepository(() => new Date('2026-09-28T06:00:00.000Z'));
    await repository.initialize('room-01', {
      ownerUsername: 'chu-phong',
      ownerPasswordHash: 'scrypt$test-only'
    });
    await repository.saveAlertEvent('room-01', {
      alert_id: 'alert-awaiting-ack',
      operation: 'clear',
      alert_type: 'security',
      severity: 'warning',
      source: 'door_zone',
      lifecycle: 'awaiting_ack',
      active: false,
      cause_id: 7,
      reason_code: 'cause_cleared',
      detail: {},
      replayed: false
    }, '2026-09-28T06:00:00.000Z', 'alert-event-clear-1', 17);

    const overview = await repository.getOverview('room-01');
    expect(overview.alerts.map((item) => item.alertId)).toContain('alert-awaiting-ack');
    expect(overview.activeAlerts).toHaveLength(0);
  });
});
