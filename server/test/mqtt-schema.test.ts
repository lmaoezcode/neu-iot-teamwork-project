import { describe, expect, it } from 'vitest';
import { configSettingsSchema, parseInboundTopic, parseMqttPayload } from '../src/validation/schemas.js';
import { telemetry } from './helpers/fixtures.js';

describe('kiểm tra tải tin MQTT', () => {
  it('nhận telemetry đúng firmware và loại trường ppm không được phép', () => {
    const valid = telemetry();
    const accepted = parseMqttPayload('telemetry/sensors', new TextEncoder().encode(JSON.stringify(valid)));
    expect(accepted.success).toBe(true);

    const invalid = structuredClone(valid) as { data: { mq2: Record<string, unknown> } };
    invalid.data.mq2.ppm = 123;
    const rejected = parseMqttPayload('telemetry/sensors', new TextEncoder().encode(JSON.stringify(invalid)));
    expect(rejected.success).toBe(false);
  });

  it('loại payload quá 2.048 byte và topic ngoài cây chuẩn', () => {
    expect(parseMqttPayload('events', new Uint8Array(2049)).success).toBe(false);
    expect(parseInboundTopic('smartroom/v1/devices', 'smartroom/v1/devices/room-01/telemetry/sensors')).toEqual({
      deviceId: 'room-01',
      suffix: 'telemetry/sensors'
    });
    expect(parseInboundTopic('smartroom/v1/devices', 'other/room-01/telemetry/sensors')).toBeNull();
  });

  it('kiểm tra nguyên tử quan hệ ngưỡng và hiệu chuẩn', () => {
    const invalid = configSettingsSchema.safeParse({
      light_on_pct: 50,
      light_off_pct: 52,
      control_mode: 'auto',
      room_profile: 'home',
      light_calibration: { dark_adc: 100, bright_adc: 105, enabled: true },
      mq2: { baseline_adc: 900, span_adc: 200, threshold_pct: 80, calibration_enabled: false },
      door_zone: { threshold_mm: 500, confirm_samples: 3, calibration_enabled: false }
    });
    expect(invalid.success).toBe(false);
  });
});

