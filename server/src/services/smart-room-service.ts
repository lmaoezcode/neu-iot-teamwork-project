import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config/env.js';
import type {
  DataRepository,
  LogPage,
  LogQuery,
  NewOutboxMessage,
  UserCredential
} from '../data/repository.js';
import type { MqttConnectionStatus, MqttMessage, MqttPort } from '../mqtt/client.js';
import type { EventStreamPort } from '../realtime/event-stream.js';
import type {
  AlertEventData,
  AlertSnapshotData,
  AvailabilityData,
  CommandInput,
  CommandOptions,
  CommandRecord,
  CommandResultData,
  CommandWireData,
  ConfigSettings,
  DesiredConfigRecord,
  DeviceEventData,
  DeviceOverview,
  DiagnosticsData,
  HistoryPoint,
  MqttEnvelope,
  PendingConfigMutation,
  ReportedConfigData,
  ReportedStateData,
  SourceMetadata,
  SystemLogRecord,
  TelemetryData
} from '../types/domain.js';
import {
  type InboundMqttSuffix,
  parseInboundTopic,
  parseMqttPayload
} from '../validation/schemas.js';
import { ServiceError } from './errors.js';

const inboundSuffixes: InboundMqttSuffix[] = [
  'availability',
  'telemetry/sensors',
  'state/reported',
  'config/reported',
  'commands/result',
  'events',
  'alerts/events',
  'alerts/reported',
  'sync/status',
  'diagnostics'
];

const clone = <T>(value: T): T => structuredClone(value);

function isFullEnvelope(value: unknown): value is MqttEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'message_id' in value;
}

function serverEnvelope<T>(messageId: string, deviceId: string, sentAt: string, data: T): Record<string, unknown> {
  return {
    schema: 'smartroom.mqtt',
    schema_version: 1,
    message_id: messageId,
    device_id: deviceId,
    sent_at: sentAt,
    time_quality: 'synced',
    data
  };
}

function sourceMetadata(envelope: MqttEnvelope<unknown> | null): SourceMetadata {
  if (!envelope) {
    return { sentAt: null, timeQuality: 'unsynced', espBootId: 0, unoBootId: 0, linkSessionId: 0 };
  }
  return {
    sentAt: envelope.sent_at,
    timeQuality: envelope.time_quality,
    espBootId: envelope.esp_boot_id,
    unoBootId: envelope.uno_boot_id,
    linkSessionId: envelope.link_session_id
  };
}

export interface ServerHealth {
  status: 'ok' | 'degraded';
  mqtt: 'connected' | 'reconnecting' | 'offline' | 'closed' | 'error' | 'disabled';
  storage: 'volatile_stage14' | 'sqlite';
  deviceId: string;
}

export class SmartRoomService {
  private brokerStatus: ServerHealth['mqtt'];
  private expirationTimer: NodeJS.Timeout | null = null;
  private outboxTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;
  private flushingOutbox = false;
  private started = false;

  constructor(
    private readonly config: ServerConfig,
    private readonly repository: DataRepository,
    private readonly mqtt: MqttPort,
    private readonly events: EventStreamPort,
    private readonly now: () => Date = () => new Date()
  ) {
    this.brokerStatus = config.mqttEnabled ? 'offline' : 'disabled';
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.repository.initialize(this.config.deviceId, {
      ownerUsername: this.config.ownerUsername,
      ownerPasswordHash: this.config.ownerPasswordHash
    });
    this.mqtt.onMessage((message) => this.handleMqttMessage(message));
    this.mqtt.onStatus((status, detail) => {
      this.runInBackground('mqtt_status', () => this.handleBrokerStatus(status, detail));
    });
    for (const suffix of inboundSuffixes) {
      await this.mqtt.subscribe(this.topic(suffix), suffix === 'telemetry/sensors' || suffix === 'diagnostics' ? 0 : 1);
    }
    await this.mqtt.connect();
    this.expirationTimer = setInterval(() => {
      this.runInBackground('command_expiration', () => this.expirePendingCommands());
    }, 1000);
    this.expirationTimer.unref();
    this.outboxTimer = setInterval(() => {
      this.runInBackground('outbox_flush', () => this.flushOutbox());
    }, 1000);
    this.outboxTimer.unref();
    this.retentionTimer = setInterval(() => {
      this.runInBackground('retention', () => this.runRetention());
    }, this.config.retentionIntervalSeconds * 1000);
    this.retentionTimer.unref();
    await this.runRetention();
  }

  async stop(): Promise<void> {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
    if (this.outboxTimer) clearInterval(this.outboxTimer);
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    this.expirationTimer = null;
    this.outboxTimer = null;
    this.retentionTimer = null;
    await this.mqtt.close();
    await this.repository.close();
    this.started = false;
  }

  private runInBackground(label: string, operation: () => Promise<void>): void {
    void operation().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[${label}] ${detail}\n`);
    });
  }

  health(): ServerHealth {
    return {
      status: this.brokerStatus === 'connected' || this.brokerStatus === 'disabled' ? 'ok' : 'degraded',
      mqtt: this.brokerStatus,
      storage: this.repository.storageMode,
      deviceId: this.config.deviceId
    };
  }

  async getOverview(): Promise<DeviceOverview> {
    return this.repository.getOverview(this.config.deviceId);
  }

  async getConfig(): Promise<{
    desired: DesiredConfigRecord;
    reported: DeviceOverview['reportedConfig'];
    limits: Record<string, unknown>;
  }> {
    return {
      desired: await this.repository.getDesiredConfig(this.config.deviceId),
      reported: await this.repository.getReportedConfig(this.config.deviceId),
      limits: {
        light_on_pct: { minimum: 0, maximum: 80 },
        light_off_pct: { minimum: 20, maximum: 100, minimum_gap: 5 },
        light_adc: { minimum: 0, maximum: 1023, minimum_span_when_enabled: 10 },
        mq2_adc: { minimum: 0, maximum: 1023 },
        mq2_threshold_pct: { minimum: 0, maximum: 100, maintenance_only: true },
        door_threshold_mm: { minimum: 20, maximum: 4000 },
        door_confirm_samples: { minimum: 1, maximum: 10 }
      }
    };
  }

  async updateDesiredConfig(baseVersion: number, settings: ConfigSettings, requestedBy: string): Promise<DesiredConfigRecord> {
    if (await this.repository.hasPendingCommand(this.config.deviceId)) {
      throw new ServiceError(409, 'command_pending', 'Không thể đổi cấu hình khi một lệnh thiết bị đang chờ xác nhận.');
    }
    const current = await this.repository.getDesiredConfig(this.config.deviceId);
    if (current.version !== baseVersion) {
      throw new ServiceError(409, 'config_version_conflict', 'Cấu hình đã thay đổi; hãy tải lại trước khi lưu.', {
        expected: current.version,
        received: baseVersion
      });
    }
    if (current.version >= 0xffff_fffe) {
      throw new ServiceError(409, 'config_version_exhausted', 'Không thể cấp thêm phiên bản cấu hình.');
    }
    const now = this.now().toISOString();
    const record: DesiredConfigRecord = {
      deviceId: this.config.deviceId,
      version: current.version + 1,
      settings: clone(settings),
      messageId: `cfg-${randomUUID()}`,
      deliveryStatus: 'pending_delivery',
      reasonCode: 'database_outbox_queued',
      createdAt: now,
      createdBy: requestedBy
    };
    const outbox = this.createOutbox(
      'config/desired',
      serverEnvelope(record.messageId, this.config.deviceId, now, {
        config_version: record.version,
        source: 'server_database',
        settings: record.settings
      }),
      true,
      'config',
      record.messageId,
      null
    );
    await this.repository.saveDesiredConfig(record, outbox);
    await this.log('config', 'notice', 'Đã lưu cấu hình mong muốn; đang chờ thiết bị áp dụng.', 'server', record.messageId, {
      config_version: record.version
    });
    await this.flushOutbox();
    this.events.publish('config.updated', await this.getConfig());
    return this.repository.getDesiredConfig(this.config.deviceId);
  }

  async submitCommand(input: CommandInput, requestedBy: string): Promise<CommandRecord> {
    const overview = await this.repository.getOverview(this.config.deviceId);
    if (overview.availability?.data.status !== 'online') {
      throw new ServiceError(409, 'device_not_ready', 'Thiết bị chưa ở trạng thái Trực tuyến sẵn sàng nhận lệnh.', {
        availability: overview.availability?.data.status ?? 'offline'
      });
    }
    if (!overview.state) {
      throw new ServiceError(409, 'state_unavailable', 'Chưa có trạng thái báo cáo để kiểm tra lệnh.');
    }
    if (await this.repository.hasPendingCommand(this.config.deviceId)) {
      throw new ServiceError(409, 'command_pending', 'Thiết bị đang xử lý một lệnh khác.');
    }
    if (
      input.expected_state_version !== undefined &&
      input.expected_state_version !== overview.state.data.state_version
    ) {
      throw new ServiceError(409, 'state_version_conflict', 'Trạng thái thiết bị đã thay đổi; hãy tải lại.', {
        expected: overview.state.data.state_version,
        received: input.expected_state_version
      });
    }

    const desired = overview.desiredConfig;
    if (overview.state.data.config_version !== desired.version && input.operation !== 'alert_action') {
      throw new ServiceError(409, 'configuration_sync_required', 'Thiết bị chưa đồng bộ cấu hình mới nhất.', {
        desired_version: desired.version,
        reported_state_version: overview.state.data.config_version
      });
    }

    const mutation = this.validatePolicyAndBuildMutation(input, overview);
    const commandId = `cmd-${randomUUID()}`;
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + 30_000);
    const options: Required<CommandOptions> = {
      user_confirmed: input.options?.user_confirmed ?? false,
      force_manual: input.options?.force_manual ?? false,
      transition_home: input.options?.transition_home ?? false
    };
    const wire: CommandWireData = {
      command_id: commandId,
      operation: input.operation,
      target: input.target,
      value: input.value,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      ttl_ms: 30_000,
      expected_state_version: overview.state.data.state_version,
      base_config_version: desired.version,
      new_config_version: mutation?.version ?? desired.version,
      options
    };
    const record: CommandRecord = {
      commandId,
      deviceId: this.config.deviceId,
      requestedBy,
      request: wire,
      status: 'pending',
      reasonCode: 'waiting_device_result',
      actualState: null,
      createdAt: issuedAt.toISOString(),
      publishedAt: null,
      resultAt: null,
      pendingConfigMutation: mutation
    };
    const outbox = this.createOutbox(
      'commands/request',
      serverEnvelope(commandId, this.config.deviceId, wire.issued_at, wire),
      false,
      'command',
      commandId,
      wire.expires_at
    );
    await this.repository.saveCommand(record, outbox);
    await this.flushOutbox();

    const published = (await this.repository.getCommand(commandId))!;
    await this.log('command', 'notice', 'Lệnh đã được lưu bền vững và đang chờ xác nhận cuối từ thiết bị.', 'web', commandId, {
      operation: input.operation,
      target: input.target,
      value: input.value
    });
    this.events.publish('command.updated', published);
    return published;
  }

  async submitAlertAction(alertId: string, action: 'mute' | 'acknowledge', requestedBy: string): Promise<CommandRecord> {
    const alert = await this.repository.getAlert(this.config.deviceId, alertId);
    if (!alert) throw new ServiceError(404, 'alert_not_found', 'Không tìm thấy cảnh báo.');
    const alerts = await this.repository.listAlerts(this.config.deviceId);
    if (action === 'mute' && !alerts.some((item) => item.active)) {
      throw new ServiceError(409, 'no_active_alert', 'Không có cảnh báo đang hoạt động để tắt tiếng.');
    }
    if (action === 'acknowledge' && alerts.some((item) => item.active)) {
      throw new ServiceError(409, 'alert_cause_active', 'Chỉ có thể xác nhận sau khi mọi nguyên nhân đã hết.');
    }
    return this.submitCommand(
      {
        operation: 'alert_action',
        target: 'alert',
        value: action,
        options: { user_confirmed: true }
      },
      requestedBy
    );
  }

  async getCommand(commandId: string): Promise<CommandRecord> {
    const command = await this.repository.getCommand(commandId);
    if (!command || command.deviceId !== this.config.deviceId) {
      throw new ServiceError(404, 'command_not_found', 'Không tìm thấy lệnh.');
    }
    return command;
  }

  async getLightHistory(from: string, to: string): Promise<HistoryPoint[]> {
    return this.repository.getLightHistory(this.config.deviceId, from, to);
  }

  async getLogs(query: LogQuery): Promise<LogPage> {
    return this.repository.getLogs(this.config.deviceId, query);
  }

  async getUserCredential(username: string): Promise<UserCredential | null> {
    return this.repository.getUserByUsername(username);
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.repository.updateLastLogin(userId, this.now().toISOString());
  }

  async recordAuthLog(success: boolean, requestId: string, source: string): Promise<void> {
    await this.log(
      'auth',
      success ? 'info' : 'warning',
      success ? 'Đăng nhập chủ phòng thành công.' : 'Đăng nhập chủ phòng thất bại.',
      source,
      requestId,
      { outcome: success ? 'success' : 'failure' }
    );
  }

  async handleMqttMessage(message: MqttMessage): Promise<void> {
    const topic = parseInboundTopic(this.config.mqttDeviceRoot, message.topic);
    if (!topic || topic.deviceId !== this.config.deviceId) {
      await this.log('system', 'warning', 'Đã loại bản tin MQTT ngoài phạm vi thiết bị.', 'mqtt', null, {
        topic: message.topic
      });
      return;
    }
    const parsed = parseMqttPayload(topic.suffix, message.payload);
    if (!parsed.success) {
      await this.log('system', 'warning', 'Đã loại bản tin MQTT không hợp lệ.', 'mqtt', null, {
        topic: message.topic,
        reason: parsed.reason,
        issues: parsed.issues ?? []
      });
      return;
    }
    const value = parsed.value as { device_id: string };
    if (value.device_id !== topic.deviceId) {
      await this.log('system', 'warning', 'Đã loại bản tin có device_id không khớp topic.', 'mqtt', null, {
        topic_device_id: topic.deviceId,
        payload_device_id: value.device_id
      });
      return;
    }
    if (isFullEnvelope(value) && topic.suffix !== 'telemetry/sensors' && topic.suffix !== 'diagnostics') {
      const fresh = await this.repository.rememberMessage(topic.deviceId, value.message_id);
      if (!fresh) return;
    }
    await this.applyInbound(topic.suffix, parsed.value, message.retained);
  }

  private async applyInbound(suffix: InboundMqttSuffix, raw: unknown, retained: boolean): Promise<void> {
    const receivedAt = this.now().toISOString();
    const full = isFullEnvelope(raw) ? (raw as MqttEnvelope<unknown>) : null;
    const messageId = full?.message_id ?? null;
    const source = sourceMetadata(full);
    const data = (raw as { data: unknown }).data;

    switch (suffix) {
      case 'availability': {
        const availability = data as AvailabilityData;
        const previous = (await this.repository.getOverview(this.config.deviceId)).availability?.data.status;
        await this.repository.saveAvailability(this.config.deviceId, {
          data: availability,
          messageId,
          receivedAt,
          retained,
          source
        });
        this.events.publish('availability.updated', { ...availability, received_at: receivedAt });
        if (previous !== availability.status) {
          await this.log('system', availability.status === 'offline' ? 'warning' : 'info', 'Trạng thái thiết bị đã thay đổi.', 'device', messageId, {
            from: previous ?? 'unknown',
            to: availability.status,
            reason: availability.reason
          });
        }
        break;
      }
      case 'telemetry/sensors': {
        const telemetry = data as TelemetryData;
        await this.repository.saveTelemetry(this.config.deviceId, {
          data: telemetry,
          messageId: messageId!,
          receivedAt,
          retained,
          source
        });
        this.events.publish('telemetry.updated', { ...telemetry, received_at: receivedAt });
        break;
      }
      case 'state/reported': {
        const state = data as ReportedStateData;
        const applied = await this.repository.saveReportedState(this.config.deviceId, {
          data: state,
          messageId: messageId!,
          receivedAt,
          retained,
          source
        });
        if (applied) this.events.publish('state.updated', { ...state, received_at: receivedAt });
        break;
      }
      case 'config/reported': {
        const reported = data as ReportedConfigData;
        const applied = await this.repository.saveReportedConfig({
          deviceId: this.config.deviceId,
          data: reported,
          messageId: messageId!,
          receivedAt,
          source
        });
        if (!applied) break;
        const desired = await this.repository.getDesiredConfig(this.config.deviceId);
        if (reported.config_version === desired.version) {
          if (reported.apply_result === 'applied' || reported.apply_result === 'unchanged') {
            await this.repository.updateDesiredDelivery(this.config.deviceId, desired.version, 'applied', reported.reason_code);
          } else if (reported.apply_result === 'rejected') {
            await this.repository.updateDesiredDelivery(this.config.deviceId, desired.version, 'rejected', reported.reason_code);
          }
        }
        this.events.publish('config.updated', await this.getConfig());
        await this.log(
          'config',
          reported.apply_result === 'rejected' ? 'warning' : 'info',
          'Thiết bị đã báo cáo kết quả cấu hình.',
          'device',
          messageId,
          { config_version: reported.config_version, result: reported.apply_result, reason: reported.reason_code }
        );
        break;
      }
      case 'commands/result':
        await this.applyCommandResult(data as CommandResultData, receivedAt, messageId!);
        break;
      case 'events': {
        const event = data as DeviceEventData;
        await this.log(this.eventLogType(event), event.severity, `Sự kiện thiết bị: ${event.event_type}.`, event.source, event.event_id, {
          ...event.details,
          occurred_at: event.occurred_at,
          received_at: receivedAt,
          replayed: event.replayed
        });
        this.events.publish('event.created', event);
        break;
      }
      case 'alerts/events': {
        const alert = await this.repository.saveAlertEvent(
          this.config.deviceId,
          data as AlertEventData,
          receivedAt,
          messageId!,
          source.unoBootId
        );
        await this.log(alert.type === 'security' ? 'security' : alert.type === 'safety' ? 'safety' : 'system', alert.severity, 'Trạng thái nguyên nhân cảnh báo đã thay đổi.', alert.source, alert.alertId, {
          active: alert.active,
          lifecycle: alert.lifecycle,
          reason: alert.reasonCode
        });
        const alerts = await this.repository.listAlerts(this.config.deviceId);
        this.events.publish('alert.updated', {
          alert,
          alerts,
          active_alerts: alerts.filter((item) => item.active)
        });
        break;
      }
      case 'alerts/reported': {
        await this.repository.replaceAlertSnapshot(
          this.config.deviceId,
          data as AlertSnapshotData,
          receivedAt,
          messageId!,
          source.unoBootId
        );
        const alerts = await this.repository.listAlerts(this.config.deviceId);
        this.events.publish('alert.updated', {
          snapshot: data,
          alerts,
          active_alerts: alerts.filter((item) => item.active)
        });
        break;
      }
      case 'sync/status': {
        const sync = data as Record<string, unknown>;
        if (sync.result === 'completed' || sync.result === 'failed') {
          if (typeof sync.sync_id === 'string') {
            await this.repository.completeSyncRun(sync.sync_id, String(sync.result), receivedAt, sync);
          }
          await this.log('system', sync.result === 'failed' ? 'warning' : 'info', 'Phiên đồng bộ thiết bị đã kết thúc.', 'device', messageId, sync);
          this.events.publish('event.created', { event_type: 'sync_status', ...sync });
        }
        break;
      }
      case 'diagnostics': {
        const diagnostics = data as DiagnosticsData;
        await this.repository.saveDiagnostics(this.config.deviceId, {
          data: diagnostics,
          messageId: messageId!,
          receivedAt,
          retained,
          source
        });
        if (diagnostics.last_error !== 'none') {
          await this.log('system', 'warning', 'Thiết bị báo chẩn đoán lỗi.', 'device', messageId, {
            last_error: diagnostics.last_error,
            local_detail: diagnostics.local_detail
          });
        }
        break;
      }
    }
  }

  private validatePolicyAndBuildMutation(input: CommandInput, overview: DeviceOverview): PendingConfigMutation | null {
    const state = overview.state!.data;
    const desired = overview.desiredConfig;
    const settings = clone(desired.settings);
    const confirmed = input.options?.user_confirmed === true;

    if (input.operation === 'set_device') {
      if (state.room_profile === 'away') {
        throw new ServiceError(409, 'away_profile', 'Ra ngoài đang cưỡng chế tắt và khóa điều khiển tải tiện nghi.');
      }
      if (state.control_mode === 'auto') {
        if (!confirmed || input.options?.force_manual !== true) {
          throw new ServiceError(409, 'manual_confirmation_required', 'Hãy xác nhận chuyển sang Thủ công trước khi điều khiển trực tiếp.');
        }
        settings.control_mode = 'manual';
        return this.nextMutation(desired, settings);
      }
      return null;
    }

    if (input.operation === 'set_control_mode') {
      settings.control_mode = input.value as ConfigSettings['control_mode'];
      return this.nextMutation(desired, settings);
    }

    if (input.operation === 'set_room_profile') {
      if (!confirmed && (input.value === 'away' || input.value === 'night')) {
        throw new ServiceError(409, 'confirmation_required', 'Chuyển sang Ra ngoài hoặc Ban đêm cần xác nhận.');
      }
      settings.room_profile = input.value as ConfigSettings['room_profile'];
      return this.nextMutation(desired, settings);
    }

    if (input.operation === 'set_lock' && input.value === 'unlocked') {
      const securityActive = overview.activeAlerts.some((alert) => alert.type === 'security');
      const safetyActive = overview.activeAlerts.some((alert) => alert.type === 'safety');
      if (securityActive) {
        throw new ServiceError(409, 'security_alert_active', 'Không thể mở khóa mô phỏng khi cảnh báo an ninh còn hoạt động.');
      }
      if (safetyActive && !confirmed) {
        throw new ServiceError(409, 'safety_confirmation_required', 'Mở khóa trong cảnh báo an toàn cần xác nhận của chủ phòng.');
      }
      if (state.room_profile !== 'home') {
        if (!confirmed || input.options?.transition_home !== true) {
          throw new ServiceError(409, 'transition_home_required', 'Phải xác nhận chuyển nguyên tử về Ở nhà trước khi mở khóa.');
        }
        settings.room_profile = 'home';
        return this.nextMutation(desired, settings);
      }
    }

    if (input.operation === 'alert_action') {
      if (!confirmed) throw new ServiceError(409, 'confirmation_required', 'Thao tác cảnh báo cần xác nhận.');
      if (input.value === 'acknowledge' && overview.activeAlerts.length > 0) {
        throw new ServiceError(409, 'alert_cause_active', 'Không thể xác nhận khi nguyên nhân cảnh báo còn tồn tại.');
      }
    }
    return null;
  }

  private nextMutation(desired: DesiredConfigRecord, settings: ConfigSettings): PendingConfigMutation {
    if (desired.version >= 0xffff_fffe) {
      throw new ServiceError(409, 'config_version_exhausted', 'Không thể cấp thêm phiên bản cấu hình.');
    }
    return { version: desired.version + 1, settings };
  }

  private async applyCommandResult(result: CommandResultData, receivedAt: string, messageId: string): Promise<void> {
    const command = await this.repository.completeCommand(result.command_id, result, receivedAt, messageId);
    if (!command) {
      await this.log('command', 'warning', 'Nhận kết quả cho lệnh không tồn tại trên máy chủ.', 'device', result.command_id, {
        message_id: messageId,
        result: result.result
      });
      return;
    }
    if ((result.result === 'applied' || result.result === 'duplicate_ok') && command.pendingConfigMutation) {
      const desired = await this.repository.getDesiredConfig(this.config.deviceId);
      if (command.pendingConfigMutation.version === desired.version + 1) {
        const configRecord: DesiredConfigRecord = {
          deviceId: this.config.deviceId,
          version: command.pendingConfigMutation.version,
          settings: clone(command.pendingConfigMutation.settings),
          messageId: `cfg-command-${randomUUID()}`,
          deliveryStatus: 'pending_delivery',
          reasonCode: 'command_applied_waiting_retain',
          createdAt: receivedAt,
          createdBy: command.requestedBy
        };
        const outbox = this.desiredOutbox(configRecord);
        await this.repository.saveDesiredConfig(configRecord, outbox);
        await this.flushOutbox();
        this.events.publish('config.updated', await this.getConfig());
      }
    }
    await this.log(
      'command',
      result.result === 'applied' || result.result === 'duplicate_ok' ? 'info' : 'warning',
      'Thiết bị đã trả kết quả cuối cho lệnh.',
      'device',
      result.command_id,
      { result: result.result, reason: result.reason_code, uno_ack: result.uno_ack }
    );
    this.events.publish('command.updated', command);
  }

  private async handleBrokerStatus(status: MqttConnectionStatus, detail?: string): Promise<void> {
    this.brokerStatus = status;
    if (status === 'connected') {
      const desired = await this.repository.getDesiredConfig(this.config.deviceId);
      await this.queueDesiredForPublish(desired);
      await this.requestSync('server_mqtt_connected');
      await this.flushOutbox();
      return;
    }
    if (status === 'error') {
      await this.log('system', 'warning', 'Kết nối MQTT của máy chủ gặp lỗi.', 'server', null, {
        detail: detail ?? 'unknown'
      });
    }
  }

  private async requestSync(reason: string): Promise<void> {
    if (!this.mqtt.isConnected()) return;
    const now = this.now().toISOString();
    const syncId = `sync-${randomUUID()}`;
    const scopes = ['config', 'state', 'alerts', 'health'];
    const outbox = this.createOutbox(
      'sync/request',
      serverEnvelope(syncId, this.config.deviceId, now, { sync_id: syncId, scopes, reason }),
      false,
      'sync',
      syncId,
      new Date(this.now().getTime() + 30_000).toISOString()
    );
    await this.repository.saveSyncRequest({ syncId, deviceId: this.config.deviceId, reason, scopes, startedAt: now }, outbox);
  }

  private async queueDesiredForPublish(record: DesiredConfigRecord): Promise<void> {
    await this.repository.enqueueOutbox(this.desiredOutbox(record));
    if (!this.mqtt.isConnected()) {
      await this.repository.updateDesiredDelivery(this.config.deviceId, record.version, 'pending_delivery', 'mqtt_offline');
    }
  }

  private desiredOutbox(record: DesiredConfigRecord): NewOutboxMessage {
    return this.createOutbox(
      'config/desired',
      serverEnvelope(record.messageId, this.config.deviceId, this.now().toISOString(), {
        config_version: record.version,
        source: 'server_database',
        settings: record.settings
      }),
      true,
      'config',
      record.messageId,
      null
    );
  }

  private createOutbox(
    suffix: 'config/desired' | 'commands/request' | 'sync/request',
    body: Record<string, unknown>,
    retain: boolean,
    kind: NewOutboxMessage['kind'],
    messageId: string,
    expiresAt: string | null
  ): NewOutboxMessage {
    const payload = JSON.stringify(body);
    if (Buffer.byteLength(payload, 'utf8') > 2048) {
      throw new Error('mqtt_payload_too_large');
    }
    return {
      messageId,
      deviceId: this.config.deviceId,
      topic: this.topic(suffix),
      payload,
      qos: 1,
      retain,
      kind,
      availableAt: this.now().toISOString(),
      expiresAt
    };
  }

  private async flushOutbox(): Promise<void> {
    if (this.flushingOutbox || !this.mqtt.isConnected()) return;
    this.flushingOutbox = true;
    try {
      const now = this.now();
      const items = await this.repository.listReadyOutbox(now.toISOString(), 20);
      for (const item of items) {
        if (item.expiresAt && Date.parse(item.expiresAt) <= now.getTime()) {
          await this.repository.markOutboxExpired(item.messageId, now.toISOString());
          continue;
        }
        try {
          await this.mqtt.publish(item.topic, item.payload, item.qos, item.retain);
          const publishedAt = this.now().toISOString();
          await this.repository.markOutboxPublished(item.messageId, publishedAt);
          if (item.kind === 'config') {
            const envelope = JSON.parse(item.payload) as { data?: { config_version?: number } };
            const version = envelope.data?.config_version;
            if (typeof version === 'number') {
              await this.repository.updateDesiredDelivery(
                this.config.deviceId,
                version,
                'published',
                'waiting_device_report'
              );
            }
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'mqtt_publish_failed';
          const delaySeconds = Math.min(60, 2 ** Math.min(item.attemptCount + 1, 6));
          const nextAttempt = new Date(this.now().getTime() + delaySeconds * 1000).toISOString();
          await this.repository.markOutboxFailed(item.messageId, reason, nextAttempt);
          if (item.kind === 'config') {
            const envelope = JSON.parse(item.payload) as { data?: { config_version?: number } };
            if (typeof envelope.data?.config_version === 'number') {
              await this.repository.updateDesiredDelivery(
                this.config.deviceId,
                envelope.data.config_version,
                'pending_delivery',
                'mqtt_publish_failed'
              );
            }
          }
          break;
        }
      }
    } finally {
      this.flushingOutbox = false;
    }
  }

  private async expirePendingCommands(): Promise<void> {
    const pending = await this.repository.listPendingCommands(this.config.deviceId);
    const now = this.now().getTime();
    for (const command of pending) {
      if (Date.parse(command.request.expires_at) > now) continue;
      await this.repository.markOutboxExpired(command.commandId, this.now().toISOString());
      await this.markUnknown(command, 'device_result_timeout');
    }
  }

  private async runRetention(): Promise<void> {
    const cutoff = new Date(this.now().getTime() - this.config.retentionDays * 86_400_000).toISOString();
    try {
      const result = await this.repository.runRetention(cutoff, this.config.retentionBatchSize);
      const deleted = Object.values(result.deleted).reduce((sum, value) => sum + value, 0);
      if (deleted > 0) {
        await this.log('system', 'info', 'Đã dọn dữ liệu hết hạn theo chính sách lưu trữ.', 'server', null, {
          cutoff,
          deleted: result.deleted
        });
      }
    } catch (error) {
      await this.log('system', 'warning', 'Không thể hoàn tất tác vụ dọn dữ liệu hết hạn.', 'server', null, {
        reason: error instanceof Error ? error.message : 'retention_failed'
      });
    }
  }

  private async markUnknown(command: CommandRecord, reasonCode: string): Promise<void> {
    const overview = await this.repository.getOverview(this.config.deviceId);
    const result: CommandResultData = {
      command_id: command.commandId,
      result: 'unknown',
      reason_code: reasonCode,
      config_version: overview.state?.data.config_version ?? overview.desiredConfig.version,
      state_version: overview.state?.data.state_version ?? 0,
      actual_state: {},
      uno_ack: false,
      replayed: false
    };
    const updated = await this.repository.completeCommand(command.commandId, result, this.now().toISOString(), null);
    if (updated) this.events.publish('command.updated', updated);
    await this.log('command', 'warning', 'Lệnh hết thời gian chờ mà chưa có xác nhận cuối.', 'server', command.commandId, {
      reason: reasonCode
    });
  }

  private async log(
    type: SystemLogRecord['type'],
    severity: SystemLogRecord['severity'],
    message: string,
    source: string,
    referenceId: string | null,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.repository.appendLog({
      id: `log-${randomUUID()}`,
      deviceId: this.config.deviceId,
      type,
      severity,
      message,
      source,
      referenceId,
      createdAt: this.now().toISOString(),
      details: clone(details)
    });
  }

  private eventLogType(event: DeviceEventData): SystemLogRecord['type'] {
    if (event.event_type.includes('sensor')) return 'sensor';
    if (event.event_type.includes('config')) return 'config';
    if (event.event_type.includes('command') || event.event_type.includes('device_state')) return 'command';
    return 'system';
  }

  private topic(suffix: string): string {
    return `${this.config.mqttDeviceRoot}/${this.config.deviceId}/${suffix}`;
  }
}
