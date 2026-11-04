import type { ConfigSettings } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateConfig(settings: ConfigSettings): ValidationResult {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(settings.light_on_pct) || settings.light_on_pct < 0 || settings.light_on_pct > 80) {
    errors.light_on_pct = 'Ngưỡng bật đèn phải là số nguyên từ 0 đến 80%.';
  }
  if (!Number.isInteger(settings.light_off_pct) || settings.light_off_pct < 20 || settings.light_off_pct > 100) {
    errors.light_off_pct = 'Ngưỡng tắt đèn phải là số nguyên từ 20 đến 100%.';
  } else if (settings.light_off_pct < settings.light_on_pct + 5) {
    errors.light_off_pct = 'Ngưỡng tắt phải cao hơn ngưỡng bật ít nhất 5 điểm phần trăm.';
  }
  const calibration = settings.light_calibration;
  if (!Number.isInteger(calibration.dark_adc) || calibration.dark_adc < 0 || calibration.dark_adc > 1023) {
    errors.light_dark_adc = 'Mốc tối phải là số nguyên ADC từ 0 đến 1023.';
  }
  if (!Number.isInteger(calibration.bright_adc) || calibration.bright_adc < 0 || calibration.bright_adc > 1023) {
    errors.light_bright_adc = 'Mốc sáng phải là số nguyên ADC từ 0 đến 1023.';
  } else if (calibration.enabled && calibration.bright_adc - calibration.dark_adc < 10) {
    errors.light_bright_adc = 'Khi hiệu chuẩn, mốc sáng phải cao hơn mốc tối ít nhất 10 ADC.';
  }
  const mq2 = settings.mq2;
  if (!Number.isInteger(mq2.baseline_adc) || mq2.baseline_adc < 0 || mq2.baseline_adc > 1023) {
    errors.mq2_baseline_adc = 'Mốc nền MQ-2 phải từ 0 đến 1023 ADC.';
  }
  if (!Number.isInteger(mq2.span_adc) || mq2.span_adc < 1 || mq2.span_adc > 1023) {
    errors.mq2_span_adc = 'Khoảng MQ-2 phải từ 1 đến 1023 ADC.';
  } else if (mq2.baseline_adc + mq2.span_adc > 1023) {
    errors.mq2_span_adc = 'Mốc nền cộng khoảng MQ-2 không được vượt ADC 1023.';
  }
  if (!Number.isInteger(mq2.threshold_pct) || mq2.threshold_pct < 0 || mq2.threshold_pct > 100) {
    errors.mq2_threshold_pct = 'Ngưỡng tương đối MQ-2 phải là số nguyên từ 0 đến 100%.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
