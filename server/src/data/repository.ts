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
  Severity,
  SystemLogRecord,
  TelemetryData
} from '../types/domain.js';

export interface RepositoryBootstrap {
  ownerUsername: string;
  ownerPasswordHash: string;
}

export interface UserCredential {
  userId: string;
  username: string;
  passwordHash: string;
  active: boolean;
}

export interface StoredWebSession {
  sessionDigest: string;
  userId: string;
  username: string;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export type OutboxKind = 'config' | 'command' | 'sync';
export type OutboxStatus = 'pending' | 'published' | 'expired';

export interface NewOutboxMessage {
  messageId: string;
  deviceId: string;
  topic: string;
  payload: string;
  qos: 0 | 1;
  retain: boolean;
  kind: OutboxKind;
  availableAt: string;
  expiresAt: string | null;
}

export interface OutboxRecord extends NewOutboxMessage {
  outboxId: number;
  status: OutboxStatus;
  attemptCount: number;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface SyncRunRecord {
  syncId: string;
  deviceId: string;
  reason: string;
  scopes: string[];
  startedAt: string;
}

export interface RetentionResult {
  cutoff: string;
  deleted: Record<string, number>;
}

export interface LogQuery {
  type?: SystemLogRecord['type'] | undefined;
  severity?: Severity | undefined;
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface LogPage {
  items: SystemLogRecord[];
  nextCursor: string | null;
}

export interface DataRepository {
  readonly storageMode: DeviceOverview['storageMode'];
  initialize(deviceId: string, bootstrap: RepositoryBootstrap): Promise<void>;
  close(): Promise<void>;
  getOverview(deviceId: string): Promise<DeviceOverview>;
  rememberMessage(deviceId: string, messageId: string): Promise<boolean>;

  saveAvailability(deviceId: string, value: ReceivedValue<AvailabilityData>): Promise<void>;
  saveTelemetry(deviceId: string, value: ReceivedValue<TelemetryData>): Promise<void>;
  saveReportedState(deviceId: string, value: ReceivedValue<ReportedStateData>): Promise<boolean>;
  saveDiagnostics(deviceId: string, value: ReceivedValue<DiagnosticsData>): Promise<void>;

  getDesiredConfig(deviceId: string): Promise<DesiredConfigRecord>;
  saveDesiredConfig(record: DesiredConfigRecord, outbox?: NewOutboxMessage): Promise<void>;
  updateDesiredDelivery(
    deviceId: string,
    version: number,
    status: DesiredConfigRecord['deliveryStatus'],
    reasonCode: string
  ): Promise<void>;
  getReportedConfig(deviceId: string): Promise<ReportedConfigRecord | null>;
  saveReportedConfig(record: ReportedConfigRecord): Promise<boolean>;

  hasPendingCommand(deviceId: string): Promise<boolean>;
  saveCommand(record: CommandRecord, outbox?: NewOutboxMessage): Promise<void>;
  markCommandPublished(commandId: string, publishedAt: string): Promise<void>;
  getCommand(commandId: string): Promise<CommandRecord | null>;
  listPendingCommands(deviceId: string): Promise<CommandRecord[]>;
  completeCommand(
    commandId: string,
    result: CommandResultData,
    resultAt: string,
    resultMessageId: string | null
  ): Promise<CommandRecord | null>;

  saveAlertEvent(
    deviceId: string,
    data: AlertEventData,
    receivedAt: string,
    messageId: string,
    sourceUnoBootId: number
  ): Promise<AlertRecord>;
  replaceAlertSnapshot(
    deviceId: string,
    data: AlertSnapshotData,
    receivedAt: string,
    messageId: string,
    sourceUnoBootId: number
  ): Promise<void>;
  getAlert(deviceId: string, alertId: string): Promise<AlertRecord | null>;
  listAlerts(deviceId: string): Promise<AlertRecord[]>;

  appendLog(record: SystemLogRecord): Promise<void>;
  getLogs(deviceId: string, query: LogQuery): Promise<LogPage>;
  getLightHistory(deviceId: string, from: string, to: string): Promise<HistoryPoint[]>;

  getUserByUsername(username: string): Promise<UserCredential | null>;
  updateLastLogin(userId: string, at: string): Promise<void>;
  saveSession(session: StoredWebSession): Promise<void>;
  getSession(sessionDigest: string): Promise<StoredWebSession | null>;
  touchSession(sessionDigest: string, at: string): Promise<void>;
  revokeSession(sessionDigest: string, at: string): Promise<void>;
  deleteExpiredSessions(at: string): Promise<number>;

  enqueueOutbox(message: NewOutboxMessage): Promise<void>;
  listReadyOutbox(at: string, limit: number): Promise<OutboxRecord[]>;
  markOutboxPublished(messageId: string, at: string): Promise<void>;
  markOutboxFailed(messageId: string, error: string, nextAttemptAt: string): Promise<void>;
  markOutboxExpired(messageId: string, at: string): Promise<void>;
  saveSyncRequest(record: SyncRunRecord, outbox: NewOutboxMessage): Promise<void>;
  completeSyncRun(syncId: string, result: string, at: string, details: Record<string, unknown>): Promise<void>;
  runRetention(cutoff: string, batchSize: number): Promise<RetentionResult>;
}

/**
 * Cổng này giữ dịch vụ độc lập với SQLite cụ thể. MemoryRepository chỉ còn phục vụ
 * kiểm thử cô lập; triển khai mặc định từ Giai đoạn 15 là SQLiteRepository.
 */
export interface RepositoryFactory {
  create(): DataRepository;
}
