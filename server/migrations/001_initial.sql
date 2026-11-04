CREATE TABLE devices (
  device_id TEXT PRIMARY KEY CHECK (length(device_id) BETWEEN 3 AND 32),
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  firmware_uno TEXT,
  firmware_esp32 TEXT,
  last_availability TEXT NOT NULL DEFAULT 'offline'
    CHECK (last_availability IN ('online', 'syncing', 'degraded', 'offline')),
  last_availability_reason TEXT NOT NULL DEFAULT 'not_seen',
  last_esp_boot_id INTEGER,
  last_uno_boot_id INTEGER,
  last_link_session_id INTEGER,
  desired_config_version INTEGER NOT NULL DEFAULT 0 CHECK (desired_config_version >= 0),
  reported_config_version INTEGER CHECK (reported_config_version IS NULL OR reported_config_version >= 0),
  last_state_version INTEGER CHECK (last_state_version IS NULL OR last_state_version >= 0),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE device_snapshots (
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  snapshot_kind TEXT NOT NULL CHECK (snapshot_kind IN ('availability', 'telemetry', 'state', 'diagnostics')),
  message_id TEXT,
  received_at TEXT NOT NULL,
  retained INTEGER NOT NULL CHECK (retained IN (0, 1)),
  sent_at TEXT,
  time_quality TEXT NOT NULL CHECK (time_quality IN ('synced', 'unsynced')),
  esp_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (esp_boot_id >= 0),
  uno_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (uno_boot_id >= 0),
  link_session_id INTEGER NOT NULL DEFAULT 0 CHECK (link_session_id >= 0),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY (device_id, snapshot_kind)
) STRICT;

CREATE TABLE sensor_minute_samples (
  sample_id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  bucket_start_utc TEXT NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  valid_light_count INTEGER NOT NULL DEFAULT 0 CHECK (valid_light_count >= 0),
  invalid_light_count INTEGER NOT NULL DEFAULT 0 CHECK (invalid_light_count >= 0),
  coverage_quality TEXT NOT NULL DEFAULT 'partial' CHECK (coverage_quality IN ('complete', 'partial')),
  light_pct_sum REAL NOT NULL DEFAULT 0,
  light_pct_min REAL,
  light_pct_max REAL,
  light_adc INTEGER CHECK (light_adc IS NULL OR light_adc BETWEEN 0 AND 1023),
  light_pct REAL CHECK (light_pct IS NULL OR light_pct BETWEEN 0 AND 100),
  light_quality TEXT NOT NULL CHECK (light_quality IN ('valid', 'stale', 'invalid')),
  distance_mm INTEGER CHECK (distance_mm IS NULL OR distance_mm >= 0),
  door_zone_state TEXT NOT NULL CHECK (door_zone_state IN ('clear', 'object_detected', 'unknown')),
  door_zone_quality TEXT NOT NULL CHECK (door_zone_quality IN ('valid', 'stale', 'invalid')),
  mq2_adc INTEGER CHECK (mq2_adc IS NULL OR mq2_adc BETWEEN 0 AND 1023),
  mq2_relative_pct REAL CHECK (mq2_relative_pct IS NULL OR mq2_relative_pct BETWEEN 0 AND 100),
  mq2_state TEXT NOT NULL CHECK (mq2_state IN ('warming', 'normal', 'alert', 'sensor_fault')),
  mq2_quality TEXT NOT NULL CHECK (mq2_quality IN ('valid', 'stale', 'invalid')),
  mq2_heat_status TEXT NOT NULL CHECK (mq2_heat_status IN ('warming', 'ready')),
  flame_raw INTEGER CHECK (flame_raw IS NULL OR flame_raw IN (0, 1)),
  flame_state TEXT NOT NULL CHECK (flame_state IN ('normal', 'alert', 'sensor_fault')),
  flame_quality TEXT NOT NULL CHECK (flame_quality IN ('valid', 'stale', 'invalid')),
  time_quality TEXT NOT NULL CHECK (time_quality IN ('synced', 'unsynced')),
  source_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (source_boot_id >= 0),
  source_sample_counter INTEGER NOT NULL CHECK (source_sample_counter >= 0),
  first_received_at TEXT NOT NULL,
  last_received_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (device_id, bucket_start_utc)
) STRICT;

CREATE INDEX idx_sensor_minute_device_time
  ON sensor_minute_samples(device_id, bucket_start_utc DESC);

CREATE TABLE state_reports (
  state_report_id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE,
  state_version INTEGER NOT NULL CHECK (state_version >= 0),
  config_version INTEGER NOT NULL CHECK (config_version >= 0),
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  time_quality TEXT NOT NULL CHECK (time_quality IN ('synced', 'unsynced')),
  esp_boot_id INTEGER NOT NULL CHECK (esp_boot_id >= 0),
  uno_boot_id INTEGER NOT NULL CHECK (uno_boot_id >= 0),
  link_session_id INTEGER NOT NULL CHECK (link_session_id >= 0),
  room_profile TEXT NOT NULL CHECK (room_profile IN ('home', 'away', 'night')),
  control_mode TEXT NOT NULL CHECK (control_mode IN ('auto', 'manual')),
  lamp_on INTEGER NOT NULL CHECK (lamp_on IN (0, 1)),
  fan_on INTEGER NOT NULL CHECK (fan_on IN (0, 1)),
  lock_command TEXT NOT NULL CHECK (lock_command IN ('locked', 'unlocked', 'unknown')),
  lamp_source TEXT NOT NULL,
  fan_source TEXT NOT NULL,
  lamp_actuator_mode TEXT NOT NULL CHECK (lamp_actuator_mode IN ('hardware_real', 'simulated', 'unknown')),
  fan_actuator_mode TEXT NOT NULL CHECK (fan_actuator_mode IN ('simulated', 'unknown')),
  lock_actuator_mode TEXT NOT NULL CHECK (lock_actuator_mode IN ('simulated', 'unknown')),
  lock_mechanical_verified INTEGER NOT NULL CHECK (lock_mechanical_verified IN (0, 1)),
  door_zone_armed INTEGER NOT NULL CHECK (door_zone_armed IN (0, 1)),
  alert_lifecycle TEXT NOT NULL CHECK (alert_lifecycle IN ('normal', 'sounding', 'muted', 'awaiting_ack')),
  active_alert_count INTEGER NOT NULL CHECK (active_alert_count >= 0),
  alarm_led_on INTEGER NOT NULL CHECK (alarm_led_on IN (0, 1)),
  buzzer_on INTEGER NOT NULL CHECK (buzzer_on IN (0, 1)),
  buzzer_available INTEGER NOT NULL CHECK (buzzer_available IN (0, 1)),
  connection_state TEXT NOT NULL CHECK (connection_state IN ('online', 'syncing', 'degraded', 'offline')),
  health_json TEXT NOT NULL CHECK (json_valid(health_json)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  UNIQUE (device_id, state_version)
) STRICT;

CREATE INDEX idx_state_reports_device_time ON state_reports(device_id, received_at DESC);

CREATE TABLE availability_events (
  availability_event_id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('online', 'syncing', 'degraded', 'offline')),
  reason_code TEXT NOT NULL,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  time_quality TEXT NOT NULL CHECK (time_quality IN ('synced', 'unsynced')),
  esp_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (esp_boot_id >= 0),
  uno_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (uno_boot_id >= 0),
  link_session_id INTEGER NOT NULL DEFAULT 0 CHECK (link_session_id >= 0),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
) STRICT;

CREATE UNIQUE INDEX idx_availability_message_unique
  ON availability_events(device_id, message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_availability_device_time ON availability_events(device_id, received_at DESC);

CREATE TABLE configuration_revisions (
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  config_version INTEGER NOT NULL CHECK (config_version >= 0),
  revision_role TEXT NOT NULL CHECK (revision_role IN ('desired', 'reported')),
  source TEXT NOT NULL,
  apply_result TEXT NOT NULL CHECK (apply_result IN ('pending', 'applied', 'rejected', 'unchanged')),
  delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('pending_delivery', 'published', 'applied', 'rejected')),
  message_id TEXT NOT NULL,
  light_on_pct INTEGER NOT NULL CHECK (light_on_pct BETWEEN 0 AND 80),
  light_off_pct INTEGER NOT NULL CHECK (light_off_pct BETWEEN 20 AND 100 AND light_off_pct - light_on_pct >= 5),
  control_mode TEXT NOT NULL CHECK (control_mode IN ('auto', 'manual')),
  room_profile TEXT NOT NULL CHECK (room_profile IN ('home', 'away', 'night')),
  light_dark_adc INTEGER NOT NULL CHECK (light_dark_adc BETWEEN 0 AND 1023),
  light_bright_adc INTEGER NOT NULL CHECK (light_bright_adc BETWEEN 0 AND 1023),
  light_calibration_enabled INTEGER NOT NULL CHECK (light_calibration_enabled IN (0, 1)),
  mq2_baseline_adc INTEGER NOT NULL CHECK (mq2_baseline_adc BETWEEN 0 AND 1023),
  mq2_span_adc INTEGER NOT NULL CHECK (mq2_span_adc BETWEEN 1 AND 1023),
  mq2_threshold_pct INTEGER NOT NULL CHECK (mq2_threshold_pct BETWEEN 0 AND 100),
  mq2_calibration_enabled INTEGER NOT NULL CHECK (mq2_calibration_enabled IN (0, 1)),
  door_threshold_mm INTEGER NOT NULL CHECK (door_threshold_mm BETWEEN 20 AND 4000),
  door_confirm_samples INTEGER NOT NULL CHECK (door_confirm_samples BETWEEN 1 AND 10),
  door_calibration_enabled INTEGER NOT NULL CHECK (door_calibration_enabled IN (0, 1)),
  created_by_user_id TEXT REFERENCES users(user_id),
  created_at TEXT NOT NULL,
  applied_at TEXT,
  rejected_at TEXT,
  reason_code TEXT NOT NULL,
  reported_at_uptime_ms INTEGER CHECK (reported_at_uptime_ms IS NULL OR reported_at_uptime_ms >= 0),
  sent_at TEXT,
  time_quality TEXT NOT NULL DEFAULT 'synced' CHECK (time_quality IN ('synced', 'unsynced')),
  esp_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (esp_boot_id >= 0),
  uno_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (uno_boot_id >= 0),
  link_session_id INTEGER NOT NULL DEFAULT 0 CHECK (link_session_id >= 0),
  settings_json TEXT NOT NULL CHECK (json_valid(settings_json)),
  PRIMARY KEY (device_id, config_version, revision_role)
) STRICT;

CREATE INDEX idx_config_role_version
  ON configuration_revisions(device_id, revision_role, config_version DESC);

CREATE TABLE commands (
  command_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  requested_by_user_id TEXT REFERENCES users(user_id),
  operation TEXT NOT NULL,
  target TEXT NOT NULL,
  value TEXT NOT NULL,
  options_json TEXT NOT NULL CHECK (json_valid(options_json)),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ttl_ms INTEGER NOT NULL CHECK (ttl_ms BETWEEN 1 AND 30000),
  expected_state_version INTEGER NOT NULL CHECK (expected_state_version >= 0),
  base_config_version INTEGER NOT NULL CHECK (base_config_version >= 0),
  new_config_version INTEGER NOT NULL CHECK (new_config_version >= 0),
  mqtt_message_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'rejected', 'duplicate_ok', 'expired', 'unknown')),
  reason_code TEXT NOT NULL,
  uno_ack INTEGER CHECK (uno_ack IS NULL OR uno_ack IN (0, 1)),
  result_message_id TEXT,
  actual_state_json TEXT CHECK (actual_state_json IS NULL OR json_valid(actual_state_json)),
  pending_config_json TEXT CHECK (pending_config_json IS NULL OR json_valid(pending_config_json)),
  created_at TEXT NOT NULL,
  published_at TEXT,
  result_at TEXT,
  updated_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT
) STRICT;

CREATE INDEX idx_commands_device_time ON commands(device_id, created_at DESC);
CREATE INDEX idx_commands_device_status ON commands(device_id, status);
CREATE INDEX idx_commands_expires ON commands(expires_at);

CREATE TABLE system_events (
  event_id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(device_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
  source TEXT NOT NULL,
  reference_id TEXT,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  time_quality TEXT NOT NULL DEFAULT 'synced' CHECK (time_quality IN ('synced', 'unsynced')),
  uptime_ms INTEGER,
  state_version INTEGER,
  config_version INTEGER,
  replayed INTEGER NOT NULL DEFAULT 0 CHECK (replayed IN (0, 1)),
  message TEXT NOT NULL,
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_system_events_device_time ON system_events(device_id, received_at DESC);
CREATE INDEX idx_system_events_type_time ON system_events(event_type, received_at DESC);

CREATE TABLE alert_causes (
  alert_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  source_uno_boot_id INTEGER NOT NULL DEFAULT 0 CHECK (source_uno_boot_id >= 0),
  cause_id INTEGER NOT NULL CHECK (cause_id >= 0),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('safety', 'security', 'system')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
  source TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('normal', 'sounding', 'muted', 'awaiting_ack')),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  reason_code TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  cleared_at TEXT,
  acknowledged_at TEXT,
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  UNIQUE (device_id, source_uno_boot_id, cause_id)
) STRICT;

CREATE INDEX idx_alert_causes_active ON alert_causes(device_id, active);
CREATE INDEX idx_alert_causes_time ON alert_causes(device_id, last_seen_at DESC);

CREATE TABLE alert_transitions (
  transition_id INTEGER PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES alert_causes(alert_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('add', 'clear', 'retrigger', 'snapshot')),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('normal', 'sounding', 'muted', 'awaiting_ack')),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  message_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  replayed INTEGER NOT NULL CHECK (replayed IN (0, 1)),
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  UNIQUE (alert_id, message_id)
) STRICT;

CREATE INDEX idx_alert_transitions_device_time ON alert_transitions(device_id, received_at DESC);

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_algorithm TEXT NOT NULL CHECK (password_algorithm = 'scrypt'),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
) STRICT;

CREATE TABLE web_sessions (
  session_digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_web_sessions_expiry ON web_sessions(expires_at);

CREATE TABLE audit_log (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  outcome TEXT NOT NULL,
  reason_code TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL,
  details_json TEXT NOT NULL CHECK (json_valid(details_json))
) STRICT;

CREATE INDEX idx_audit_log_time ON audit_log(created_at DESC);

CREATE TABLE mqtt_inbox (
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  topic TEXT,
  message_kind TEXT,
  first_received_at TEXT NOT NULL,
  last_received_at TEXT NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  processing_result TEXT NOT NULL DEFAULT 'accepted',
  expires_at TEXT NOT NULL,
  PRIMARY KEY (device_id, message_id)
) STRICT;

CREATE INDEX idx_mqtt_inbox_expiry ON mqtt_inbox(expires_at);

CREATE TABLE mqtt_outbox (
  outbox_id INTEGER PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  qos INTEGER NOT NULL CHECK (qos IN (0, 1)),
  retain INTEGER NOT NULL CHECK (retain IN (0, 1)),
  kind TEXT NOT NULL CHECK (kind IN ('config', 'command', 'sync')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'expired')),
  available_at TEXT NOT NULL,
  expires_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  published_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_mqtt_outbox_status_available ON mqtt_outbox(status, available_at, outbox_id);

CREATE TABLE sync_runs (
  sync_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  result TEXT NOT NULL DEFAULT 'pending',
  desired_config_version INTEGER,
  reported_config_version INTEGER,
  state_version INTEGER,
  queue_remaining INTEGER,
  error TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json))
) STRICT;

CREATE INDEX idx_sync_runs_device_time ON sync_runs(device_id, started_at DESC);
