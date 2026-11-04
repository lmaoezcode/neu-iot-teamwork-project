import { describe, expect, it } from 'vitest';
import {
  inboundMqttSchemas,
  type InboundMqttSuffix,
  parseInboundTopic,
  parseMqttPayload
} from '../src/validation/schemas.js';
import { telemetry } from './helpers/fixtures.js';

function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

describe('fuzz xác định cho biên MQTT', () => {
  it('không ném ngoại lệ với 1.000 payload byte tùy ý và chỉ trả lý do đã khóa', () => {
    const next = generator(0x17_18_2026);
    const suffixes = Object.keys(inboundMqttSchemas) as InboundMqttSuffix[];
    const allowedReasons = new Set(['payload_size_invalid', 'invalid_utf8_or_json', 'invalid_schema']);

    for (let index = 0; index < 1_000; index += 1) {
      const length = next() % 2_100;
      const payload = new Uint8Array(length);
      for (let offset = 0; offset < length; offset += 1) payload[offset] = next() & 0xff;
      const result = parseMqttPayload(suffixes[index % suffixes.length]!, payload);
      if (!result.success) {
        expect(allowedReasons.has(result.reason)).toBe(true);
        expect(result.issues?.length ?? 0).toBeLessThanOrEqual(8);
      }
    }
  });

  it('mọi đột biến một byte của telemetry đều được xử lý hữu hạn', () => {
    const original = new TextEncoder().encode(JSON.stringify(telemetry('fuzz-telemetry', 37)));
    const attempts = Math.min(original.length, 512);
    for (let index = 0; index < attempts; index += 1) {
      const mutated = original.slice();
      mutated[index] ^= 1 << (index % 8);
      const result = parseMqttPayload('telemetry/sensors', mutated);
      if (!result.success) expect(result.issues?.length ?? 0).toBeLessThanOrEqual(8);
    }
  });

  it('không nhận topic gần đúng, traversal hoặc device_id ngoài miền', () => {
    const root = 'smartroom/v1/devices';
    const rejected = [
      `${root}//telemetry/sensors`,
      `${root}/ROOm-01/telemetry/sensors`,
      `${root}/../room-01/telemetry/sensors`,
      `${root}/r/telemetry/sensors`,
      `${root}/${'r'.repeat(33)}/telemetry/sensors`,
      `${root}/room-01/telemetry/sensors/extra`,
      `${root}/room-01/commands/request`,
      `other/v1/devices/room-01/telemetry/sensors`
    ];
    for (const topic of rejected) expect(parseInboundTopic(root, topic)).toBeNull();
    expect(parseInboundTopic(root, `${root}/room-01/telemetry/sensors`)).toEqual({
      deviceId: 'room-01',
      suffix: 'telemetry/sensors'
    });
  });
});
