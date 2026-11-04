import type { ServerConfig } from '../../src/config/env.js';
import type { ReportedStateData, TelemetryData } from '../../src/types/domain.js';

export function testConfig(passwordHash: string): ServerConfig {
  return {
    nodeEnv: 'test',
    httpHost: '127.0.0.1',
    httpPort: 3000,
    webDevPort: 5173,
    webOrigin: 'http://localhost:5173',
    deviceId: 'room-01',
    dbFile: ':memory:',
    retentionDays: 30,
    retentionIntervalSeconds: 3600,
    retentionBatchSize: 500,
    mqttEnabled: true,
    mqttUrl: 'mqtt://localhost:1883',
    mqttDeviceRoot: 'smartroom/v1/devices',
    mqttClientId: 'smartroom-backend-test',
    mqttUsername: 'smartroom-backend',
    mqttPassword: 'test-only-password',
    ownerUsername: 'chu-phong',
    ownerPasswordHash: passwordHash,
    sessionSecret: 'test-session-secret-at-least-thirty-two-characters',
    sessionTtlSeconds: 3600,
    sessionCookieName: 'smartroom_session',
    cookieSecure: false,
    sseReplaySize: 32,
    logLevel: 'silent'
  };
}

export function envelope<T>(messageId: string, data: T, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'smartroom.mqtt',
    schema_version: 1,
    message_id: messageId,
    device_id: 'room-01',
    sent_at: null,
    time_quality: 'unsynced',
    esp_boot_id: 3,
    uno_boot_id: 17,
    link_session_id: 91,
    data,
    ...overrides
  };
}

export function onlineAvailability(messageId = 'availability-1'): Record<string, unknown> {
  return envelope(messageId, {
    status: 'online',
    reason: 'link_ready',
    protocol_version: '1.0',
    config_version: 1,
    state_version: 44,
    uptime_ms: 8123
  });
}

export function reportedState(version = 44, configVersion = 1, messageId = `state-${version}`): Record<string, unknown> {
  const data: ReportedStateData = {
    state_version: version,
    config_version: configVersion,
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
  };
  return envelope(messageId, data);
}

export function telemetry(messageId = 'telemetry-1', lightPct = 37): Record<string, unknown> {
  const data: TelemetryData = {
    uptime_ms: 120_340,
    sample_counter: 883,
    light: { adc: 412, relative_pct: lightPct, quality: 'valid' },
    door_zone: { distance_mm: 248, state: 'object_detected', quality: 'valid' },
    mq2: { adc: 516, relative_pct: 42, state: 'warming', quality: 'valid', heat_status: 'warming' },
    flame: { raw: 0, state: 'normal', quality: 'valid' }
  };
  return envelope(messageId, data);
}
