import type { AlertLifecycle, ConnectionState, ControlMode, DataQuality, RoomProfile, Severity } from '../types';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Chưa có';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? dateFormatter.format(timestamp) : 'Không hợp lệ';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const connectionLabels: Record<ConnectionState, string> = {
  online: 'Trực tuyến', syncing: 'Đang đồng bộ', degraded: 'Suy giảm', offline: 'Ngoại tuyến'
};
export const profileLabels: Record<RoomProfile, string> = { home: 'Ở nhà', away: 'Ra ngoài', night: 'Ban đêm' };
export const modeLabels: Record<ControlMode, string> = { auto: 'Tự động', manual: 'Thủ công' };
export const qualityLabels: Record<DataQuality, string> = { valid: 'Hợp lệ', stale: 'Dữ liệu cũ', invalid: 'Không hợp lệ' };
export const lifecycleLabels: Record<AlertLifecycle, string> = {
  normal: 'Bình thường', sounding: 'Đang kêu', muted: 'Đã tắt tiếng', awaiting_ack: 'Chờ xác nhận'
};
export const severityLabels: Record<Severity, string> = {
  info: 'Thông tin', notice: 'Chú ý', warning: 'Cảnh báo', critical: 'Nghiêm trọng'
};

export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'chưa có dữ liệu';
  const delta = now - Date.parse(value);
  if (!Number.isFinite(delta)) return 'thời điểm không hợp lệ';
  if (delta < 5_000) return 'vừa xong';
  if (delta < 60_000) return `${Math.floor(delta / 1000)} giây trước`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} phút trước`;
  return formatDateTime(value);
}

export function isStale(receivedAt: string | null | undefined, staleAfterSeconds: number, now = Date.now()): boolean {
  if (!receivedAt) return true;
  const time = Date.parse(receivedAt);
  return !Number.isFinite(time) || now - time > staleAfterSeconds * 1000;
}

export function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    link_ready: 'Liên kết đã sẵn sàng',
    not_seen: 'Chưa nhận dữ liệu',
    cause_cleared: 'Nguyên nhân đã hết',
    database_outbox_queued: 'Đã lưu, chờ gửi thiết bị',
    waiting_device_result: 'Đang chờ xác nhận thiết bị',
    device_result_timeout: 'Thiết bị chưa xác nhận đúng hạn'
  };
  return labels[reason] ?? reason.replaceAll('_', ' ');
}
