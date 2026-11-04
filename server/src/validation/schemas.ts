import { z } from 'zod';

const uint32 = z.number().int().min(0).max(0xffff_ffff);
const uint16 = z.number().int().min(0).max(0xffff);
const identifier = z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const reasonCode = z.string().min(1).max(64).regex(/^[a-z0-9_]+$/);
const isoUtc = z.string().datetime({ offset: true });
const dataQuality = z.enum(['valid', 'stale', 'invalid']);
const severity = z.enum(['info', 'notice', 'warning', 'critical']);
const alertType = z.enum(['safety', 'security', 'system']);
const alertLifecycle = z.enum(['normal', 'sounding', 'muted', 'awaiting_ack']);

export const configSettingsSchema = z
  .object({
    light_on_pct: z.number().int().min(0).max(80),
    light_off_pct: z.number().int().min(20).max(100),
    control_mode: z.enum(['auto', 'manual']),
    room_profile: z.enum(['home', 'away', 'night']),
    light_calibration: z
      .object({
        dark_adc: z.number().int().min(0).max(1023),
        bright_adc: z.number().int().min(0).max(1023),
        enabled: z.boolean()
      })
      .strict(),
    mq2: z
      .object({
        baseline_adc: z.number().int().min(0).max(1023),
        span_adc: z.number().int().min(1).max(1023),
        threshold_pct: z.number().int().min(0).max(100),
        calibration_enabled: z.boolean()
      })
      .strict(),
    door_zone: z
      .object({
        threshold_mm: z.number().int().min(20).max(4000),
        confirm_samples: z.number().int().min(1).max(10),
        calibration_enabled: z.boolean()
      })
      .strict()
  })
  .strict()
  .superRefine((settings, context) => {
    if (settings.light_off_pct < settings.light_on_pct + 5) {
      context.addIssue({
        code: 'custom',
        path: ['light_off_pct'],
        message: 'Ngưỡng tắt đèn phải cao hơn ngưỡng bật ít nhất 5 điểm phần trăm.'
      });
    }
    if (
      settings.light_calibration.enabled &&
      settings.light_calibration.bright_adc - settings.light_calibration.dark_adc < 10
    ) {
      context.addIssue({
        code: 'custom',
        path: ['light_calibration'],
        message: 'Khi hiệu chuẩn LDR được bật, mốc sáng phải cao hơn mốc tối ít nhất 10 ADC.'
      });
    }
    if (settings.mq2.baseline_adc + settings.mq2.span_adc > 1023) {
      context.addIssue({
        code: 'custom',
        path: ['mq2'],
        message: 'Mốc nền cộng khoảng MQ-2 không được vượt ADC 1023.'
      });
    }
  });

export const desiredConfigRequestSchema = z
  .object({
    base_config_version: uint32,
    settings: configSettingsSchema
  })
  .strict();

const commandOptionsSchema = z
  .object({
    user_confirmed: z.boolean().optional(),
    force_manual: z.boolean().optional(),
    transition_home: z.boolean().optional()
  })
  .strict();

export const commandInputSchema = z
  .object({
    operation: z.enum(['set_device', 'set_control_mode', 'set_room_profile', 'set_lock', 'alert_action']),
    target: z.enum(['lamp', 'fan', 'system', 'lock', 'alert']),
    value: z.enum([
      'on',
      'off',
      'auto',
      'manual',
      'home',
      'away',
      'night',
      'locked',
      'unlocked',
      'mute',
      'acknowledge'
    ]),
    expected_state_version: uint32.optional(),
    options: commandOptionsSchema.optional()
  })
  .strict()
  .superRefine((command, context) => {
    const valid =
      (command.operation === 'set_device' &&
        (command.target === 'lamp' || command.target === 'fan') &&
        (command.value === 'on' || command.value === 'off')) ||
      (command.operation === 'set_control_mode' &&
        command.target === 'system' &&
        (command.value === 'auto' || command.value === 'manual')) ||
      (command.operation === 'set_room_profile' &&
        command.target === 'system' &&
        (command.value === 'home' || command.value === 'away' || command.value === 'night')) ||
      (command.operation === 'set_lock' &&
        command.target === 'lock' &&
        (command.value === 'locked' || command.value === 'unlocked')) ||
      (command.operation === 'alert_action' &&
        command.target === 'alert' &&
        (command.value === 'mute' || command.value === 'acknowledge'));
    if (!valid) {
      context.addIssue({
        code: 'custom',
        path: ['operation'],
        message: 'Tổ hợp operation/target/value không hợp lệ.'
      });
    }
  });

export const loginRequestSchema = z
  .object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(256)
  })
  .strict();

export const historyQuerySchema = z
  .object({
    metric: z.literal('light'),
    from: isoUtc,
    to: isoUtc
  })
  .strict()
  .superRefine((query, context) => {
    const from = Date.parse(query.from);
    const to = Date.parse(query.to);
    if (from >= to) {
      context.addIssue({ code: 'custom', path: ['to'], message: '`to` phải sau `from`.' });
    }
    if (to - from > 31 * 24 * 60 * 60 * 1000) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'Khoảng truy vấn tối đa là 31 ngày.' });
    }
  });

export const logsQuerySchema = z
  .object({
    type: z.enum(['command', 'config', 'sensor', 'security', 'safety', 'system', 'auth']).optional(),
    severity: severity.optional(),
    from: isoUtc.optional(),
    to: isoUtc.optional(),
    cursor: z.string().max(128).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .strict();

function envelope<T extends z.ZodType>(dataSchema: T) {
  return z
    .object({
      schema: z.literal('smartroom.mqtt'),
      schema_version: z.literal(1),
      message_id: identifier,
      device_id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,31}$/),
      sent_at: isoUtc.nullable(),
      time_quality: z.enum(['synced', 'unsynced']),
      esp_boot_id: uint32,
      uno_boot_id: uint32,
      link_session_id: uint32,
      data: dataSchema
    })
    .strict()
    .superRefine((value, context) => {
      if (value.time_quality === 'synced' && value.sent_at === null) {
        context.addIssue({ code: 'custom', path: ['sent_at'], message: 'Thời gian đồng bộ không được null.' });
      }
      if (value.time_quality === 'unsynced' && value.sent_at !== null) {
        context.addIssue({ code: 'custom', path: ['sent_at'], message: 'Thời gian chưa đồng bộ phải là null.' });
      }
    });
}

const availabilityData = z
  .object({
    status: z.enum(['offline', 'syncing', 'online', 'degraded']),
    reason: reasonCode,
    protocol_version: z.string().max(16),
    config_version: uint32,
    state_version: uint32,
    uptime_ms: uint32
  })
  .strict();

const availabilityLwt = z
  .object({
    schema: z.literal('smartroom.mqtt'),
    schema_version: z.literal(1),
    device_id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,31}$/),
    data: z
      .object({ status: z.literal('offline'), reason: z.literal('unexpected_disconnect') })
      .strict()
  })
  .strict();

const telemetryData = z
  .object({
    uptime_ms: uint32,
    sample_counter: uint32,
    light: z
      .object({
        adc: z.number().int().min(0).max(1023).nullable(),
        relative_pct: z.number().int().min(0).max(100).nullable(),
        quality: dataQuality
      })
      .strict(),
    door_zone: z
      .object({
        distance_mm: z.number().int().min(20).max(65_535).nullable(),
        state: z.enum(['clear', 'object_detected', 'unknown']),
        quality: dataQuality
      })
      .strict(),
    mq2: z
      .object({
        adc: z.number().int().min(0).max(1023).nullable(),
        relative_pct: z.number().int().min(0).max(100).nullable(),
        state: z.enum(['warming', 'normal', 'alert', 'sensor_fault']),
        quality: dataQuality,
        heat_status: z.enum(['warming', 'ready'])
      })
      .strict(),
    flame: z
      .object({
        raw: z.union([z.literal(0), z.literal(1)]).nullable(),
        state: z.enum(['normal', 'alert', 'sensor_fault']),
        quality: dataQuality
      })
      .strict()
  })
  .strict();

const stateData = z
  .object({
    state_version: uint32,
    config_version: uint32,
    room_profile: z.enum(['home', 'away', 'night']),
    control_mode: z.enum(['auto', 'manual']),
    outputs: z
      .object({
        lamp: z
          .object({
            on: z.boolean(),
            source: z.enum(['power_protection', 'safety', 'security', 'room_profile', 'manual', 'auto']),
            actuator_mode: z.enum(['hardware_real', 'simulated', 'unknown'])
          })
          .strict(),
        fan: z
          .object({
            on: z.boolean(),
            source: z.enum(['power_protection', 'safety', 'security', 'room_profile', 'manual', 'auto']),
            actuator_mode: z.enum(['simulated', 'unknown'])
          })
          .strict(),
        lock: z
          .object({
            command: z.enum(['locked', 'unlocked', 'unknown']),
            actuator_mode: z.enum(['simulated', 'unknown']),
            mechanical_verified: z.boolean()
          })
          .strict()
      })
      .strict(),
    security: z.object({ door_zone_armed: z.boolean() }).strict(),
    alert: z.object({ lifecycle: alertLifecycle, active_count: z.number().int().min(0).max(255) }).strict(),
    alarm_output: z
      .object({ led: z.boolean(), buzzer: z.boolean(), buzzer_available: z.boolean() })
      .strict(),
    health: z
      .object({
        connection: z.enum(['online', 'syncing', 'degraded', 'offline']),
        sensor_fault: z.boolean(),
        queue_depth: z.number().int().min(0).max(100)
      })
      .strict()
  })
  .strict();

const reportedConfigData = z
  .object({
    config_version: uint32,
    apply_result: z.enum(['applied', 'rejected', 'unchanged', 'pending']),
    reason_code: reasonCode,
    reported_at_uptime_ms: uint32,
    settings: z.union([configSettingsSchema, z.object({}).strict()])
  })
  .strict();

const commandResultData = z
  .object({
    command_id: identifier,
    result: z.enum(['applied', 'rejected', 'duplicate_ok', 'expired', 'unknown']),
    reason_code: reasonCode,
    config_version: uint32,
    state_version: uint32,
    actual_state: z.record(z.string(), z.unknown()),
    uno_ack: z.boolean(),
    replayed: z.boolean()
  })
  .strict();

const eventData = z
  .object({
    event_id: z.string().min(1).max(128),
    event_type: reasonCode,
    severity,
    source: z.string().min(1).max(32),
    occurred_at: isoUtc.nullable(),
    uptime_ms: uint32,
    state_version: uint32,
    details: z.record(z.string(), z.unknown()),
    replayed: z.boolean()
  })
  .strict();

const alertEventData = z
  .object({
    alert_id: z.string().min(1).max(128),
    operation: z.enum(['add', 'clear', 'retrigger', 'snapshot']),
    alert_type: alertType,
    severity,
    source: z.string().min(1).max(32),
    lifecycle: alertLifecycle,
    active: z.boolean(),
    cause_id: uint32,
    reason_code: reasonCode,
    detail: z.record(z.string(), z.unknown()),
    degraded_sensor: z.boolean().optional(),
    replayed: z.boolean()
  })
  .strict();

const alertSnapshotData = z
  .object({
    causes: z.array(
      z
        .object({
          cause_id: uint32,
          alert_type: alertType,
          severity,
          source: z.string().min(1).max(32),
          reason_code: reasonCode,
          detail_value: uint32
        })
        .strict()
    ),
    active_count: z.number().int().min(0).max(255),
    maximum_severity: severity,
    lifecycle: alertLifecycle,
    alarm_led: z.boolean(),
    buzzer: z.boolean(),
    buzzer_available: z.boolean()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.active_count !== value.causes.length) {
      context.addIssue({ code: 'custom', path: ['active_count'], message: 'active_count không khớp số nguyên nhân.' });
    }
  });

const syncStatusData = z
  .object({
    sync_id: identifier,
    result: z.enum(['started', 'uno_snapshot', 'config_reconciled', 'queue_replayed', 'completed', 'failed']),
    config_version: uint32,
    state_version: uint32,
    queue_remaining: z.number().int().min(0).max(100),
    reason_code: reasonCode
  })
  .strict();

const diagnosticsData = z
  .object({
    uptime_ms: uint32,
    health_flags: uint16,
    uart_crc_errors: uint16,
    uart_frame_errors: uint16,
    uno_queue_overflows: uint16,
    last_error: reasonCode,
    local_detail: uint16,
    offline_queue_depth: z.number().int().min(0).max(100),
    offline_queue_dropped: uint32,
    mqtt_inbound_dropped: uint32
  })
  .strict();

export const inboundMqttSchemas = Object.freeze({
  availability: z.union([envelope(availabilityData), availabilityLwt]),
  'telemetry/sensors': envelope(telemetryData),
  'state/reported': envelope(stateData),
  'config/reported': envelope(reportedConfigData),
  'commands/result': envelope(commandResultData),
  events: envelope(eventData),
  'alerts/events': envelope(alertEventData),
  'alerts/reported': envelope(alertSnapshotData),
  'sync/status': envelope(syncStatusData),
  diagnostics: envelope(diagnosticsData)
});

export type InboundMqttSuffix = keyof typeof inboundMqttSchemas;

export type MqttPayloadParseResult =
  | { success: true; value: unknown }
  | { success: false; reason: string; issues?: Array<{ path: PropertyKey[]; message: string }> };

export function parseMqttPayload(suffix: InboundMqttSuffix, payload: Uint8Array): MqttPayloadParseResult {
  if (payload.byteLength === 0 || payload.byteLength > 2048) {
    return { success: false, reason: 'payload_size_invalid' };
  }

  let value: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    value = JSON.parse(text) as unknown;
  } catch {
    return { success: false, reason: 'invalid_utf8_or_json' };
  }

  const result = inboundMqttSchemas[suffix].safeParse(value);
  if (!result.success) {
    return {
      success: false,
      reason: 'invalid_schema',
      issues: result.error.issues.slice(0, 8).map((issue) => ({ path: issue.path, message: issue.message }))
    };
  }
  return { success: true, value: result.data };
}

export function parseInboundTopic(
  root: string,
  topic: string
): { deviceId: string; suffix: InboundMqttSuffix } | null {
  const prefix = `${root}/`;
  if (!topic.startsWith(prefix)) return null;
  const remainder = topic.slice(prefix.length);
  const separator = remainder.indexOf('/');
  if (separator < 1) return null;
  const deviceId = remainder.slice(0, separator);
  const suffix = remainder.slice(separator + 1);
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(deviceId)) return null;
  if (!Object.hasOwn(inboundMqttSchemas, suffix)) return null;
  return { deviceId, suffix: suffix as InboundMqttSuffix };
}
