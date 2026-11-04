import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  AlertEventData,
  AlertRecord,
  AlertSnapshotData,
  AvailabilityData,
  CommandRecord,
  CommandResultData,
  ConfigSettings,
  DesiredConfigRecord,
  DeviceOverview,
  DiagnosticsData,
  HistoryPoint,
  ReceivedValue,
  ReportedConfigRecord,
  ReportedStateData,
  SystemLogRecord,
  TelemetryData
} from '../types/domain.js';
import { initialConfigSettings } from '../types/domain.js';
import type {
  DataRepository,
  LogPage,
  LogQuery,
  NewOutboxMessage,
  OutboxRecord,
  RepositoryBootstrap,
  RetentionResult,
  StoredWebSession,
  SyncRunRecord,
  UserCredential
} from './repository.js';
import { openDatabase, readDatabaseDiagnostics, type DatabaseDiagnostics } from './sqlite-database.js';

interface SqliteRepositoryOptions {
  filename: string;
  retentionDays: number;
  now?: () => Date;
}

interface SnapshotRow {
  message_id: string | null;
  received_at: string;
  retained: number;
  sent_at: string | null;
  time_quality: 'synced' | 'unsynced';
  esp_boot_id: number;
  uno_boot_id: number;
  link_session_id: number;
  payload_json: string;
}

interface DesiredRow {
  device_id: string;
  config_version: number;
  message_id: string;
  delivery_status: DesiredConfigRecord['deliveryStatus'];
  reason_code: string;
  settings_json: string;
  created_at: string;
  created_by_user_id: string | null;
}

interface ReportedRow {
  device_id: string;
  config_version: number;
  apply_result: ReportedConfigRecord['data']['apply_result'];
  reason_code: string;
  reported_at_uptime_ms: number | null;
  settings_json: string;
  message_id: string;
  created_at: string;
  sent_at: string | null;
  time_quality: 'synced' | 'unsynced';
  esp_boot_id: number;
  uno_boot_id: number;
  link_session_id: number;
}

interface CommandRow {
  command_id: string;
  device_id: string;
  requested_by_user_id: string | null;
  operation: CommandRecord['request']['operation'];
  target: CommandRecord['request']['target'];
  value: CommandRecord['request']['value'];
  options_json: string;
  issued_at: string;
  expires_at: string;
  ttl_ms: number;
  expected_state_version: number;
  base_config_version: number;
  new_config_version: number;
  status: CommandRecord['status'];
  reason_code: string;
  actual_state_json: string | null;
  pending_config_json: string | null;
  created_at: string;
  published_at: string | null;
  result_at: string | null;
}

interface AlertRow {
  alert_id: string;
  device_id: string;
  cause_id: number;
  alert_type: AlertRecord['type'];
  severity: AlertRecord['severity'];
  source: string;
  lifecycle: AlertRecord['lifecycle'];
  active: number;
  reason_code: string;
  details_json: string;
  last_seen_at: string;
}

const json = (value: unknown): string => JSON.stringify(value);
const parseJson = <T>(value: string): T => JSON.parse(value) as T;
const flag = (value: boolean): number => (value ? 1 : 0);

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}

function bucketStart(value: ReceivedValue<TelemetryData>): string {
  const preferred = value.source.timeQuality === 'synced' && value.source.sentAt
    ? Date.parse(value.source.sentAt)
    : Date.parse(value.receivedAt);
  return new Date(Math.floor(preferred / 60_000) * 60_000).toISOString();
}

export class SQLiteRepository implements DataRepository {
  readonly storageMode = 'sqlite' as const;
  private readonly database: Database.Database;
  private readonly now: () => Date;
  private initialized = false;
  private closed = false;

  constructor(private readonly options: SqliteRepositoryOptions) {
    this.now = options.now ?? (() => new Date());
    this.database = openDatabase(options.filename, this.now);
  }

  async initialize(deviceId: string, bootstrap: RepositoryBootstrap): Promise<void> {
    if (this.initialized) return;
    const now = this.now().toISOString();
    this.immediate(() => {
      const owners = this.database
        .prepare('SELECT user_id, username FROM users WHERE active = 1')
        .all() as Array<{ user_id: string; username: string }>;
      if (owners.length > 0 && !owners.some((owner) => owner.username === bootstrap.ownerUsername)) {
        throw new Error('Tên chủ phòng trong môi trường không khớp tài khoản đã lưu trong cơ sở dữ liệu.');
      }
      this.database.prepare(`
        INSERT INTO users(user_id, username, password_hash, password_algorithm, active, created_at, updated_at)
        VALUES ('owner', @username, @passwordHash, 'scrypt', 1, @now, @now)
        ON CONFLICT(username) DO NOTHING
      `).run({ username: bootstrap.ownerUsername, passwordHash: bootstrap.ownerPasswordHash, now });
      this.database.prepare(`
        INSERT INTO devices(device_id, display_name, active, last_availability, last_availability_reason,
                            desired_config_version, created_at, updated_at)
        VALUES (@deviceId, 'Phòng thông minh', 1, 'offline', 'not_seen', 0, @now, @now)
        ON CONFLICT(device_id) DO NOTHING
      `).run({ deviceId, now });

      const pointer = this.database
        .prepare('SELECT desired_config_version AS version FROM devices WHERE device_id = ?')
        .get(deviceId) as { version: number };
      if (pointer.version === 0) {
        const record: DesiredConfigRecord = {
          deviceId,
          version: 1,
          settings: structuredClone(initialConfigSettings),
          messageId: `cfg-bootstrap-${randomUUID()}`,
          deliveryStatus: 'pending_delivery',
          reasonCode: 'database_bootstrap',
          createdAt: now,
          createdBy: 'owner'
        };
        this.insertDesired(record);
      }
    });
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }

  diagnostics(): DatabaseDiagnostics {
    return readDatabaseDiagnostics(this.database);
  }

  async getOverview(deviceId: string): Promise<DeviceOverview> {
    const alerts = await this.listAlerts(deviceId);
    return {
      deviceId,
      availability: this.readSnapshot<AvailabilityData>(deviceId, 'availability'),
      telemetry: this.readSnapshot<TelemetryData>(deviceId, 'telemetry'),
      state: this.readSnapshot<ReportedStateData>(deviceId, 'state'),
      diagnostics: this.readSnapshot<DiagnosticsData>(deviceId, 'diagnostics'),
      desiredConfig: await this.getDesiredConfig(deviceId),
      reportedConfig: await this.getReportedConfig(deviceId),
      alerts,
      activeAlerts: alerts.filter((item) => item.active),
      storageMode: 'sqlite'
    };
  }

  async rememberMessage(deviceId: string, messageId: string): Promise<boolean> {
    const now = this.now();
    const result = this.database.prepare(`
      INSERT OR IGNORE INTO mqtt_inbox(
        device_id, message_id, first_received_at, last_received_at, duplicate_count,
        processing_result, expires_at
      ) VALUES (?, ?, ?, ?, 0, 'accepted', ?)
    `).run(deviceId, messageId, now.toISOString(), now.toISOString(), addDays(now, this.options.retentionDays));
    if (result.changes === 1) return true;
    this.database.prepare(`
      UPDATE mqtt_inbox
      SET last_received_at = ?, duplicate_count = duplicate_count + 1
      WHERE device_id = ? AND message_id = ?
    `).run(now.toISOString(), deviceId, messageId);
    return false;
  }

  async saveAvailability(deviceId: string, value: ReceivedValue<AvailabilityData>): Promise<void> {
    const prior = this.readSnapshot<AvailabilityData>(deviceId, 'availability');
    this.immediate(() => {
      this.writeSnapshot(deviceId, 'availability', value);
      this.database.prepare(`
        UPDATE devices SET
          last_availability = @status,
          last_availability_reason = @reason,
          last_esp_boot_id = @espBootId,
          last_uno_boot_id = @unoBootId,
          last_link_session_id = @linkSessionId,
          last_seen_at = @receivedAt,
          updated_at = @receivedAt
        WHERE device_id = @deviceId
      `).run({
        deviceId,
        status: value.data.status,
        reason: value.data.reason,
        espBootId: value.source.espBootId,
        unoBootId: value.source.unoBootId,
        linkSessionId: value.source.linkSessionId,
        receivedAt: value.receivedAt
      });
      if (!prior || prior.data.status !== value.data.status || prior.data.reason !== value.data.reason) {
        this.database.prepare(`
          INSERT OR IGNORE INTO availability_events(
            device_id, message_id, status, reason_code, occurred_at, received_at, time_quality,
            esp_boot_id, uno_boot_id, link_session_id, payload_json
          ) VALUES (@deviceId, @messageId, @status, @reason, @sentAt, @receivedAt, @timeQuality,
                    @espBootId, @unoBootId, @linkSessionId, @payload)
        `).run({
          deviceId,
          messageId: value.messageId,
          status: value.data.status,
          reason: value.data.reason,
          sentAt: value.source.sentAt,
          receivedAt: value.receivedAt,
          timeQuality: value.source.timeQuality,
          espBootId: value.source.espBootId,
          unoBootId: value.source.unoBootId,
          linkSessionId: value.source.linkSessionId,
          payload: json(value.data)
        });
      }
    });
  }

  async saveTelemetry(deviceId: string, value: ReceivedValue<TelemetryData>): Promise<void> {
    const lightValid = value.data.light.quality === 'valid' && value.data.light.relative_pct !== null;
    const lightPct = lightValid ? value.data.light.relative_pct : null;
    const timestamp = bucketStart(value);
    this.immediate(() => {
      this.writeSnapshot(deviceId, 'telemetry', value);
      this.database.prepare(`
        INSERT INTO sensor_minute_samples(
          device_id, bucket_start_utc, sample_count, valid_light_count, invalid_light_count,
          coverage_quality, light_pct_sum, light_pct_min, light_pct_max,
          light_adc, light_pct, light_quality, distance_mm, door_zone_state, door_zone_quality,
          mq2_adc, mq2_relative_pct, mq2_state, mq2_quality, mq2_heat_status,
          flame_raw, flame_state, flame_quality, time_quality, source_boot_id,
          source_sample_counter, first_received_at, last_received_at, created_at, updated_at
        ) VALUES (
          @deviceId, @bucket, 1, @validLight, @invalidLight, 'partial', @lightSum, @lightMin, @lightMax,
          @lightAdc, @lightPct, @lightQuality, @distanceMm, @doorState, @doorQuality,
          @mq2Adc, @mq2Pct, @mq2State, @mq2Quality, @mq2Heat,
          @flameRaw, @flameState, @flameQuality, @timeQuality, @sourceBootId,
          @sampleCounter, @receivedAt, @receivedAt, @receivedAt, @receivedAt
        )
        ON CONFLICT(device_id, bucket_start_utc) DO UPDATE SET
          sample_count = sample_count + 1,
          valid_light_count = valid_light_count + excluded.valid_light_count,
          invalid_light_count = invalid_light_count + excluded.invalid_light_count,
          coverage_quality = CASE
            WHEN valid_light_count + excluded.valid_light_count >= 20
             AND invalid_light_count + excluded.invalid_light_count = 0 THEN 'complete'
            ELSE 'partial'
          END,
          light_pct_sum = light_pct_sum + excluded.light_pct_sum,
          light_pct_min = CASE
            WHEN excluded.light_pct_min IS NULL THEN light_pct_min
            WHEN light_pct_min IS NULL THEN excluded.light_pct_min
            ELSE min(light_pct_min, excluded.light_pct_min)
          END,
          light_pct_max = CASE
            WHEN excluded.light_pct_max IS NULL THEN light_pct_max
            WHEN light_pct_max IS NULL THEN excluded.light_pct_max
            ELSE max(light_pct_max, excluded.light_pct_max)
          END,
          light_adc = excluded.light_adc,
          light_pct = excluded.light_pct,
          light_quality = excluded.light_quality,
          distance_mm = excluded.distance_mm,
          door_zone_state = excluded.door_zone_state,
          door_zone_quality = excluded.door_zone_quality,
          mq2_adc = excluded.mq2_adc,
          mq2_relative_pct = excluded.mq2_relative_pct,
          mq2_state = excluded.mq2_state,
          mq2_quality = excluded.mq2_quality,
          mq2_heat_status = excluded.mq2_heat_status,
          flame_raw = excluded.flame_raw,
          flame_state = excluded.flame_state,
          flame_quality = excluded.flame_quality,
          time_quality = excluded.time_quality,
          source_boot_id = excluded.source_boot_id,
          source_sample_counter = excluded.source_sample_counter,
          last_received_at = excluded.last_received_at,
          updated_at = excluded.updated_at
      `).run({
        deviceId,
        bucket: timestamp,
        validLight: lightValid ? 1 : 0,
        invalidLight: lightValid ? 0 : 1,
        lightSum: lightPct ?? 0,
        lightMin: lightPct,
        lightMax: lightPct,
        lightAdc: value.data.light.adc,
        lightPct: value.data.light.relative_pct,
        lightQuality: value.data.light.quality,
        distanceMm: value.data.door_zone.distance_mm,
        doorState: value.data.door_zone.state,
        doorQuality: value.data.door_zone.quality,
        mq2Adc: value.data.mq2.adc,
        mq2Pct: value.data.mq2.relative_pct,
        mq2State: value.data.mq2.state,
        mq2Quality: value.data.mq2.quality,
        mq2Heat: value.data.mq2.heat_status,
        flameRaw: value.data.flame.raw,
        flameState: value.data.flame.state,
        flameQuality: value.data.flame.quality,
        timeQuality: value.source.timeQuality,
        sourceBootId: value.source.unoBootId,
        sampleCounter: value.data.sample_counter,
        receivedAt: value.receivedAt
      });
      this.database.prepare(`
        UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE device_id = ?
      `).run(value.receivedAt, value.receivedAt, deviceId);
    });
  }

  async saveReportedState(deviceId: string, value: ReceivedValue<ReportedStateData>): Promise<boolean> {
    const current = this.database
      .prepare('SELECT last_state_version AS version, (SELECT link_session_id FROM state_reports s WHERE s.device_id = devices.device_id ORDER BY s.rowid DESC LIMIT 1) AS session FROM devices WHERE device_id = ?')
      .get(deviceId) as { version: number | null };
    if (current.version !== null && (value.data.state_version === current.version || (value.data.state_version < current.version && (current as { session?: number }).session === value.source.linkSessionId))) return false;
    this.immediate(() => {
      this.database.prepare(`
        INSERT OR REPLACE INTO state_reports(
          device_id, message_id, state_version, config_version, occurred_at, received_at, time_quality,
          esp_boot_id, uno_boot_id, link_session_id, room_profile, control_mode,
          lamp_on, fan_on, lock_command, lamp_source, fan_source,
          lamp_actuator_mode, fan_actuator_mode, lock_actuator_mode, lock_mechanical_verified,
          door_zone_armed, alert_lifecycle, active_alert_count, alarm_led_on, buzzer_on,
          buzzer_available, connection_state, health_json, payload_json
        ) VALUES (
          @deviceId, @messageId, @stateVersion, @configVersion, @sentAt, @receivedAt, @timeQuality,
          @espBootId, @unoBootId, @linkSessionId, @roomProfile, @controlMode,
          @lampOn, @fanOn, @lockCommand, @lampSource, @fanSource,
          @lampMode, @fanMode, @lockMode, @mechanicalVerified,
          @doorArmed, @alertLifecycle, @activeCount, @alarmLed, @buzzer, @buzzerAvailable,
          @connectionState, @healthJson, @payloadJson
        )
      `).run({
        deviceId,
        messageId: value.messageId,
        stateVersion: value.data.state_version,
        configVersion: value.data.config_version,
        sentAt: value.source.sentAt,
        receivedAt: value.receivedAt,
        timeQuality: value.source.timeQuality,
        espBootId: value.source.espBootId,
        unoBootId: value.source.unoBootId,
        linkSessionId: value.source.linkSessionId,
        roomProfile: value.data.room_profile,
        controlMode: value.data.control_mode,
        lampOn: flag(value.data.outputs.lamp.on),
        fanOn: flag(value.data.outputs.fan.on),
        lockCommand: value.data.outputs.lock.command,
        lampSource: value.data.outputs.lamp.source,
        fanSource: value.data.outputs.fan.source,
        lampMode: value.data.outputs.lamp.actuator_mode,
        fanMode: value.data.outputs.fan.actuator_mode,
        lockMode: value.data.outputs.lock.actuator_mode,
        mechanicalVerified: flag(value.data.outputs.lock.mechanical_verified),
        doorArmed: flag(value.data.security.door_zone_armed),
        alertLifecycle: value.data.alert.lifecycle,
        activeCount: value.data.alert.active_count,
        alarmLed: flag(value.data.alarm_output.led),
        buzzer: flag(value.data.alarm_output.buzzer),
        buzzerAvailable: flag(value.data.alarm_output.buzzer_available),
        connectionState: value.data.health.connection,
        healthJson: json(value.data.health),
        payloadJson: json(value.data)
      });
      this.writeSnapshot(deviceId, 'state', value);
      this.database.prepare(`
        UPDATE devices SET last_state_version = ?, last_seen_at = ?, updated_at = ? WHERE device_id = ?
      `).run(value.data.state_version, value.receivedAt, value.receivedAt, deviceId);
    });
    return true;
  }

  async saveDiagnostics(deviceId: string, value: ReceivedValue<DiagnosticsData>): Promise<void> {
    this.writeSnapshot(deviceId, 'diagnostics', value);
  }

  async getDesiredConfig(deviceId: string): Promise<DesiredConfigRecord> {
    const row = this.database.prepare(`
      SELECT c.device_id, c.config_version, c.message_id, c.delivery_status, c.reason_code,
             c.settings_json, c.created_at, c.created_by_user_id
      FROM devices d
      JOIN configuration_revisions c
        ON c.device_id = d.device_id
       AND c.config_version = d.desired_config_version
       AND c.revision_role = 'desired'
      WHERE d.device_id = ?
    `).get(deviceId) as DesiredRow | undefined;
    if (!row) throw new Error(`Thiếu cấu hình desired của ${deviceId}.`);
    return this.desiredFromRow(row);
  }

  async saveDesiredConfig(record: DesiredConfigRecord, outbox?: NewOutboxMessage): Promise<void> {
    this.immediate(() => {
      const current = this.database
        .prepare('SELECT desired_config_version AS version FROM devices WHERE device_id = ?')
        .get(record.deviceId) as { version: number };
      if (record.version <= current.version) throw new Error('Phiên bản cấu hình mong muốn phải tăng đơn điệu.');
      this.insertDesired(record);
      if (outbox) this.upsertOutbox(outbox);
      this.insertAudit(record.createdBy, 'config_desired_created', 'configuration', String(record.version), 'accepted', record.reasonCode, {
        device_id: record.deviceId,
        config_version: record.version
      });
    });
  }

  async updateDesiredDelivery(
    deviceId: string,
    version: number,
    status: DesiredConfigRecord['deliveryStatus'],
    reasonCode: string
  ): Promise<void> {
    this.database.prepare(`
      UPDATE configuration_revisions SET
        delivery_status = ?, reason_code = ?,
        applied_at = CASE WHEN ? = 'applied' THEN coalesce(applied_at, ?) ELSE applied_at END,
        rejected_at = CASE WHEN ? = 'rejected' THEN coalesce(rejected_at, ?) ELSE rejected_at END
      WHERE device_id = ? AND config_version = ? AND revision_role = 'desired'
    `).run(status, reasonCode, status, this.now().toISOString(), status, this.now().toISOString(), deviceId, version);
  }

  async getReportedConfig(deviceId: string): Promise<ReportedConfigRecord | null> {
    const row = this.database.prepare(`
      SELECT device_id, config_version, apply_result, reason_code, reported_at_uptime_ms,
             settings_json, message_id, created_at, sent_at, time_quality,
             esp_boot_id, uno_boot_id, link_session_id
      FROM configuration_revisions
      WHERE device_id = ? AND revision_role = 'reported'
      ORDER BY config_version DESC LIMIT 1
    `).get(deviceId) as ReportedRow | undefined;
    if (!row) return null;
    return {
      deviceId: row.device_id,
      data: {
        config_version: row.config_version,
        apply_result: row.apply_result,
        reason_code: row.reason_code,
        reported_at_uptime_ms: row.reported_at_uptime_ms ?? 0,
        settings: parseJson<ConfigSettings>(row.settings_json)
      },
      messageId: row.message_id,
      receivedAt: row.created_at,
      source: {
        sentAt: row.sent_at,
        timeQuality: row.time_quality,
        espBootId: row.esp_boot_id,
        unoBootId: row.uno_boot_id,
        linkSessionId: row.link_session_id
      }
    };
  }

  async saveReportedConfig(record: ReportedConfigRecord): Promise<boolean> {
    const current = this.database
      .prepare("SELECT max(config_version) AS version FROM configuration_revisions WHERE device_id = ? AND revision_role = 'reported'")
      .get(record.deviceId) as { version: number | null };
    if (current.version !== null && record.data.config_version < current.version) return false;
    const settings = Object.keys(record.data.settings).length === 0
      ? (await this.getDesiredConfig(record.deviceId)).settings
      : record.data.settings as ConfigSettings;
    this.immediate(() => {
      const parameters = this.configParameters(settings);
      this.database.prepare(`
        INSERT INTO configuration_revisions(
          device_id, config_version, revision_role, source, apply_result, delivery_status,
          message_id, light_on_pct, light_off_pct, control_mode, room_profile,
          light_dark_adc, light_bright_adc, light_calibration_enabled,
          mq2_baseline_adc, mq2_span_adc, mq2_threshold_pct, mq2_calibration_enabled,
          door_threshold_mm, door_confirm_samples, door_calibration_enabled,
          created_by_user_id, created_at, applied_at, rejected_at, reason_code,
          reported_at_uptime_ms, sent_at, time_quality, esp_boot_id, uno_boot_id,
          link_session_id, settings_json
        ) VALUES (
          @deviceId, @version, 'reported', 'device', @applyResult, NULL,
          @messageId, @lightOn, @lightOff, @controlMode, @roomProfile,
          @lightDark, @lightBright, @lightEnabled,
          @mq2Baseline, @mq2Span, @mq2Threshold, @mq2Enabled,
          @doorThreshold, @doorSamples, @doorEnabled,
          NULL, @createdAt, @appliedAt, @rejectedAt, @reasonCode,
          @reportedAt, @sentAt, @timeQuality, @espBootId, @unoBootId,
          @linkSessionId, @settingsJson
        )
        ON CONFLICT(device_id, config_version, revision_role) DO UPDATE SET
          source = excluded.source,
          apply_result = excluded.apply_result,
          message_id = excluded.message_id,
          reason_code = excluded.reason_code,
          reported_at_uptime_ms = excluded.reported_at_uptime_ms,
          sent_at = excluded.sent_at,
          time_quality = excluded.time_quality,
          esp_boot_id = excluded.esp_boot_id,
          uno_boot_id = excluded.uno_boot_id,
          link_session_id = excluded.link_session_id,
          settings_json = excluded.settings_json,
          applied_at = excluded.applied_at,
          rejected_at = excluded.rejected_at
      `).run({
        deviceId: record.deviceId,
        version: record.data.config_version,
        applyResult: record.data.apply_result,
        messageId: record.messageId,
        createdAt: record.receivedAt,
        appliedAt: ['applied', 'unchanged'].includes(record.data.apply_result) ? record.receivedAt : null,
        rejectedAt: record.data.apply_result === 'rejected' ? record.receivedAt : null,
        reasonCode: record.data.reason_code,
        reportedAt: record.data.reported_at_uptime_ms,
        sentAt: record.source.sentAt,
        timeQuality: record.source.timeQuality,
        espBootId: record.source.espBootId,
        unoBootId: record.source.unoBootId,
        linkSessionId: record.source.linkSessionId,
        settingsJson: json(settings),
        ...parameters
      });
      this.database.prepare(`
        UPDATE devices SET reported_config_version = ?, updated_at = ? WHERE device_id = ?
      `).run(record.data.config_version, record.receivedAt, record.deviceId);
    });
    return true;
  }

  async hasPendingCommand(deviceId: string): Promise<boolean> {
    const row = this.database
      .prepare("SELECT 1 AS found FROM commands WHERE device_id = ? AND status = 'pending' LIMIT 1")
      .get(deviceId) as { found: number } | undefined;
    return row !== undefined;
  }

  async saveCommand(record: CommandRecord, outbox?: NewOutboxMessage): Promise<void> {
    this.immediate(() => {
      this.database.prepare(`
        INSERT INTO commands(
          command_id, device_id, requested_by_user_id, operation, target, value, options_json,
          issued_at, expires_at, ttl_ms, expected_state_version, base_config_version,
          new_config_version, mqtt_message_id, status, reason_code, uno_ack,
          actual_state_json, pending_config_json, created_at, published_at, result_at,
          updated_at, attempt_count
        ) VALUES (
          @commandId, @deviceId, @requestedBy, @operation, @target, @value, @options,
          @issuedAt, @expiresAt, @ttlMs, @expectedStateVersion, @baseConfigVersion,
          @newConfigVersion, @commandId, @status, @reasonCode, NULL,
          NULL, @pendingConfig, @createdAt, @publishedAt, @resultAt,
          @createdAt, 0
        )
      `).run({
        commandId: record.commandId,
        deviceId: record.deviceId,
        requestedBy: record.requestedBy,
        operation: record.request.operation,
        target: record.request.target,
        value: record.request.value,
        options: json(record.request.options),
        issuedAt: record.request.issued_at,
        expiresAt: record.request.expires_at,
        ttlMs: record.request.ttl_ms,
        expectedStateVersion: record.request.expected_state_version,
        baseConfigVersion: record.request.base_config_version,
        newConfigVersion: record.request.new_config_version,
        status: record.status,
        reasonCode: record.reasonCode,
        pendingConfig: record.pendingConfigMutation ? json(record.pendingConfigMutation) : null,
        createdAt: record.createdAt,
        publishedAt: record.publishedAt,
        resultAt: record.resultAt
      });
      if (outbox) this.upsertOutbox(outbox);
      this.insertAudit(record.requestedBy, 'command_requested', 'command', record.commandId, 'accepted', record.reasonCode, {
        operation: record.request.operation,
        target: record.request.target,
        value: record.request.value
      });
    });
  }

  async markCommandPublished(commandId: string, publishedAt: string): Promise<void> {
    this.database.prepare(`
      UPDATE commands SET published_at = ?, updated_at = ?, attempt_count = attempt_count + 1
      WHERE command_id = ? AND status = 'pending'
    `).run(publishedAt, publishedAt, commandId);
  }

  async getCommand(commandId: string): Promise<CommandRecord | null> {
    const row = this.database.prepare('SELECT * FROM commands WHERE command_id = ?').get(commandId) as CommandRow | undefined;
    return row ? this.commandFromRow(row) : null;
  }

  async listPendingCommands(deviceId: string): Promise<CommandRecord[]> {
    const rows = this.database
      .prepare("SELECT * FROM commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at")
      .all(deviceId) as CommandRow[];
    return rows.map((row) => this.commandFromRow(row));
  }

  async completeCommand(
    commandId: string,
    result: CommandResultData,
    resultAt: string,
    resultMessageId: string | null
  ): Promise<CommandRecord | null> {
    const current = await this.getCommand(commandId);
    if (!current) return null;
    if (current.status !== 'pending' && !(current.status === 'unknown' && result.result !== 'unknown')) return current;
    this.immediate(() => {
      this.database.prepare(`
        UPDATE commands SET
          status = @status, reason_code = @reason, uno_ack = @unoAck,
          result_message_id = @resultMessageId, actual_state_json = @actual,
          result_at = @resultAt, updated_at = @resultAt
        WHERE command_id = @commandId
      `).run({
        status: result.result,
        reason: result.reason_code,
        unoAck: flag(result.uno_ack),
        resultMessageId,
        actual: json(result.actual_state),
        resultAt,
        commandId
      });
      this.insertAudit(current.requestedBy, 'command_completed', 'command', commandId, result.result, result.reason_code, {
        uno_ack: result.uno_ack,
        state_version: result.state_version,
        config_version: result.config_version
      });
    });
    return this.getCommand(commandId);
  }

  async saveAlertEvent(
    deviceId: string,
    data: AlertEventData,
    receivedAt: string,
    messageId: string,
    sourceUnoBootId: number
  ): Promise<AlertRecord> {
    this.immediate(() => {
      const active = data.active && data.operation !== 'clear';
      this.database.prepare(`
        INSERT INTO alert_causes(
          alert_id, device_id, source_uno_boot_id, cause_id, alert_type, severity,
          source, lifecycle, active, reason_code, first_seen_at, last_seen_at,
          cleared_at, details_json
        ) VALUES (
          @alertId, @deviceId, @bootId, @causeId, @type, @severity,
          @source, @lifecycle, @active, @reason, @receivedAt, @receivedAt,
          @clearedAt, @details
        )
        ON CONFLICT(alert_id) DO UPDATE SET
          severity = excluded.severity,
          source = excluded.source,
          lifecycle = excluded.lifecycle,
          active = excluded.active,
          reason_code = excluded.reason_code,
          last_seen_at = excluded.last_seen_at,
          cleared_at = excluded.cleared_at,
          details_json = excluded.details_json
      `).run({
        alertId: data.alert_id,
        deviceId,
        bootId: sourceUnoBootId,
        causeId: data.cause_id,
        type: data.alert_type,
        severity: data.severity,
        source: data.source,
        lifecycle: data.lifecycle,
        active: flag(active),
        reason: data.reason_code,
        receivedAt,
        clearedAt: active ? null : receivedAt,
        details: json(data.detail)
      });
      this.database.prepare(`
        INSERT OR IGNORE INTO alert_transitions(
          alert_id, device_id, operation, lifecycle, active, message_id, received_at, replayed, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.alert_id,
        deviceId,
        data.operation,
        data.lifecycle,
        flag(active),
        messageId,
        receivedAt,
        flag(data.replayed),
        json(data.detail)
      );
    });
    return (await this.getAlert(deviceId, data.alert_id))!;
  }

  async replaceAlertSnapshot(
    deviceId: string,
    data: AlertSnapshotData,
    receivedAt: string,
    messageId: string,
    sourceUnoBootId: number
  ): Promise<void> {
    this.immediate(() => {
      const activeCauseIds = data.causes.map((cause) => cause.cause_id);
      if (activeCauseIds.length === 0) {
        this.database.prepare(`
          UPDATE alert_causes SET active = 0, lifecycle = 'awaiting_ack', cleared_at = coalesce(cleared_at, ?), last_seen_at = ?
          WHERE device_id = ? AND active = 1
        `).run(receivedAt, receivedAt, deviceId);
      } else {
        const placeholders = activeCauseIds.map(() => '?').join(', ');
        this.database.prepare(`
          UPDATE alert_causes SET active = 0, lifecycle = 'awaiting_ack', cleared_at = coalesce(cleared_at, ?), last_seen_at = ?
          WHERE device_id = ? AND active = 1 AND cause_id NOT IN (${placeholders})
        `).run(receivedAt, receivedAt, deviceId, ...activeCauseIds);
      }
      for (const cause of data.causes) {
        const existing = this.database.prepare(`
          SELECT alert_id FROM alert_causes
          WHERE device_id = ? AND source_uno_boot_id = ? AND cause_id = ?
        `).get(deviceId, sourceUnoBootId, cause.cause_id) as { alert_id: string } | undefined;
        const alertId = existing?.alert_id ?? `${deviceId}-snapshot-${sourceUnoBootId}-${cause.cause_id}`;
        this.database.prepare(`
          INSERT INTO alert_causes(
            alert_id, device_id, source_uno_boot_id, cause_id, alert_type, severity,
            source, lifecycle, active, reason_code, first_seen_at, last_seen_at, details_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
          ON CONFLICT(alert_id) DO UPDATE SET
            alert_type = excluded.alert_type, severity = excluded.severity, source = excluded.source,
            lifecycle = excluded.lifecycle, active = 1, reason_code = excluded.reason_code,
            last_seen_at = excluded.last_seen_at, cleared_at = NULL, details_json = excluded.details_json
        `).run(
          alertId,
          deviceId,
          sourceUnoBootId,
          cause.cause_id,
          cause.alert_type,
          cause.severity,
          cause.source,
          data.lifecycle,
          cause.reason_code,
          receivedAt,
          receivedAt,
          json({ detail_value: cause.detail_value, snapshot: true })
        );
        this.database.prepare(`
          INSERT OR IGNORE INTO alert_transitions(
            alert_id, device_id, operation, lifecycle, active, message_id, received_at, replayed, details_json
          ) VALUES (?, ?, 'snapshot', ?, 1, ?, ?, 0, ?)
        `).run(alertId, deviceId, data.lifecycle, `${messageId}:${cause.cause_id}`, receivedAt, json(cause));
      }
    });
  }

  async getAlert(deviceId: string, alertId: string): Promise<AlertRecord | null> {
    const row = this.database
      .prepare('SELECT * FROM alert_causes WHERE device_id = ? AND alert_id = ?')
      .get(deviceId, alertId) as AlertRow | undefined;
    return row ? this.alertFromRow(row) : null;
  }

  async listAlerts(deviceId: string): Promise<AlertRecord[]> {
    const rows = this.database
      .prepare('SELECT * FROM alert_causes WHERE device_id = ? ORDER BY last_seen_at DESC')
      .all(deviceId) as AlertRow[];
    return rows.map((row) => this.alertFromRow(row));
  }

  async appendLog(record: SystemLogRecord): Promise<void> {
    this.database.prepare(`
      INSERT OR IGNORE INTO system_events(
        event_id, device_id, event_type, severity, source, reference_id,
        occurred_at, received_at, time_quality, replayed, message, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'synced', 0, ?, ?, ?)
    `).run(
      record.id,
      record.deviceId,
      record.type,
      record.severity,
      record.source,
      record.referenceId,
      record.createdAt,
      record.message,
      json(record.details),
      record.createdAt
    );
  }

  async getLogs(deviceId: string, query: LogQuery): Promise<LogPage> {
    const clauses = ['(device_id IS NULL OR device_id = @deviceId)'];
    const parameters: Record<string, unknown> = { deviceId, limit: query.limit + 1 };
    if (query.type) { clauses.push('event_type = @type'); parameters.type = query.type; }
    if (query.severity) { clauses.push('severity = @severity'); parameters.severity = query.severity; }
    if (query.from) { clauses.push('created_at >= @from'); parameters.from = query.from; }
    if (query.to) { clauses.push('created_at <= @to'); parameters.to = query.to; }
    if (query.cursor) {
      const cursor = this.database.prepare('SELECT created_at FROM system_events WHERE event_id = ?').get(query.cursor) as { created_at: string } | undefined;
      if (!cursor) return { items: [], nextCursor: null };
      clauses.push('(created_at < @cursorAt OR (created_at = @cursorAt AND event_id < @cursorId))');
      parameters.cursorAt = cursor.created_at;
      parameters.cursorId = query.cursor;
    }
    const rows = this.database.prepare(`
      SELECT event_id, device_id, event_type, severity, message, source, reference_id, created_at, details_json
      FROM system_events
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC, event_id DESC
      LIMIT @limit
    `).all(parameters) as Array<{
      event_id: string;
      device_id: string | null;
      event_type: SystemLogRecord['type'];
      severity: SystemLogRecord['severity'];
      message: string;
      source: string;
      reference_id: string | null;
      created_at: string;
      details_json: string;
    }>;
    const hasMore = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    const items = selected.map((row) => ({
      id: row.event_id,
      deviceId: row.device_id,
      type: row.event_type,
      severity: row.severity,
      message: row.message,
      source: row.source,
      referenceId: row.reference_id,
      createdAt: row.created_at,
      details: parseJson<Record<string, unknown>>(row.details_json)
    }));
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async getLightHistory(deviceId: string, from: string, to: string): Promise<HistoryPoint[]> {
    const rows = this.database.prepare(`
      SELECT bucket_start_utc, valid_light_count, invalid_light_count, light_pct_sum,
             light_pct_min, light_pct_max, coverage_quality
      FROM sensor_minute_samples
      WHERE device_id = ? AND bucket_start_utc >= ? AND bucket_start_utc < ?
      ORDER BY bucket_start_utc
    `).all(deviceId, from, to) as Array<{
      bucket_start_utc: string;
      valid_light_count: number;
      invalid_light_count: number;
      light_pct_sum: number;
      light_pct_min: number | null;
      light_pct_max: number | null;
      coverage_quality: 'complete' | 'partial';
    }>;
    return rows.map((row) => ({
      bucketStartUtc: row.bucket_start_utc,
      value: row.valid_light_count > 0 ? Number((row.light_pct_sum / row.valid_light_count).toFixed(2)) : null,
      minimum: row.light_pct_min,
      maximum: row.light_pct_max,
      sampleCount: row.valid_light_count,
      coverageQuality: row.valid_light_count === 0 ? 'invalid' : row.coverage_quality
    }));
  }

  async getUserByUsername(username: string): Promise<UserCredential | null> {
    const row = this.database.prepare(`
      SELECT user_id, username, password_hash, active FROM users WHERE username = ?
    `).get(username) as { user_id: string; username: string; password_hash: string; active: number } | undefined;
    return row ? { userId: row.user_id, username: row.username, passwordHash: row.password_hash, active: row.active === 1 } : null;
  }

  async updateLastLogin(userId: string, at: string): Promise<void> {
    this.database.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE user_id = ?').run(at, at, userId);
  }

  async saveSession(session: StoredWebSession): Promise<void> {
    this.database.prepare(`
      INSERT INTO web_sessions(
        session_digest, user_id, username, csrf_token, expires_at, created_at, revoked_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.sessionDigest,
      session.userId,
      session.username,
      session.csrfToken,
      session.expiresAt,
      session.createdAt,
      session.revokedAt,
      session.lastSeenAt
    );
  }

  async getSession(sessionDigest: string): Promise<StoredWebSession | null> {
    const row = this.database.prepare(`
      SELECT session_digest, user_id, username, csrf_token, expires_at, created_at, revoked_at, last_seen_at
      FROM web_sessions WHERE session_digest = ?
    `).get(sessionDigest) as {
      session_digest: string;
      user_id: string;
      username: string;
      csrf_token: string;
      expires_at: string;
      created_at: string;
      revoked_at: string | null;
      last_seen_at: string;
    } | undefined;
    return row ? {
      sessionDigest: row.session_digest,
      userId: row.user_id,
      username: row.username,
      csrfToken: row.csrf_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      lastSeenAt: row.last_seen_at
    } : null;
  }

  async touchSession(sessionDigest: string, at: string): Promise<void> {
    this.database.prepare('UPDATE web_sessions SET last_seen_at = ? WHERE session_digest = ? AND revoked_at IS NULL').run(at, sessionDigest);
  }

  async revokeSession(sessionDigest: string, at: string): Promise<void> {
    this.database.prepare('UPDATE web_sessions SET revoked_at = ? WHERE session_digest = ?').run(at, sessionDigest);
  }

  async deleteExpiredSessions(at: string): Promise<number> {
    return Number(this.database.prepare(`
      DELETE FROM web_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL
    `).run(at).changes);
  }

  async enqueueOutbox(message: NewOutboxMessage): Promise<void> {
    this.upsertOutbox(message);
  }

  async listReadyOutbox(at: string, limit: number): Promise<OutboxRecord[]> {
    const rows = this.database.prepare(`
      SELECT outbox_id, device_id, message_id, topic, payload_json, qos, retain, kind,
             status, available_at, expires_at, attempt_count, published_at, last_error, created_at
      FROM mqtt_outbox
      WHERE status = 'pending' AND available_at <= ?
      ORDER BY outbox_id LIMIT ?
    `).all(at, limit) as Array<{
      outbox_id: number;
      device_id: string;
      message_id: string;
      topic: string;
      payload_json: string;
      qos: 0 | 1;
      retain: number;
      kind: OutboxRecord['kind'];
      status: OutboxRecord['status'];
      available_at: string;
      expires_at: string | null;
      attempt_count: number;
      published_at: string | null;
      last_error: string | null;
      created_at: string;
    }>;
    return rows.map((row) => ({
      outboxId: row.outbox_id,
      deviceId: row.device_id,
      messageId: row.message_id,
      topic: row.topic,
      payload: row.payload_json,
      qos: row.qos,
      retain: row.retain === 1,
      kind: row.kind,
      status: row.status,
      availableAt: row.available_at,
      expiresAt: row.expires_at,
      attemptCount: row.attempt_count,
      publishedAt: row.published_at,
      lastError: row.last_error,
      createdAt: row.created_at
    }));
  }

  async markOutboxPublished(messageId: string, at: string): Promise<void> {
    this.immediate(() => {
      const row = this.database.prepare('SELECT kind FROM mqtt_outbox WHERE message_id = ?').get(messageId) as { kind: string } | undefined;
      this.database.prepare(`
        UPDATE mqtt_outbox SET status = 'published', published_at = ?, last_error = NULL, updated_at = ?
        WHERE message_id = ?
      `).run(at, at, messageId);
      if (row?.kind === 'command') {
        this.database.prepare(`
          UPDATE commands SET published_at = ?, updated_at = ?, attempt_count = attempt_count + 1
          WHERE mqtt_message_id = ? AND status = 'pending'
        `).run(at, at, messageId);
      }
    });
  }

  async markOutboxFailed(messageId: string, error: string, nextAttemptAt: string): Promise<void> {
    this.database.prepare(`
      UPDATE mqtt_outbox SET attempt_count = attempt_count + 1, last_error = ?, available_at = ?, updated_at = ?
      WHERE message_id = ? AND status = 'pending'
    `).run(error.slice(0, 500), nextAttemptAt, this.now().toISOString(), messageId);
  }

  async markOutboxExpired(messageId: string, at: string): Promise<void> {
    this.database.prepare(`
      UPDATE mqtt_outbox SET status = 'expired', last_error = 'expired_before_publish', updated_at = ?
      WHERE message_id = ? AND status = 'pending'
    `).run(at, messageId);
  }

  async saveSyncRequest(record: SyncRunRecord, outbox: NewOutboxMessage): Promise<void> {
    this.immediate(() => {
      this.database.prepare(`
        INSERT INTO sync_runs(sync_id, device_id, reason, scopes_json, started_at, result, details_json)
        VALUES (?, ?, ?, ?, ?, 'pending', '{}')
      `).run(record.syncId, record.deviceId, record.reason, json(record.scopes), record.startedAt);
      this.upsertOutbox(outbox);
    });
  }

  async completeSyncRun(syncId: string, result: string, at: string, details: Record<string, unknown>): Promise<void> {
    this.database.prepare(`
      UPDATE sync_runs SET
        ended_at = ?, result = ?, desired_config_version = ?, reported_config_version = ?,
        state_version = ?, queue_remaining = ?, error = ?, details_json = ?
      WHERE sync_id = ?
    `).run(
      at,
      result,
      typeof details.config_version === 'number' ? details.config_version : null,
      typeof details.config_version === 'number' ? details.config_version : null,
      typeof details.state_version === 'number' ? details.state_version : null,
      typeof details.queue_remaining === 'number' ? details.queue_remaining : null,
      result === 'failed' ? String(details.reason_code ?? 'sync_failed') : null,
      json(details),
      syncId
    );
  }

  async runRetention(cutoff: string, batchSize: number): Promise<RetentionResult> {
    const deleted: Record<string, number> = {};
    this.immediate(() => {
      const statements: Array<[string, string, unknown[]]> = [
        ['sensor_minute_samples', `DELETE FROM sensor_minute_samples WHERE rowid IN (
          SELECT rowid FROM sensor_minute_samples WHERE bucket_start_utc < ? LIMIT ?
        )`, [cutoff, batchSize]],
        ['state_reports', `DELETE FROM state_reports WHERE rowid IN (
          SELECT s.rowid FROM state_reports s JOIN devices d ON d.device_id = s.device_id
          WHERE s.received_at < ? AND s.state_version <> coalesce(d.last_state_version, -1) LIMIT ?
        )`, [cutoff, batchSize]],
        ['availability_events', `DELETE FROM availability_events WHERE rowid IN (
          SELECT rowid FROM availability_events WHERE received_at < ? LIMIT ?
        )`, [cutoff, batchSize]],
        ['commands', `DELETE FROM commands WHERE rowid IN (
          SELECT rowid FROM commands WHERE created_at < ? AND status <> 'pending' LIMIT ?
        )`, [cutoff, batchSize]],
        ['system_events', `DELETE FROM system_events WHERE rowid IN (
          SELECT rowid FROM system_events WHERE created_at < ? LIMIT ?
        )`, [cutoff, batchSize]],
        ['alert_transitions', `DELETE FROM alert_transitions WHERE rowid IN (
          SELECT t.rowid FROM alert_transitions t JOIN alert_causes a ON a.alert_id = t.alert_id
          WHERE t.received_at < ? AND a.active = 0 LIMIT ?
        )`, [cutoff, batchSize]],
        ['alert_causes', `DELETE FROM alert_causes WHERE rowid IN (
          SELECT rowid FROM alert_causes WHERE last_seen_at < ? AND active = 0 LIMIT ?
        )`, [cutoff, batchSize]],
        ['mqtt_inbox', `DELETE FROM mqtt_inbox WHERE rowid IN (
          SELECT rowid FROM mqtt_inbox WHERE expires_at < ? LIMIT ?
        )`, [this.now().toISOString(), batchSize]],
        ['mqtt_outbox', `DELETE FROM mqtt_outbox WHERE rowid IN (
          SELECT rowid FROM mqtt_outbox WHERE created_at < ? AND status IN ('published', 'expired') LIMIT ?
        )`, [cutoff, batchSize]],
        ['sync_runs', `DELETE FROM sync_runs WHERE rowid IN (
          SELECT rowid FROM sync_runs WHERE started_at < ? AND result <> 'pending' LIMIT ?
        )`, [cutoff, batchSize]],
        ['audit_log', `DELETE FROM audit_log WHERE rowid IN (
          SELECT rowid FROM audit_log WHERE created_at < ? LIMIT ?
        )`, [cutoff, batchSize]],
        ['web_sessions', `DELETE FROM web_sessions WHERE rowid IN (
          SELECT rowid FROM web_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL LIMIT ?
        )`, [this.now().toISOString(), batchSize]]
      ];
      for (const [name, sql, parameters] of statements) {
        deleted[name] = Number(this.database.prepare(sql).run(...parameters).changes);
      }
      deleted.configuration_revisions = Number(this.database.prepare(`
        DELETE FROM configuration_revisions WHERE rowid IN (
          SELECT c.rowid FROM configuration_revisions c JOIN devices d ON d.device_id = c.device_id
          WHERE c.created_at < ?
            AND NOT (c.revision_role = 'desired' AND c.config_version = d.desired_config_version)
            AND NOT (c.revision_role = 'reported' AND c.config_version = coalesce(d.reported_config_version, -1))
          LIMIT ?
        )
      `).run(cutoff, batchSize).changes);
      this.insertAudit(null, 'retention_cleanup', 'database', null, 'completed', 'retention_policy', { cutoff, deleted });
    });
    return { cutoff, deleted };
  }

  private immediate<T>(operation: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private readSnapshot<T>(deviceId: string, kind: string): ReceivedValue<T> | null {
    const row = this.database.prepare(`
      SELECT message_id, received_at, retained, sent_at, time_quality,
             esp_boot_id, uno_boot_id, link_session_id, payload_json
      FROM device_snapshots WHERE device_id = ? AND snapshot_kind = ?
    `).get(deviceId, kind) as SnapshotRow | undefined;
    if (!row) return null;
    return {
      data: parseJson<T>(row.payload_json),
      messageId: row.message_id,
      receivedAt: row.received_at,
      retained: row.retained === 1,
      source: {
        sentAt: row.sent_at,
        timeQuality: row.time_quality,
        espBootId: row.esp_boot_id,
        unoBootId: row.uno_boot_id,
        linkSessionId: row.link_session_id
      }
    };
  }

  private writeSnapshot<T>(deviceId: string, kind: string, value: ReceivedValue<T>): void {
    this.database.prepare(`
      INSERT INTO device_snapshots(
        device_id, snapshot_kind, message_id, received_at, retained, sent_at, time_quality,
        esp_boot_id, uno_boot_id, link_session_id, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, snapshot_kind) DO UPDATE SET
        message_id = excluded.message_id,
        received_at = excluded.received_at,
        retained = excluded.retained,
        sent_at = excluded.sent_at,
        time_quality = excluded.time_quality,
        esp_boot_id = excluded.esp_boot_id,
        uno_boot_id = excluded.uno_boot_id,
        link_session_id = excluded.link_session_id,
        payload_json = excluded.payload_json
    `).run(
      deviceId,
      kind,
      value.messageId,
      value.receivedAt,
      flag(value.retained),
      value.source.sentAt,
      value.source.timeQuality,
      value.source.espBootId,
      value.source.unoBootId,
      value.source.linkSessionId,
      json(value.data)
    );
  }

  private insertDesired(record: DesiredConfigRecord): void {
    const parameters = this.configParameters(record.settings);
    this.database.prepare(`
      INSERT INTO configuration_revisions(
        device_id, config_version, revision_role, source, apply_result, delivery_status,
        message_id, light_on_pct, light_off_pct, control_mode, room_profile,
        light_dark_adc, light_bright_adc, light_calibration_enabled,
        mq2_baseline_adc, mq2_span_adc, mq2_threshold_pct, mq2_calibration_enabled,
        door_threshold_mm, door_confirm_samples, door_calibration_enabled,
        created_by_user_id, created_at, reason_code, sent_at, time_quality,
        esp_boot_id, uno_boot_id, link_session_id, settings_json
      ) VALUES (
        @deviceId, @version, 'desired', 'server_database', 'pending', @deliveryStatus,
        @messageId, @lightOn, @lightOff, @controlMode, @roomProfile,
        @lightDark, @lightBright, @lightEnabled,
        @mq2Baseline, @mq2Span, @mq2Threshold, @mq2Enabled,
        @doorThreshold, @doorSamples, @doorEnabled,
        @createdBy, @createdAt, @reasonCode, @createdAt, 'synced',
        0, 0, 0, @settingsJson
      )
    `).run({
      deviceId: record.deviceId,
      version: record.version,
      deliveryStatus: record.deliveryStatus,
      messageId: record.messageId,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      reasonCode: record.reasonCode,
      settingsJson: json(record.settings),
      ...parameters
    });
    this.database.prepare(`
      UPDATE devices SET desired_config_version = ?, updated_at = ? WHERE device_id = ?
    `).run(record.version, record.createdAt, record.deviceId);
  }

  private configParameters(settings: ConfigSettings): Record<string, unknown> {
    return {
      lightOn: settings.light_on_pct,
      lightOff: settings.light_off_pct,
      controlMode: settings.control_mode,
      roomProfile: settings.room_profile,
      lightDark: settings.light_calibration.dark_adc,
      lightBright: settings.light_calibration.bright_adc,
      lightEnabled: flag(settings.light_calibration.enabled),
      mq2Baseline: settings.mq2.baseline_adc,
      mq2Span: settings.mq2.span_adc,
      mq2Threshold: settings.mq2.threshold_pct,
      mq2Enabled: flag(settings.mq2.calibration_enabled),
      doorThreshold: settings.door_zone.threshold_mm,
      doorSamples: settings.door_zone.confirm_samples,
      doorEnabled: flag(settings.door_zone.calibration_enabled)
    };
  }

  private desiredFromRow(row: DesiredRow): DesiredConfigRecord {
    return {
      deviceId: row.device_id,
      version: row.config_version,
      settings: parseJson<ConfigSettings>(row.settings_json),
      messageId: row.message_id,
      deliveryStatus: row.delivery_status,
      reasonCode: row.reason_code,
      createdAt: row.created_at,
      createdBy: row.created_by_user_id ?? 'system'
    };
  }

  private commandFromRow(row: CommandRow): CommandRecord {
    return {
      commandId: row.command_id,
      deviceId: row.device_id,
      requestedBy: row.requested_by_user_id ?? 'system',
      request: {
        command_id: row.command_id,
        operation: row.operation,
        target: row.target,
        value: row.value,
        issued_at: row.issued_at,
        expires_at: row.expires_at,
        ttl_ms: row.ttl_ms,
        expected_state_version: row.expected_state_version,
        base_config_version: row.base_config_version,
        new_config_version: row.new_config_version,
        options: parseJson<CommandRecord['request']['options']>(row.options_json)
      },
      status: row.status,
      reasonCode: row.reason_code,
      actualState: row.actual_state_json ? parseJson<Record<string, unknown>>(row.actual_state_json) : null,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      resultAt: row.result_at,
      pendingConfigMutation: row.pending_config_json
        ? parseJson<CommandRecord['pendingConfigMutation']>(row.pending_config_json)
        : null
    };
  }

  private alertFromRow(row: AlertRow): AlertRecord {
    return {
      alertId: row.alert_id,
      deviceId: row.device_id,
      causeId: row.cause_id,
      type: row.alert_type,
      severity: row.severity,
      source: row.source,
      lifecycle: row.lifecycle,
      active: row.active === 1,
      reasonCode: row.reason_code,
      detail: parseJson<Record<string, unknown>>(row.details_json),
      updatedAt: row.last_seen_at
    };
  }

  private upsertOutbox(message: NewOutboxMessage): void {
    const now = this.now().toISOString();
    this.database.prepare(`
      INSERT INTO mqtt_outbox(
        device_id, message_id, topic, payload_json, qos, retain, kind, status,
        available_at, expires_at, attempt_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?)
      ON CONFLICT(message_id) DO UPDATE SET
        topic = excluded.topic,
        payload_json = excluded.payload_json,
        qos = excluded.qos,
        retain = excluded.retain,
        kind = excluded.kind,
        status = 'pending',
        available_at = excluded.available_at,
        expires_at = excluded.expires_at,
        published_at = NULL,
        last_error = NULL,
        updated_at = excluded.updated_at
    `).run(
      message.deviceId,
      message.messageId,
      message.topic,
      message.payload,
      message.qos,
      flag(message.retain),
      message.kind,
      message.availableAt,
      message.expiresAt,
      now,
      now
    );
  }

  private insertAudit(
    userId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    outcome: string,
    reasonCode: string | null,
    details: Record<string, unknown>
  ): void {
    this.database.prepare(`
      INSERT INTO audit_log(
        audit_id, user_id, action, target_type, target_id, outcome,
        reason_code, request_id, created_at, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      `audit-${randomUUID()}`,
      userId,
      action,
      targetType,
      targetId,
      outcome,
      reasonCode,
      this.now().toISOString(),
      json(details)
    );
  }
}
