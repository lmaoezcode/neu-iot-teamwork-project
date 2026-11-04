export type ConnectionState = 'online' | 'syncing' | 'degraded' | 'offline';
export type ControlMode = 'auto' | 'manual';
export type RoomProfile = 'home' | 'away' | 'night';
export type DataQuality = 'valid' | 'stale' | 'invalid';
export type SafetyState = 'warming' | 'normal' | 'alert' | 'sensor_fault';
export type AlertLifecycle = 'normal' | 'sounding' | 'muted' | 'awaiting_ack';
export type AlertType = 'safety' | 'security' | 'system';
export type Severity = 'info' | 'notice' | 'warning' | 'critical';
export type CommandStatus = 'pending' | 'applied' | 'rejected' | 'duplicate_ok' | 'expired' | 'unknown';
export type ConfigApplyResult = 'applied' | 'rejected' | 'unchanged' | 'pending';
export type DeliveryStatus = 'pending_delivery' | 'published' | 'applied' | 'rejected';

export interface MqttEnvelope<T> {
  schema: 'smartroom.mqtt';
  schema_version: 1;
  message_id: string;
  device_id: string;
  sent_at: string | null;
  time_quality: 'synced' | 'unsynced';
  esp_boot_id: number;
  uno_boot_id: number;
  link_session_id: number;
  data: T;
}

export interface AvailabilityData {
  status: ConnectionState;
  reason: string;
  protocol_version?: string;
  config_version?: number;
  state_version?: number;
  uptime_ms?: number;
}

export interface TelemetryData {
  uptime_ms: number;
  sample_counter: number;
  light: { adc: number | null; relative_pct: number | null; quality: DataQuality };
  door_zone: {
    distance_mm: number | null;
    state: 'clear' | 'object_detected' | 'unknown';
    quality: DataQuality;
  };
  mq2: {
    adc: number | null;
    relative_pct: number | null;
    state: SafetyState;
    quality: DataQuality;
    heat_status: 'warming' | 'ready';
  };
  flame: { raw: 0 | 1 | null; state: Exclude<SafetyState, 'warming'>; quality: DataQuality };
}

export interface ReportedStateData {
  state_version: number;
  config_version: number;
  room_profile: RoomProfile;
  control_mode: ControlMode;
  outputs: {
    lamp: { on: boolean; source: string; actuator_mode: 'hardware_real' | 'simulated' | 'unknown' };
    fan: { on: boolean; source: string; actuator_mode: 'simulated' | 'unknown' };
    lock: {
      command: 'locked' | 'unlocked' | 'unknown';
      actuator_mode: 'simulated' | 'unknown';
      mechanical_verified: boolean;
    };
  };
  security: { door_zone_armed: boolean };
  alert: { lifecycle: AlertLifecycle; active_count: number };
  alarm_output: { led: boolean; buzzer: boolean; buzzer_available: boolean };
  health: { connection: ConnectionState; sensor_fault: boolean; queue_depth: number };
}

export interface ConfigSettings {
  light_on_pct: number;
  light_off_pct: number;
  control_mode: ControlMode;
  room_profile: RoomProfile;
  light_calibration: { dark_adc: number; bright_adc: number; enabled: boolean };
  mq2: {
    baseline_adc: number;
    span_adc: number;
    threshold_pct: number;
    calibration_enabled: boolean;
  };
  door_zone: { threshold_mm: number; confirm_samples: number; calibration_enabled: boolean };
}

export interface ReportedConfigData {
  config_version: number;
  apply_result: ConfigApplyResult;
  reason_code: string;
  reported_at_uptime_ms: number;
  settings: ConfigSettings | Record<string, never>;
}

export type CommandOperation =
  | 'set_device'
  | 'set_control_mode'
  | 'set_room_profile'
  | 'set_lock'
  | 'alert_action';

export interface CommandOptions {
  user_confirmed?: boolean | undefined;
  force_manual?: boolean | undefined;
  transition_home?: boolean | undefined;
}

export interface CommandInput {
  operation: CommandOperation;
  target: 'lamp' | 'fan' | 'system' | 'lock' | 'alert';
  value:
    | 'on'
    | 'off'
    | 'auto'
    | 'manual'
    | 'home'
    | 'away'
    | 'night'
    | 'locked'
    | 'unlocked'
    | 'mute'
    | 'acknowledge';
  expected_state_version?: number | undefined;
  options?: CommandOptions | undefined;
}

export interface CommandWireData {
  command_id: string;
  operation: CommandOperation;
  target: CommandInput['target'];
  value: CommandInput['value'];
  issued_at: string;
  expires_at: string;
  ttl_ms: number;
  expected_state_version: number;
  base_config_version: number;
  new_config_version: number;
  options: Required<CommandOptions>;
}

export interface PendingConfigMutation {
  version: number;
  settings: ConfigSettings;
}

export interface CommandRecord {
  commandId: string;
  deviceId: string;
  requestedBy: string;
  request: CommandWireData;
  status: CommandStatus;
  reasonCode: string;
  actualState: Record<string, unknown> | null;
  createdAt: string;
  publishedAt: string | null;
  resultAt: string | null;
  pendingConfigMutation: PendingConfigMutation | null;
}

export interface CommandResultData {
  command_id: string;
  result: Exclude<CommandStatus, 'pending'>;
  reason_code: string;
  config_version: number;
  state_version: number;
  actual_state: Record<string, unknown>;
  uno_ack: boolean;
  replayed: boolean;
}

export interface DeviceEventData {
  event_id: string;
  event_type: string;
  severity: Severity;
  source: string;
  occurred_at: string | null;
  uptime_ms: number;
  state_version: number;
  details: Record<string, unknown>;
  replayed: boolean;
}

export interface AlertEventData {
  alert_id: string;
  operation: 'add' | 'clear' | 'retrigger' | 'snapshot';
  alert_type: AlertType;
  severity: Severity;
  source: string;
  lifecycle: AlertLifecycle;
  active: boolean;
  cause_id: number;
  reason_code: string;
  detail: Record<string, unknown>;
  degraded_sensor?: boolean;
  replayed: boolean;
}

export interface AlertSnapshotData {
  causes: Array<{
    cause_id: number;
    alert_type: AlertType;
    severity: Severity;
    source: string;
    reason_code: string;
    detail_value: number;
  }>;
  active_count: number;
  maximum_severity: Severity;
  lifecycle: AlertLifecycle;
  alarm_led: boolean;
  buzzer: boolean;
  buzzer_available: boolean;
}

export interface AlertRecord {
  alertId: string;
  deviceId: string;
  causeId: number;
  type: AlertType;
  severity: Severity;
  source: string;
  lifecycle: AlertLifecycle;
  active: boolean;
  reasonCode: string;
  detail: Record<string, unknown>;
  updatedAt: string;
}

export interface DesiredConfigRecord {
  deviceId: string;
  version: number;
  settings: ConfigSettings;
  messageId: string;
  deliveryStatus: DeliveryStatus;
  reasonCode: string;
  createdAt: string;
  createdBy: string;
}

export interface ReportedConfigRecord {
  deviceId: string;
  data: ReportedConfigData;
  messageId: string;
  receivedAt: string;
  source: SourceMetadata;
}

export interface SourceMetadata {
  sentAt: string | null;
  timeQuality: 'synced' | 'unsynced';
  espBootId: number;
  unoBootId: number;
  linkSessionId: number;
}

export interface ReceivedValue<T> {
  data: T;
  messageId: string | null;
  receivedAt: string;
  retained: boolean;
  source: SourceMetadata;
}

export interface DiagnosticsData {
  uptime_ms: number;
  health_flags: number;
  uart_crc_errors: number;
  uart_frame_errors: number;
  uno_queue_overflows: number;
  last_error: string;
  local_detail: number;
  offline_queue_depth: number;
  offline_queue_dropped: number;
  mqtt_inbound_dropped: number;
}

export interface SystemLogRecord {
  id: string;
  deviceId: string | null;
  type: 'command' | 'config' | 'sensor' | 'security' | 'safety' | 'system' | 'auth';
  severity: Severity;
  message: string;
  source: string;
  referenceId: string | null;
  createdAt: string;
  details: Record<string, unknown>;
}

export interface HistoryPoint {
  bucketStartUtc: string;
  value: number | null;
  minimum: number | null;
  maximum: number | null;
  sampleCount: number;
  coverageQuality: 'complete' | 'partial' | 'invalid';
}

export interface DeviceOverview {
  deviceId: string;
  availability: ReceivedValue<AvailabilityData> | null;
  telemetry: ReceivedValue<TelemetryData> | null;
  state: ReceivedValue<ReportedStateData> | null;
  diagnostics: ReceivedValue<DiagnosticsData> | null;
  desiredConfig: DesiredConfigRecord;
  reportedConfig: ReportedConfigRecord | null;
  alerts: AlertRecord[];
  activeAlerts: AlertRecord[];
  storageMode: 'volatile_stage14' | 'sqlite';
}

export const initialConfigSettings: ConfigSettings = Object.freeze({
  light_on_pct: 30,
  light_off_pct: 50,
  control_mode: 'auto',
  room_profile: 'home',
  light_calibration: { dark_adc: 0, bright_adc: 1023, enabled: false },
  mq2: { baseline_adc: 0, span_adc: 1, threshold_pct: 80, calibration_enabled: false },
  door_zone: { threshold_mm: 500, confirm_samples: 3, calibration_enabled: false }
});
