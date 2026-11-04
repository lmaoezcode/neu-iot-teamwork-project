import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRepository } from '../src/data/memory-repository.js';
import { EventHub } from '../src/realtime/event-stream.js';
import { hashPassword } from '../src/security/password.js';
import { SmartRoomService } from '../src/services/smart-room-service.js';
import { envelope, onlineAvailability, reportedState, testConfig } from './helpers/fixtures.js';
import { FakeMqttClient } from './helpers/fake-mqtt.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('hết hạn lệnh không được xác nhận', () => {
  it('chuyển pending thành unknown, không giả thành công và vẫn hòa giải được kết quả muộn', async () => {
    const passwordHash = await hashPassword('Mat-khau-thu-nghiem-2026!');
    let currentTime = Date.parse('2026-09-29T05:00:00.000Z');
    vi.useFakeTimers();

    const repository = new MemoryRepository();
    const mqtt = new FakeMqttClient();
    const service = new SmartRoomService(
      testConfig(passwordHash),
      repository,
      mqtt,
      new EventHub(32),
      () => new Date(currentTime)
    );

    try {
      await service.start();
      const root = 'smartroom/v1/devices/room-01';
      await mqtt.emit(`${root}/availability`, onlineAvailability(), { retained: true });
      await mqtt.emit(`${root}/state/reported`, reportedState(), { retained: true });

      const command = await service.submitCommand(
        {
          operation: 'set_device',
          target: 'lamp',
          value: 'on',
          expected_state_version: 44,
          options: { user_confirmed: true, force_manual: true }
        },
        'owner-1'
      );
      expect(command.status).toBe('pending');
      expect(command.reasonCode).toBe('waiting_device_result');

      currentTime += 31_000;
      await vi.advanceTimersByTimeAsync(1_000);

      const timedOut = await service.getCommand(command.commandId);
      expect(timedOut.status).toBe('unknown');
      expect(timedOut.reasonCode).toBe('device_result_timeout');
      expect(timedOut.actualState).toEqual({});
      expect((await service.getOverview()).state?.data.outputs.lamp.on).toBe(false);

      const logs = await service.getLogs({ type: 'command', limit: 100 });
      expect(logs.items.some((item) =>
        item.referenceId === command.commandId &&
        item.severity === 'warning' &&
        item.details.reason === 'device_result_timeout'
      )).toBe(true);

      await mqtt.emit(
        `${root}/commands/result`,
        envelope(`late-result-${command.commandId}`, {
          command_id: command.commandId,
          result: 'applied',
          reason_code: 'none',
          config_version: 2,
          state_version: 45,
          actual_state: { lamp_on: true, control_mode: 'manual' },
          uno_ack: true,
          replayed: false
        })
      );

      const reconciled = await service.getCommand(command.commandId);
      expect(reconciled.status).toBe('applied');
      expect(reconciled.reasonCode).toBe('none');
      expect(reconciled.actualState).toEqual({ lamp_on: true, control_mode: 'manual' });
      expect((await service.getConfig()).desired.settings.control_mode).toBe('manual');
    } finally {
      await service.stop();
    }
  });
});
