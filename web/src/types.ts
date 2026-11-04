export type ConnectionState = 'online' | 'syncing' | 'degraded' | 'offline';
export type ControlMode = 'auto' | 'manual';
export type RoomProfile = 'home' | 'away' | 'night';
export type DataQuality = 'valid' | 'stale' | 'invalid';
export type SafetyState = 'warming' | 'normal' | 'alert' | 'sensor_fault';
export type AlertLifecycle = 'normal' | 'sounding' | 'muted' | 'awaiting_ack';
export type AlertType = 'safety' | 'security' | 'system';
export type Severity = 'info' | 'notice' | 'warning' | 'critical';
export type CommandStatus = 'pending' | 'applied' | 'rejected' | 'duplicate_ok' | 'expired' | 'unknown';
export type DeliveryStatus = 'pending_delivery' | 'published' | 'applied' | 'rejected';

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
  mq2: { baseline_adc: number; span_adc: number; threshold_pct: number; calibration_enabled: boolean };
  door_zone: { threshold_mm: number; confirm_samples: number; calibration_enabled: boolean };
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
  data: {
    config_version: number;
    apply_result: 'applied' | 'rejected' | 'unchanged' | 'pending';
    reason_code: string;
    reported_at_uptime_ms: number;
    settings: ConfigSettings | Record<string, never>;
  };
  messageId: string;
  receivedAt: string;
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

export type CommandOperation =
  | 'set_device'
  | 'set_control_mode'
  | 'set_room_profile'
  | 'set_lock'
  | 'alert_action';

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
  expected_state_version?: number;
  options?: { user_confirmed?: boolean; force_manual?: boolean; transition_home?: boolean };
}

export interface CommandRecord {
  commandId: string;
  deviceId: string;
  requestedBy: string;
  request: {
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
    options: { user_confirmed: boolean; force_manual: boolean; transition_home: boolean };
  };
  status: CommandStatus;
  reasonCode: string;
  actualState: Record<string, unknown> | null;
  createdAt: string;
  publishedAt: string | null;
  resultAt: string | null;
}

export interface HistoryPoint {
  bucketStartUtc: string;
  value: number | null;
  minimum: number | null;
  maximum: number | null;
  sampleCount: number;
  coverageQuality: 'complete' | 'partial' | 'invalid';
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

export type SessionResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      user: { id: string; username: string; role: 'owner' };
      csrf_token: string;
      expires_at: string;
    };

export type AuthenticatedSession = Extract<SessionResponse, { authenticated: true }>;

export interface OverviewResponse {
  server_time: string;
  stale_after_seconds: number;
  overview: DeviceOverview;
}

export interface ConfigResponse {
  desired: DesiredConfigRecord;
  reported: ReportedConfigRecord | null;
  limits: Record<string, unknown>;
}

export interface HistoryResponse {
  metric: 'light';
  from: string;
  to: string;
  gap_policy: 'missing_buckets_omitted';
  storage_mode: DeviceOverview['storageMode'];
  points: HistoryPoint[];
}

export interface LogsResponse {
  items: SystemLogRecord[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error_code: string;
  message: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

export type RealtimeEventName =
  | 'telemetry.updated'
  | 'state.updated'
  | 'availability.updated'
  | 'config.updated'
  | 'command.updated'
  | 'alert.updated'
  | 'event.created';

export type AppRoute =
  | '/dang-nhap'
  | '/tong-quan'
  | '/dieu-khien'
  | '/trang-thai-phong'
  | '/cai-dat-tu-dong'
  | '/an-ninh-an-toan'
  | '/lich-su'
  | '/nhat-ky';

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  command: CommandInput;
}

export interface AppState {
  route: AppRoute;
  returnRoute: AppRoute;
  session: AuthenticatedSession | null;
  initializing: boolean;
  pageLoading: boolean;
  serverReachable: boolean;
  realtime: 'closed' | 'connecting' | 'open' | 'degraded';
  overview: OverviewResponse | null;
  config: ConfigResponse | null;
  configDraft: ConfigSettings | null;
  configDirty: boolean;
  pendingCommand: CommandRecord | null;
  confirmation: ConfirmationRequest | null;
  historyRange: 1 | 7 | 30;
  history: HistoryResponse | null;
  historyLoading: boolean;
  logs: LogsResponse | null;
  logsLoading: boolean;
  logFilters: {
    type: '' | SystemLogRecord['type'];
    severity: '' | Severity;
    from: string;
    to: string;
    source: string;
  };
  moreMenuOpen: boolean;
  notice: { kind: 'success' | 'warning' | 'error' | 'info'; message: string } | null;
  notificationPermission: NotificationPermission | 'unsupported';
}
