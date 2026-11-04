import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  CommandRecord,
  DesiredConfigRecord,
  ReceivedValue,
  ReportedStateData,
  TelemetryData
} from '../src/types/domain.js';
import { initialConfigSettings } from '../src/types/domain.js';
import type { NewOutboxMessage } from '../src/data/repository.js';
import { backupDatabase, openDatabase, readDatabaseDiagnostics } from '../src/data/sqlite-database.js';
import { SQLiteRepository } from '../src/data/sqlite-repository.js';
import { SessionStore } from '../src/security/session-store.js';
import { hashPassword } from '../src/security/password.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function tempDatabase(name = 'smartroom.sqlite3'): Promise<{ directory: string; filename: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'smartroom-db-test-'));
  temporaryDirectories.push(directory);
  return { directory, filename: join(directory, name) };
}

const source = {
  sentAt: null,
  timeQuality: 'unsynced' as const,
  espBootId: 3,
  unoBootId: 17,
  linkSessionId: 91
};

function telemetry(receivedAt: string, messageId: string, lightPct: number): ReceivedValue<TelemetryData> {
  return {
    messageId,
    receivedAt,
    retained: false,
    source,
    data: {
      uptime_ms: 1000,
      sample_counter: Number(messageId.replace(/\D/g, '')) || 1,
      light: { adc: 400, relative_pct: lightPct, quality: 'valid' },
      door_zone: { distance_mm: 300, state: 'clear', quality: 'valid' },
      mq2: { adc: 500, relative_pct: 40, state: 'warming', quality: 'valid', heat_status: 'warming' },
      flame: { raw: 0, state: 'normal', quality: 'valid' }
    }
  };
}

function state(receivedAt: string, version: number): ReceivedValue<ReportedStateData> {
  return {
    messageId: `state-${version}`,
    receivedAt,
    retained: true,
    source,
    data: {
      state_version: version,
      config_version: 1,
      room_profile: 'home',
      control_mode: 'auto',
      outputs: {
        lamp: { on: false, source: 'auto', actuator_mode: 'hardware_real' },
        fan: { on: false, source: 'auto', actuator_mode: 'simulated' },
        lock: { command: 'locked', actuator_mode: 'simulated', mechanical_verified: false }
      },
      security: { door_zone_armed: false },
      alert: { lifecycle: 'normal', active_count: 0 },
      alarm_output: { led: false, buzzer: false, buzzer_available: false },
      health: { connection: 'online', sensor_fault: false, queue_depth: 0 }
    }
  };
}

async function initializedRepository(filename: string, now: () => Date = () => new Date()): Promise<SQLiteRepository> {
  const repository = new SQLiteRepository({ filename, retentionDays: 30, now });
  await repository.initialize('room-01', {
    ownerUsername: 'chu-phong',
    ownerPasswordHash: await hashPassword('Mat-khau-thu-nghiem-2026!')
  });
  return repository;
}

function commandRecord(createdAt: string): CommandRecord {
  return {
    commandId: 'cmd-persist-1',
    deviceId: 'room-01',
    requestedBy: 'owner',
    request: {
      command_id: 'cmd-persist-1',
      operation: 'set_device',
      target: 'lamp',
      value: 'on',
      issued_at: createdAt,
      expires_at: new Date(Date.parse(createdAt) + 30_000).toISOString(),
      ttl_ms: 30_000,
      expected_state_version: 44,
      base_config_version: 1,
      new_config_version: 1,
      options: { user_confirmed: true, force_manual: true, transition_home: false }
    },
    status: 'pending',
    reasonCode: 'waiting_device_result',
    actualState: null,
    createdAt,
    publishedAt: null,
    resultAt: null,
    pendingConfigMutation: null
  };
}

function outbox(createdAt: string): NewOutboxMessage {
  return {
    messageId: 'cmd-persist-1',
    deviceId: 'room-01',
    topic: 'smartroom/v1/devices/room-01/commands/request',
    payload: JSON.stringify({ command_id: 'cmd-persist-1' }),
    qos: 1,
    retain: false,
    kind: 'command',
    availableAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 30_000).toISOString()
  };
}

describe('SQLiteRepository', () => {
  it('áp dụng migration đầy đủ, bật WAL/FK và từ chối khóa ngoại sai', async () => {
    const { filename } = await tempDatabase();
    const repository = await initializedRepository(filename);
    const diagnostics = repository.diagnostics();
    expect(diagnostics.integrity).toBe('ok');
    expect(diagnostics.foreignKeys).toBe(true);
    expect(diagnostics.journalMode).toBe('wal');
    expect(diagnostics.userVersion).toBe(1);
    expect(diagnostics.migrations).toHaveLength(1);
    await expect(repository.saveTelemetry('room-khong-ton-tai', telemetry(new Date().toISOString(), 'sample-1', 30))).rejects.toThrow();
    await repository.close();
  });

  it('giữ state, mẫu phút và chống trùng sau khi mở lại tiến trình', async () => {
    const { filename } = await tempDatabase();
    const first = await initializedRepository(filename);
    const at = '2026-09-28T01:00:10.000Z';
    expect(await first.rememberMessage('room-01', 'event-persist-1')).toBe(true);
    await first.saveTelemetry('room-01', telemetry(at, 'sample-1', 20));
    await first.saveTelemetry('room-01', telemetry('2026-09-28T01:00:40.000Z', 'sample-2', 40));
    expect(await first.saveReportedState('room-01', state(at, 45))).toBe(true);
    await first.close();

    const second = await initializedRepository(filename);
    expect(await second.rememberMessage('room-01', 'event-persist-1')).toBe(false);
    expect((await second.getOverview('room-01')).state?.data.state_version).toBe(45);
    const history = await second.getLightHistory('room-01', '2026-09-28T01:00:00.000Z', '2026-09-28T01:02:00.000Z');
    expect(history).toHaveLength(1);
    expect(history[0]?.value).toBe(30);
    expect(history[0]?.sampleCount).toBe(2);
    await second.close();
  });

  it('ghi command và outbox trong cùng giao dịch rồi phục hồi hàng đợi sau restart', async () => {
    const { filename } = await tempDatabase();
    const createdAt = '2026-09-28T02:00:00.000Z';
    const first = await initializedRepository(filename);
    await first.saveCommand(commandRecord(createdAt), outbox(createdAt));
    await first.close();

    const second = await initializedRepository(filename);
    expect((await second.getCommand('cmd-persist-1'))?.status).toBe('pending');
    const pending = await second.listReadyOutbox(createdAt, 10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.messageId).toBe('cmd-persist-1');
    await second.markOutboxPublished('cmd-persist-1', '2026-09-28T02:00:01.000Z');
    expect((await second.getCommand('cmd-persist-1'))?.publishedAt).toBe('2026-09-28T02:00:01.000Z');
    await second.close();
  });

  it('rollback toàn bộ cấu hình sai và giữ desired cũ', async () => {
    const { filename } = await tempDatabase();
    const repository = await initializedRepository(filename);
    const invalid = structuredClone(initialConfigSettings);
    invalid.light_on_pct = 50;
    invalid.light_off_pct = 52;
    const record: DesiredConfigRecord = {
      deviceId: 'room-01',
      version: 2,
      settings: invalid,
      messageId: 'cfg-invalid-2',
      deliveryStatus: 'pending_delivery',
      reasonCode: 'test',
      createdAt: '2026-09-28T03:00:00.000Z',
      createdBy: 'owner'
    };
    await expect(repository.saveDesiredConfig(record)).rejects.toThrow();
    expect((await repository.getDesiredConfig('room-01')).version).toBe(1);
    expect(await repository.listReadyOutbox('2026-09-28T03:00:01.000Z', 10)).toHaveLength(0);
    await repository.close();
  });

  it('giữ phiên đăng nhập qua restart nhưng không lưu cookie token rõ', async () => {
    const { filename } = await tempDatabase();
    const secret = 'test-session-secret-at-least-thirty-two-characters';
    const first = await initializedRepository(filename);
    const sessions = new SessionStore(secret, 3600, first, () => new Date('2026-09-28T04:00:00.000Z'));
    const created = await sessions.create('chu-phong');
    await first.close();
    expect((await readFile(filename)).includes(Buffer.from(created.token))).toBe(false);

    const second = await initializedRepository(filename, () => new Date('2026-09-28T04:05:00.000Z'));
    const restored = new SessionStore(secret, 3600, second, () => new Date('2026-09-28T04:05:00.000Z'));
    expect((await restored.get(created.token))?.username).toBe('chu-phong');
    await restored.revoke(created.token);
    expect(await restored.get(created.token)).toBeNull();
    await second.close();
  });

  it('retention xóa lịch sử cũ nhưng giữ pending, cảnh báo active và cấu hình hiện hành', async () => {
    const { filename } = await tempDatabase();
    let clock = new Date('2026-01-01T00:00:00.000Z');
    const repository = await initializedRepository(filename, () => clock);
    await repository.appendLog({
      id: 'log-old', deviceId: 'room-01', type: 'system', severity: 'info', message: 'cũ',
      source: 'test', referenceId: null, createdAt: clock.toISOString(), details: {}
    });
    await repository.saveTelemetry('room-01', telemetry(clock.toISOString(), 'sample-old', 30));
    await repository.saveAlertEvent('room-01', {
      alert_id: 'alert-active', operation: 'add', alert_type: 'safety', severity: 'critical',
      source: 'mq2', lifecycle: 'sounding', active: true, cause_id: 1, reason_code: 'threshold',
      detail: { relative_pct: 90 }, replayed: false
    }, clock.toISOString(), 'alert-message-1', 17);
    await repository.saveCommand(commandRecord(clock.toISOString()), outbox(clock.toISOString()));

    clock = new Date('2026-02-15T00:00:00.000Z');
    const result = await repository.runRetention('2026-01-16T00:00:00.000Z', 100);
    expect(result.deleted.sensor_minute_samples).toBe(1);
    expect((await repository.getLogs('room-01', { limit: 100 })).items.some((item) => item.id === 'log-old')).toBe(false);
    expect((await repository.getAlert('room-01', 'alert-active'))?.active).toBe(true);
    expect((await repository.getCommand('cmd-persist-1'))?.status).toBe('pending');
    expect((await repository.getDesiredConfig('room-01')).version).toBe(1);
    await repository.close();
  });

  it('WAL cho phép kết nối đọc thấy snapshot đã commit khi writer đang giữ giao dịch mới', async () => {
    const { filename } = await tempDatabase();
    const writer = openDatabase(filename);
    writer.prepare(`
      INSERT INTO users(user_id, username, password_hash, password_algorithm, active, created_at, updated_at)
      VALUES ('owner', 'chu-phong', 'scrypt$16384$8$1$AA$AA', 'scrypt', 1, ?, ?)
    `).run('2026-09-28T00:00:00.000Z', '2026-09-28T00:00:00.000Z');
    writer.prepare(`
      INSERT INTO devices(device_id, display_name, created_at, updated_at)
      VALUES ('room-01', 'Phòng', ?, ?)
    `).run('2026-09-28T00:00:00.000Z', '2026-09-28T00:00:00.000Z');
    const reader = openDatabase(filename);
    writer.exec('BEGIN IMMEDIATE');
    writer.prepare("UPDATE devices SET display_name = 'Chưa commit' WHERE device_id = 'room-01'").run();
    const visible = reader.prepare("SELECT display_name FROM devices WHERE device_id = 'room-01'").get() as { display_name: string };
    expect(visible.display_name).toBe('Phòng');
    writer.exec('ROLLBACK');
    reader.close();
    writer.close();
  });

  it('tạo và mở lại bản sao lưu nhất quán khi WAL hoạt động', async () => {
    const { directory, filename } = await tempDatabase();
    const backup = join(directory, 'backup.sqlite3');
    const repository = await initializedRepository(filename);
    await repository.saveReportedState('room-01', state('2026-09-28T05:00:00.000Z', 50));
    await repository.close();
    await backupDatabase(filename, backup);
    const restored = await initializedRepository(backup);
    expect((await restored.getOverview('room-01')).state?.data.state_version).toBe(50);
    expect(restored.diagnostics().integrity).toBe('ok');
    await restored.close();
  });

  it('migration tạo đủ nhóm bảng bắt buộc và checksum không thay đổi khi mở lại', async () => {
    const { filename } = await tempDatabase();
    const first = openDatabase(filename);
    const before = readDatabaseDiagnostics(first);
    const tables = (first.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
    for (const required of [
      'devices', 'sensor_minute_samples', 'state_reports', 'availability_events',
      'configuration_revisions', 'commands', 'system_events', 'alert_causes',
      'alert_transitions', 'users', 'web_sessions', 'audit_log', 'mqtt_inbox',
      'mqtt_outbox', 'sync_runs'
    ]) expect(tables).toContain(required);
    first.close();
    const second = openDatabase(filename);
    const after = readDatabaseDiagnostics(second);
    expect(after.migrations[0]?.checksum).toBe(before.migrations[0]?.checksum);
    second.close();
  });
});
