import { randomUUID } from 'node:crypto';
import type {
  AlertEventData,
  AlertRecord,
  AlertSnapshotData,
  AvailabilityData,
  CommandRecord,
  CommandResultData,
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

interface LightBucket {
  startedAt: number;
  sum: number;
  minimum: number;
  maximum: number;
  count: number;
  invalidCount: number;
}

interface DeviceMemory {
  availability: ReceivedValue<AvailabilityData> | null;
  telemetry: ReceivedValue<TelemetryData> | null;
  state: ReceivedValue<ReportedStateData> | null;
  diagnostics: ReceivedValue<DiagnosticsData> | null;
  desired: DesiredConfigRecord;
  reported: ReportedConfigRecord | null;
  alerts: Map<string, AlertRecord>;
  alertIdsByCause: Map<number, string>;
  lightBuckets: Map<number, LightBucket>;
}

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryRepository implements DataRepository {
  readonly storageMode = 'volatile_stage14' as const;
  private readonly devices = new Map<string, DeviceMemory>();
  private readonly seenMessages = new Map<string, number>();
  private readonly commands = new Map<string, CommandRecord>();
  private readonly logs: SystemLogRecord[] = [];
  private readonly maximumSeenMessages = 4096;
  private readonly maximumLogs = 5000;
  private readonly users = new Map<string, UserCredential>();
  private readonly sessions = new Map<string, StoredWebSession>();
  private readonly outbox = new Map<string, OutboxRecord>();
  private outboxSequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async initialize(deviceId: string, bootstrap: RepositoryBootstrap): Promise<void> {
    if (!this.users.has(bootstrap.ownerUsername)) {
      this.users.set(bootstrap.ownerUsername, {
        userId: 'owner',
        username: bootstrap.ownerUsername,
        passwordHash: bootstrap.ownerPasswordHash,
        active: true
      });
    }
    if (this.devices.has(deviceId)) return;
    const createdAt = this.now().toISOString();
    this.devices.set(deviceId, {
      availability: null,
      telemetry: null,
      state: null,
      diagnostics: null,
      desired: {
        deviceId,
        version: 1,
        settings: clone(initialConfigSettings),
        messageId: `cfg-bootstrap-${randomUUID()}`,
        deliveryStatus: 'pending_delivery',
        reasonCode: 'stage14_volatile_bootstrap',
        createdAt,
        createdBy: 'server-bootstrap'
      },
      reported: null,
      alerts: new Map(),
      alertIdsByCause: new Map(),
      lightBuckets: new Map()
    });
  }

  async close(): Promise<void> {}

  async getOverview(deviceId: string): Promise<DeviceOverview> {
    const device = this.device(deviceId);
    const alerts = [...device.alerts.values()];
    return clone({
      deviceId,
      availability: device.availability,
      telemetry: device.telemetry,
      state: device.state,
      diagnostics: device.diagnostics,
      desiredConfig: device.desired,
      reportedConfig: device.reported,
      alerts,
      activeAlerts: alerts.filter((alert) => alert.active),
      storageMode: 'volatile_stage14'
    });
  }

  async rememberMessage(deviceId: string, messageId: string): Promise<boolean> {
    const key = `${deviceId}:${messageId}`;
    if (this.seenMessages.has(key)) return false;
    this.seenMessages.set(key, this.now().getTime());
    while (this.seenMessages.size > this.maximumSeenMessages) {
      const oldest = this.seenMessages.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.seenMessages.delete(oldest);
    }
    return true;
  }

  async saveAvailability(deviceId: string, value: ReceivedValue<AvailabilityData>): Promise<void> {
    this.device(deviceId).availability = clone(value);
  }

  async saveTelemetry(deviceId: string, value: ReceivedValue<TelemetryData>): Promise<void> {
    const device = this.device(deviceId);
    device.telemetry = clone(value);
    const bucketStart = Math.floor(Date.parse(value.receivedAt) / 60_000) * 60_000;
    let bucket = device.lightBuckets.get(bucketStart);
    if (!bucket) {
      bucket = {
        startedAt: bucketStart,
        sum: 0,
        minimum: Number.POSITIVE_INFINITY,
        maximum: Number.NEGATIVE_INFINITY,
        count: 0,
        invalidCount: 0
      };
      device.lightBuckets.set(bucketStart, bucket);
    }
    const light = value.data.light;
    if (light.quality === 'valid' && light.relative_pct !== null) {
      bucket.sum += light.relative_pct;
      bucket.minimum = Math.min(bucket.minimum, light.relative_pct);
      bucket.maximum = Math.max(bucket.maximum, light.relative_pct);
      bucket.count += 1;
    } else {
      bucket.invalidCount += 1;
    }
  }

  async saveReportedState(deviceId: string, value: ReceivedValue<ReportedStateData>): Promise<boolean> {
    const device = this.device(deviceId);
    if (device.state && (value.data.state_version === device.state.data.state_version || (value.data.state_version < device.state.data.state_version && device.state.source.linkSessionId === value.source.linkSessionId))) return false;
    device.state = clone(value);
    return true;
  }

  async saveDiagnostics(deviceId: string, value: ReceivedValue<DiagnosticsData>): Promise<void> {
    this.device(deviceId).diagnostics = clone(value);
  }

  async getDesiredConfig(deviceId: string): Promise<DesiredConfigRecord> {
    return clone(this.device(deviceId).desired);
  }

  async saveDesiredConfig(record: DesiredConfigRecord, outbox?: NewOutboxMessage): Promise<void> {
    const device = this.device(record.deviceId);
    if (record.version <= device.desired.version) {
      throw new Error('Phiên bản cấu hình mong muốn phải tăng đơn điệu.');
    }
    device.desired = clone(record);
    if (outbox) await this.enqueueOutbox(outbox);
  }

  async updateDesiredDelivery(
    deviceId: string,
    version: number,
    status: DesiredConfigRecord['deliveryStatus'],
    reasonCode: string
  ): Promise<void> {
    const desired = this.device(deviceId).desired;
    if (desired.version !== version) return;
    desired.deliveryStatus = status;
    desired.reasonCode = reasonCode;
  }

  async getReportedConfig(deviceId: string): Promise<ReportedConfigRecord | null> {
    return clone(this.device(deviceId).reported);
  }

  async saveReportedConfig(record: ReportedConfigRecord): Promise<boolean> {
    const device = this.device(record.deviceId);
    if (device.reported && record.data.config_version < device.reported.data.config_version) return false;
    device.reported = clone(record);
    return true;
  }

  async hasPendingCommand(deviceId: string): Promise<boolean> {
    return [...this.commands.values()].some((command) => command.deviceId === deviceId && command.status === 'pending');
  }

  async saveCommand(record: CommandRecord, outbox?: NewOutboxMessage): Promise<void> {
    if (this.commands.has(record.commandId)) throw new Error('Mã lệnh đã tồn tại.');
    this.commands.set(record.commandId, clone(record));
    if (outbox) await this.enqueueOutbox(outbox);
  }

  async markCommandPublished(commandId: string, publishedAt: string): Promise<void> {
    const command = this.commands.get(commandId);
    if (command && command.status === 'pending') command.publishedAt = publishedAt;
  }

  async getCommand(commandId: string): Promise<CommandRecord | null> {
    const command = this.commands.get(commandId);
    return command ? clone(command) : null;
  }

  async listPendingCommands(deviceId: string): Promise<CommandRecord[]> {
    return [...this.commands.values()]
      .filter((command) => command.deviceId === deviceId && command.status === 'pending')
      .map(clone);
  }

  async completeCommand(
    commandId: string,
    result: CommandResultData,
    resultAt: string,
    _resultMessageId: string | null
  ): Promise<CommandRecord | null> {
    const command = this.commands.get(commandId);
    if (!command) return null;
    if (command.status !== 'pending' && !(command.status === 'unknown' && result.result !== 'unknown')) {
      return clone(command);
    }
    command.status = result.result;
    command.reasonCode = result.reason_code;
    command.actualState = clone(result.actual_state);
    command.resultAt = resultAt;
    return clone(command);
  }

  async saveAlertEvent(
    deviceId: string,
    data: AlertEventData,
    receivedAt: string,
    _messageId: string,
    _sourceUnoBootId: number
  ): Promise<AlertRecord> {
    const device = this.device(deviceId);
    const record: AlertRecord = {
      alertId: data.alert_id,
      deviceId,
      causeId: data.cause_id,
      type: data.alert_type,
      severity: data.severity,
      source: data.source,
      lifecycle: data.lifecycle,
      active: data.active && data.operation !== 'clear',
      reasonCode: data.reason_code,
      detail: clone(data.detail),
      updatedAt: receivedAt
    };
    const priorId = device.alertIdsByCause.get(data.cause_id);
    if (priorId && priorId !== data.alert_id) device.alerts.delete(priorId);
    device.alertIdsByCause.set(data.cause_id, data.alert_id);
    device.alerts.set(data.alert_id, record);
    return clone(record);
  }

  async replaceAlertSnapshot(
    deviceId: string,
    data: AlertSnapshotData,
    receivedAt: string,
    _messageId: string,
    _sourceUnoBootId: number
  ): Promise<void> {
    const device = this.device(deviceId);
    const activeCauseIds = new Set(data.causes.map((cause) => cause.cause_id));
    for (const existing of device.alerts.values()) {
      if (!activeCauseIds.has(existing.causeId)) existing.active = false;
    }
    for (const cause of data.causes) {
      const alertId = device.alertIdsByCause.get(cause.cause_id) ?? `${deviceId}-snapshot-cause-${cause.cause_id}`;
      device.alertIdsByCause.set(cause.cause_id, alertId);
      device.alerts.set(alertId, {
        alertId,
        deviceId,
        causeId: cause.cause_id,
        type: cause.alert_type,
        severity: cause.severity,
        source: cause.source,
        lifecycle: data.lifecycle,
        active: true,
        reasonCode: cause.reason_code,
        detail: { detail_value: cause.detail_value, snapshot: true },
        updatedAt: receivedAt
      });
    }
  }

  async getAlert(deviceId: string, alertId: string): Promise<AlertRecord | null> {
    const alert = this.device(deviceId).alerts.get(alertId);
    return alert ? clone(alert) : null;
  }

  async listAlerts(deviceId: string): Promise<AlertRecord[]> {
    return [...this.device(deviceId).alerts.values()].map(clone);
  }

  async appendLog(record: SystemLogRecord): Promise<void> {
    this.logs.unshift(clone(record));
    if (this.logs.length > this.maximumLogs) this.logs.length = this.maximumLogs;
  }

  async getLogs(deviceId: string, query: LogQuery): Promise<LogPage> {
    let filtered = this.logs.filter((record) => record.deviceId === null || record.deviceId === deviceId);
    if (query.type) filtered = filtered.filter((record) => record.type === query.type);
    if (query.severity) filtered = filtered.filter((record) => record.severity === query.severity);
    if (query.from) filtered = filtered.filter((record) => record.createdAt >= query.from!);
    if (query.to) filtered = filtered.filter((record) => record.createdAt <= query.to!);
    if (query.cursor) {
      const cursorIndex = filtered.findIndex((record) => record.id === query.cursor);
      filtered = cursorIndex >= 0 ? filtered.slice(cursorIndex + 1) : [];
    }
    const items = filtered.slice(0, query.limit).map(clone);
    return {
      items,
      nextCursor: filtered.length > query.limit ? (items.at(-1)?.id ?? null) : null
    };
  }

  async getLightHistory(deviceId: string, from: string, to: string): Promise<HistoryPoint[]> {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    return [...this.device(deviceId).lightBuckets.values()]
      .filter((bucket) => bucket.startedAt >= fromMs && bucket.startedAt < toMs)
      .sort((left, right) => left.startedAt - right.startedAt)
      .map((bucket) => ({
        bucketStartUtc: new Date(bucket.startedAt).toISOString(),
        value: bucket.count > 0 ? Number((bucket.sum / bucket.count).toFixed(2)) : null,
        minimum: bucket.count > 0 ? bucket.minimum : null,
        maximum: bucket.count > 0 ? bucket.maximum : null,
        sampleCount: bucket.count,
        coverageQuality: bucket.count === 0 ? 'invalid' : bucket.invalidCount > 0 || bucket.count < 20 ? 'partial' : 'complete'
      }));
  }

  async getUserByUsername(username: string): Promise<UserCredential | null> {
    const user = this.users.get(username);
    return user ? clone(user) : null;
  }

  async updateLastLogin(_userId: string, _at: string): Promise<void> {}

  async saveSession(session: StoredWebSession): Promise<void> {
    this.sessions.set(session.sessionDigest, clone(session));
  }

  async getSession(sessionDigest: string): Promise<StoredWebSession | null> {
    const session = this.sessions.get(sessionDigest);
    return session ? clone(session) : null;
  }

  async touchSession(sessionDigest: string, at: string): Promise<void> {
    const session = this.sessions.get(sessionDigest);
    if (session) session.lastSeenAt = at;
  }

  async revokeSession(sessionDigest: string, at: string): Promise<void> {
    const session = this.sessions.get(sessionDigest);
    if (session) session.revokedAt = at;
  }

  async deleteExpiredSessions(at: string): Promise<number> {
    let deleted = 0;
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= at || session.revokedAt !== null) {
        this.sessions.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  async enqueueOutbox(message: NewOutboxMessage): Promise<void> {
    const existing = this.outbox.get(message.messageId);
    this.outbox.set(message.messageId, {
      ...clone(message),
      outboxId: existing?.outboxId ?? ++this.outboxSequence,
      status: 'pending',
      attemptCount: existing?.attemptCount ?? 0,
      publishedAt: null,
      lastError: null,
      createdAt: existing?.createdAt ?? this.now().toISOString()
    });
  }

  async listReadyOutbox(at: string, limit: number): Promise<OutboxRecord[]> {
    return [...this.outbox.values()]
      .filter((item) => item.status === 'pending' && item.availableAt <= at)
      .sort((left, right) => left.outboxId - right.outboxId)
      .slice(0, limit)
      .map(clone);
  }

  async markOutboxPublished(messageId: string, at: string): Promise<void> {
    const item = this.outbox.get(messageId);
    if (!item) return;
    item.status = 'published';
    item.publishedAt = at;
    item.lastError = null;
  }

  async markOutboxFailed(messageId: string, error: string, nextAttemptAt: string): Promise<void> {
    const item = this.outbox.get(messageId);
    if (!item) return;
    item.attemptCount += 1;
    item.lastError = error;
    item.availableAt = nextAttemptAt;
  }

  async markOutboxExpired(messageId: string, at: string): Promise<void> {
    const item = this.outbox.get(messageId);
    if (!item) return;
    item.status = 'expired';
    item.lastError = `expired_at:${at}`;
  }

  async saveSyncRequest(_record: SyncRunRecord, outbox: NewOutboxMessage): Promise<void> {
    await this.enqueueOutbox(outbox);
  }

  async completeSyncRun(
    _syncId: string,
    _result: string,
    _at: string,
    _details: Record<string, unknown>
  ): Promise<void> {}

  async runRetention(cutoff: string, _batchSize: number): Promise<RetentionResult> {
    const sessions = await this.deleteExpiredSessions(this.now().toISOString());
    return { cutoff, deleted: { web_sessions: sessions } };
  }

  private device(deviceId: string): DeviceMemory {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Thiết bị ${deviceId} chưa được khởi tạo.`);
    return device;
  }
}
