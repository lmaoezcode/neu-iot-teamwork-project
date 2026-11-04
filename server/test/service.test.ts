import { describe, expect, it } from 'vitest';
import { MemoryRepository } from '../src/data/memory-repository.js';
import { EventHub } from '../src/realtime/event-stream.js';
import { SmartRoomService } from '../src/services/smart-room-service.js';
import { hashPassword } from '../src/security/password.js';
import { initialConfigSettings } from '../src/types/domain.js';
import { envelope, onlineAvailability, reportedState, testConfig } from './helpers/fixtures.js';
import { FakeMqttClient } from './helpers/fake-mqtt.js';

describe('dịch vụ MQTT máy chủ', () => {
  it('không cho state cũ ghi đè và khử trùng lặp sự kiện tin cậy', async () => {
    const config = testConfig(await hashPassword('Mat-khau-thu-nghiem-2026!'));
    const repository = new MemoryRepository();
    const mqtt = new FakeMqttClient();
    const service = new SmartRoomService(config, repository, mqtt, new EventHub(32));
    await service.start();
    const root = 'smartroom/v1/devices/room-01';
    await mqtt.emit(`${root}/availability`, onlineAvailability(), { retained: true });
    await mqtt.emit(`${root}/state/reported`, reportedState(45, 1, 'state-45'), { retained: true });
    await mqtt.emit(`${root}/state/reported`, reportedState(44, 1, 'state-44'), { retained: true });
    expect((await service.getOverview()).state?.data.state_version).toBe(45);

    const event = envelope('event-unique-1', {
      event_id: 'event-unique-1',
      event_type: 'device_state_changed',
      severity: 'info',
      source: 'uno',
      occurred_at: null,
      uptime_ms: 9000,
      state_version: 45,
      details: { component: 'light', detail_value: 1 },
      replayed: false
    });
    await mqtt.emit(`${root}/events`, event);
    await mqtt.emit(`${root}/events`, event);
    const logs = await service.getLogs({ limit: 100 });
    expect(logs.items.filter((item) => item.referenceId === 'event-unique-1')).toHaveLength(1);
    await service.stop();
  });

  it('chấp nhận LWT tối giản nhưng loại device_id không khớp topic', async () => {
    const config = testConfig(await hashPassword('Mat-khau-thu-nghiem-2026!'));
    const repository = new MemoryRepository();
    const mqtt = new FakeMqttClient();
    const service = new SmartRoomService(config, repository, mqtt, new EventHub(32));
    await service.start();
    const root = 'smartroom/v1/devices/room-01';
    await mqtt.emit(
      `${root}/availability`,
      {
        schema: 'smartroom.mqtt',
        schema_version: 1,
        device_id: 'room-01',
        data: { status: 'offline', reason: 'unexpected_disconnect' }
      },
      { retained: true }
    );
    expect((await service.getOverview()).availability?.data.status).toBe('offline');

    await mqtt.emit(
      `${root}/availability`,
      onlineAvailability('availability-wrong'),
      { retained: true }
    );
    const wrong = onlineAvailability('availability-other');
    wrong.device_id = 'room-02';
    await mqtt.emit(`${root}/availability`, wrong, { retained: true });
    expect((await service.getOverview()).availability?.data.status).toBe('online');
    const logs = await service.getLogs({ limit: 100 });
    expect(logs.items.some((item) => item.message.includes('device_id không khớp'))).toBe(true);
    await service.stop();
  });

  it('không khử nhầm chuyển tiếp pending sang applied của cùng config_version', async () => {
    const config = testConfig(await hashPassword('Mat-khau-thu-nghiem-2026!'));
    const repository = new MemoryRepository();
    const mqtt = new FakeMqttClient();
    const service = new SmartRoomService(config, repository, mqtt, new EventHub(32));
    await service.start();
    const topic = 'smartroom/v1/devices/room-01/config/reported';
    await mqtt.emit(
      topic,
      envelope('config-report-pending-1', {
        config_version: 1,
        apply_result: 'pending',
        reason_code: 'none',
        reported_at_uptime_ms: 100,
        settings: initialConfigSettings
      }),
      { retained: true }
    );
    await mqtt.emit(
      topic,
      envelope('config-report-applied-1', {
        config_version: 1,
        apply_result: 'applied',
        reason_code: 'none',
        reported_at_uptime_ms: 150,
        settings: initialConfigSettings
      }),
      { retained: true }
    );
    const current = await service.getConfig();
    expect(current.reported?.data.apply_result).toBe('applied');
    expect(current.desired.deliveryStatus).toBe('applied');
    await service.stop();
  });
});
