import type {
  AlertRecord,
  AvailabilityData,
  OverviewResponse,
  RealtimeEventName,
  ReceivedValue,
  ReportedStateData,
  SourceMetadata,
  TelemetryData
} from '../types';

const fallbackSource: SourceMetadata = {
  sentAt: null,
  timeQuality: 'unsynced',
  espBootId: 0,
  unoBootId: 0,
  linkSessionId: 0
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function received<T>(data: T, raw: Record<string, unknown>, prior: ReceivedValue<T> | null): ReceivedValue<T> {
  return {
    data,
    messageId: prior?.messageId ?? null,
    receivedAt: typeof raw.received_at === 'string' ? raw.received_at : new Date().toISOString(),
    retained: false,
    source: prior?.source ?? fallbackSource
  };
}

export function mergeRealtimeOverview(
  current: OverviewResponse | null,
  name: RealtimeEventName,
  rawValue: unknown
): OverviewResponse | null {
  const raw = record(rawValue);
  if (!raw) return current;
  if (name === 'state.updated' && raw.snapshot === true) {
    const overview = record(raw.overview);
    if (!overview) return current;
    return {
      server_time: new Date().toISOString(),
      stale_after_seconds: current?.stale_after_seconds ?? 15,
      overview: raw.overview as OverviewResponse['overview']
    };
  }
  if (!current) return null;
  const next = structuredClone(current);
  next.server_time = new Date().toISOString();
  if (name === 'telemetry.updated') {
    const { received_at: _receivedAt, ...data } = raw;
    next.overview.telemetry = received(data as unknown as TelemetryData, raw, next.overview.telemetry);
  } else if (name === 'availability.updated') {
    const { received_at: _receivedAt, ...data } = raw;
    next.overview.availability = received(data as unknown as AvailabilityData, raw, next.overview.availability);
  } else if (name === 'state.updated') {
    const incoming = raw as unknown as ReportedStateData & { received_at?: string };
    const currentVersion = next.overview.state?.data.state_version ?? -1;
    if (incoming.state_version < currentVersion) return current;
    const { received_at: _receivedAt, ...data } = incoming;
    next.overview.state = received(data, raw, next.overview.state);
  } else if (name === 'alert.updated') {
    if (Array.isArray(raw.alerts)) next.overview.alerts = raw.alerts as AlertRecord[];
    if (Array.isArray(raw.active_alerts)) next.overview.activeAlerts = raw.active_alerts as AlertRecord[];
    if (raw.alert && !Array.isArray(raw.alerts)) {
      const alert = raw.alert as AlertRecord;
      next.overview.alerts = [alert, ...next.overview.alerts.filter((item) => item.alertId !== alert.alertId)];
      next.overview.activeAlerts = next.overview.alerts.filter((item) => item.active);
    }
  }
  return next;
}
