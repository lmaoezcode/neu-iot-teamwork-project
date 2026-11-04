import { describe, expect, it } from 'vitest';
import { mergeRealtimeOverview } from './realtime';
import type { AlertRecord, DeviceOverview, OverviewResponse, ReportedStateData } from '../types';

function state(version: number): ReportedStateData {
  return {
    state_version: version,
    config_version: 1,
    room_profile: 'home',
    control_mode: 'auto',
    outputs: {
      lamp: { on: false, source: 'automatic', actuator_mode: 'hardware_real' },
      fan: { on: false, source: 'automatic', actuator_mode: 'simulated' },
      lock: { command: 'locked', actuator_mode: 'simulated', mechanical_verified: false }
    },
    security: { door_zone_armed: false },
    alert: { lifecycle: 'normal', active_count: 0 },
    alarm_output: { led: false, buzzer: false, buzzer_available: false },
    health: { connection: 'online', sensor_fault: false, queue_depth: 0 }
  };
}

function overview(version = 3): OverviewResponse {
  const source = { sentAt: null, timeQuality: 'unsynced' as const, espBootId: 1, unoBootId: 1, linkSessionId: 1 };
  const device: DeviceOverview = {
    deviceId: 'room-01',
    availability: null,
    telemetry: null,
    state: { data: state(version), messageId: 'm1', receivedAt: '2026-09-28T00:00:00.000Z', retained: false, source },
    diagnostics: null,
    desiredConfig: {} as DeviceOverview['desiredConfig'],
    reportedConfig: null,
    alerts: [],
    activeAlerts: [],
    storageMode: 'sqlite'
  };
  return { server_time: '2026-09-28T00:00:00.000Z', stale_after_seconds: 15, overview: device };
}

function alert(active: boolean): AlertRecord {
  return {
    alertId: 'alert-1', deviceId: 'room-01', causeId: 1, type: 'security', severity: 'warning',
    source: 'door_zone', lifecycle: active ? 'sounding' : 'awaiting_ack', active,
    reasonCode: active ? 'intrusion' : 'cause_cleared', detail: {}, updatedAt: '2026-09-28T00:00:00.000Z'
  };
}

describe('mergeRealtimeOverview', () => {
  it('không dựng trạng thái bán phần khi chưa có snapshot', () => {
    expect(mergeRealtimeOverview(null, 'telemetry.updated', { sample_counter: 1 })).toBeNull();
  });

  it('thay toàn bộ overview từ snapshot đồng bộ đầu phiên', () => {
    const snapshot = overview(8).overview;
    const merged = mergeRealtimeOverview(null, 'state.updated', { snapshot: true, overview: snapshot });
    expect(merged?.overview.state?.data.state_version).toBe(8);
  });

  it('bỏ qua state_version cũ để tránh giao diện quay lùi', () => {
    const current = overview(5);
    const merged = mergeRealtimeOverview(current, 'state.updated', state(4));
    expect(merged).toBe(current);
  });

  it('chấp nhận phiên bản trạng thái mới hơn', () => {
    const merged = mergeRealtimeOverview(overview(5), 'state.updated', { ...state(6), received_at: '2026-09-28T01:00:00.000Z' });
    expect(merged?.overview.state?.data.state_version).toBe(6);
    expect(merged?.overview.state?.receivedAt).toBe('2026-09-28T01:00:00.000Z');
  });

  it('giữ cả cảnh báo chờ xác nhận và danh sách nguyên nhân đang hoạt động', () => {
    const cleared = alert(false);
    const active = { ...alert(true), alertId: 'alert-2' };
    const merged = mergeRealtimeOverview(overview(), 'alert.updated', {
      alerts: [cleared, active], active_alerts: [active]
    });
    expect(merged?.overview.alerts).toHaveLength(2);
    expect(merged?.overview.activeAlerts.map((item) => item.alertId)).toEqual(['alert-2']);
  });
});
