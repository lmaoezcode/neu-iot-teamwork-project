import { describe, expect, it } from 'vitest';
import { MemoryRepository } from '../src/data/memory-repository.js';
import { EventHub } from '../src/realtime/event-stream.js';
import { hashPassword } from '../src/security/password.js';
import { SmartRoomService } from '../src/services/smart-room-service.js';
import { envelope, testConfig } from './helpers/fixtures.js';
import { FakeMqttClient } from './helpers/fake-mqtt.js';

async function waitUntil(label: string, predicate: () => boolean | Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`Hết thời gian chờ: ${label}`);
}

describe('soak reconnect ở lớp dịch vụ', () => {
  it('giữ đơn điệu 25 phiên bản cấu hình qua 25 chu kỳ offline/online', async () => {
    const passwordHash = await hashPassword('Mat-khau-thu-nghiem-2026!');
    const repository = new MemoryRepository();
    const mqtt = new FakeMqttClient();
    const service = new SmartRoomService(testConfig(passwordHash), repository, mqtt, new EventHub(64));

    try {
      await service.start();
      await waitUntil('kết nối ban đầu', () => service.health().mqtt === 'connected');
      const root = 'smartroom/v1/devices/room-01';
      const observedVersions: number[] = [];

      for (let cycle = 0; cycle < 25; cycle += 1) {
        mqtt.setConnected(false);
        await waitUntil(`offline ${cycle}`, () => service.health().mqtt === 'offline');

        const current = await service.getConfig();
        const settings = structuredClone(current.desired.settings);
        settings.light_on_pct = 20 + (cycle % 10);
        settings.light_off_pct = settings.light_on_pct + 20;
        const queued = await service.updateDesiredConfig(current.desired.version, settings, 'soak-test');
        expect(queued.deliveryStatus).toBe('pending_delivery');

        mqtt.setConnected(true);
        await waitUntil(`publish config ${queued.version}`, () => mqtt.publications.some((publication) => {
          if (!publication.retain || !publication.topic.endsWith('/config/desired')) return false;
          return JSON.parse(publication.payload).data.config_version === queued.version;
        }));

        await mqtt.emit(
          `${root}/config/reported`,
          envelope(`soak-config-${queued.version}`, {
            config_version: queued.version,
            apply_result: 'applied',
            reason_code: 'none',
            reported_at_uptime_ms: 1_000 + cycle,
            settings
          }),
          { retained: true }
        );
        const applied = await service.getConfig();
        expect(applied.desired.version).toBe(queued.version);
        expect(applied.desired.deliveryStatus).toBe('applied');
        observedVersions.push(queued.version);
      }

      expect(observedVersions).toEqual(Array.from({ length: 25 }, (_, index) => index + 2));
      for (const version of observedVersions) {
        const matchingPublishes = mqtt.publications.filter((publication) => {
          if (!publication.retain || !publication.topic.endsWith('/config/desired')) return false;
          return JSON.parse(publication.payload).data.config_version === version;
        });
        expect(matchingPublishes).toHaveLength(1);
      }
    } finally {
      await service.stop();
    }
  });
});
