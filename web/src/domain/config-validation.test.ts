import { describe, expect, it } from 'vitest';
import { validateConfig } from './config-validation';
import type { ConfigSettings } from '../types';

function validSettings(): ConfigSettings {
  return {
    light_on_pct: 30,
    light_off_pct: 50,
    control_mode: 'auto',
    room_profile: 'home',
    light_calibration: { dark_adc: 100, bright_adc: 900, enabled: true },
    mq2: { baseline_adc: 120, span_adc: 700, threshold_pct: 65, calibration_enabled: false },
    door_zone: { threshold_mm: 250, confirm_samples: 3, calibration_enabled: false }
  };
}

describe('validateConfig', () => {
  it('chấp nhận cấu hình nằm trong mọi giới hạn', () => {
    expect(validateConfig(validSettings())).toEqual({ valid: true, errors: {} });
  });

  it('từ chối vùng trễ ánh sáng nhỏ hơn 5 điểm phần trăm', () => {
    const settings = validSettings();
    settings.light_on_pct = 48;
    settings.light_off_pct = 52;
    const result = validateConfig(settings);
    expect(result.valid).toBe(false);
    expect(result.errors.light_off_pct).toContain('ít nhất 5');
  });

  it('chỉ yêu cầu hai mốc hiệu chuẩn ánh sáng cách nhau khi bật hiệu chuẩn', () => {
    const disabled = validSettings();
    disabled.light_calibration = { dark_adc: 400, bright_adc: 405, enabled: false };
    expect(validateConfig(disabled).valid).toBe(true);

    disabled.light_calibration.enabled = true;
    expect(validateConfig(disabled).errors.light_bright_adc).toContain('ít nhất 10');
  });

  it('từ chối cấu hình MQ-2 vượt miền ADC hoặc phần trăm tương đối', () => {
    const settings = validSettings();
    settings.mq2 = { baseline_adc: 900, span_adc: 200, threshold_pct: 101, calibration_enabled: true };
    const result = validateConfig(settings);
    expect(result.errors.mq2_span_adc).toContain('1023');
    expect(result.errors.mq2_threshold_pct).toContain('0 đến 100');
  });
});
