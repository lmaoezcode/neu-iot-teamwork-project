import { historySegments } from '../domain/history';
import {
  connectionLabels,
  escapeHtml,
  formatDateTime,
  isStale,
  lifecycleLabels,
  modeLabels,
  profileLabels,
  qualityLabels,
  reasonLabel,
  relativeTime,
  severityLabels
} from '../domain/format';
import { routeLabel, routes } from '../router';
import type {
  AlertRecord,
  AppRoute,
  AppState,
  ConfigSettings,
  DataQuality,
  HistoryPoint,
  SystemLogRecord
} from '../types';

function selected(value: string, current: string): string {
  return value === current ? ' selected' : '';
}

function checked(value: boolean): string {
  return value ? ' checked' : '';
}

function disabled(value: boolean): string {
  return value ? ' disabled' : '';
}

function statusPill(label: string, tone: string): string {
  return `<span class="status-pill status-${escapeHtml(tone)}"><span aria-hidden="true" class="status-dot"></span>${escapeHtml(label)}</span>`;
}

function pageHeading(kicker: string, title: string, description: string): string {
  return `<header class="page-heading">
    <p class="eyebrow">${escapeHtml(kicker)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
  </header>`;
}

function emptyState(title: string, text: string): string {
  return `<div class="empty-state"><span aria-hidden="true">○</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

function qualityTone(quality: DataQuality | undefined, stale: boolean): string {
  if (stale || quality === 'stale') return 'warning';
  if (quality === 'invalid') return 'danger';
  return quality === 'valid' ? 'success' : 'neutral';
}

function freshness(receivedAt: string | undefined, staleAfter: number): string {
  const stale = isStale(receivedAt, staleAfter);
  return `<span class="freshness ${stale ? 'is-stale' : ''}" data-received-at="${escapeHtml(receivedAt ?? '')}" data-stale-after="${staleAfter}">
    ${stale ? 'Dữ liệu cũ' : 'Cập nhật'} · ${escapeHtml(relativeTime(receivedAt))}
  </span>`;
}

function sensorCard(options: {
  title: string;
  value: string;
  detail: string;
  quality: DataQuality | undefined;
  receivedAt: string | undefined;
  staleAfter: number;
  symbol: string;
  warning?: string;
}): string {
  const stale = isStale(options.receivedAt, options.staleAfter);
  const tone = qualityTone(options.quality, stale);
  const label = stale ? 'Dữ liệu cũ' : options.quality ? qualityLabels[options.quality] : 'Chưa có dữ liệu';
  return `<article class="metric-card tone-${tone}">
    <div class="metric-top"><span class="metric-symbol" aria-hidden="true">${escapeHtml(options.symbol)}</span>${statusPill(label, tone)}</div>
    <h3>${escapeHtml(options.title)}</h3>
    <p class="metric-value">${escapeHtml(options.value)}</p>
    <p class="metric-detail">${escapeHtml(options.detail)}</p>
    ${options.warning ? `<p class="inline-warning">${escapeHtml(options.warning)}</p>` : ''}
    ${freshness(options.receivedAt, options.staleAfter)}
  </article>`;
}

function outputCard(title: string, value: string, source: string, mode: 'real' | 'simulated', extra = ''): string {
  return `<article class="output-card">
    <div class="output-card-title"><h3>${escapeHtml(title)}</h3><span class="hardware-label ${mode}">${mode === 'real' ? 'PHẦN CỨNG THẬT' : 'MÔ PHỎNG'}</span></div>
    <p class="output-value">${escapeHtml(value)}</p>
    <p>Nguồn điều khiển: <strong>${escapeHtml(source || 'Chưa xác định')}</strong></p>
    ${extra ? `<p class="muted">${escapeHtml(extra)}</p>` : ''}
  </article>`;
}

function renderRecentLogs(logs: SystemLogRecord[] | undefined): string {
  if (!logs?.length) return emptyState('Chưa có nhật ký', 'Các sự kiện có ý nghĩa sẽ xuất hiện tại đây.');
  return `<ol class="timeline">${logs.slice(0, 6).map((log) => `<li>
    <span class="timeline-mark severity-${escapeHtml(log.severity)}" aria-hidden="true"></span>
    <div><strong>${escapeHtml(log.message)}</strong><p>${escapeHtml(formatDateTime(log.createdAt))} · ${escapeHtml(log.source)}</p></div>
  </li>`).join('')}</ol>`;
}

function renderOverview(state: Readonly<AppState>): string {
  const response = state.overview;
  const overview = response?.overview;
  const telemetry = overview?.telemetry;
  const deviceState = overview?.state?.data;
  const staleAfter = response?.stale_after_seconds ?? 15;
  const receivedAt = telemetry?.receivedAt;
  const light = telemetry?.data.light;
  const door = telemetry?.data.door_zone;
  const mq2 = telemetry?.data.mq2;
  const flame = telemetry?.data.flame;
  const lightValue = light?.relative_pct === null || light?.relative_pct === undefined ? '—' : `${Math.round(light.relative_pct)}%`;
  const doorLabel = door?.state === 'clear' ? 'Vùng trống' : door?.state === 'object_detected' ? 'Có đối tượng' : 'Không xác định';
  const mq2Label = mq2?.state === 'warming' ? 'Đang làm nóng' : mq2?.state === 'normal' ? 'Bình thường' : mq2?.state === 'alert' ? 'Cảnh báo' : mq2?.state === 'sensor_fault' ? 'Lỗi cảm biến' : '—';
  const flameLabel = flame?.state === 'normal' ? 'Bình thường' : flame?.state === 'alert' ? 'Cảnh báo' : flame?.state === 'sensor_fault' ? 'Lỗi cảm biến' : '—';
  const logs = state.logs?.items;
  return `${pageHeading('BẢNG ĐIỀU KHIỂN', 'Tổng quan phòng', 'Theo dõi cảm biến, đầu ra và cảnh báo từ một nơi.')}
    <section class="summary-strip" aria-label="Trạng thái phòng hiện tại">
      <div><span>Hồ sơ</span><strong>${deviceState ? profileLabels[deviceState.room_profile] : 'Chưa có'}</strong></div>
      <div><span>Phương thức</span><strong>${deviceState ? modeLabels[deviceState.control_mode] : 'Chưa có'}</strong></div>
      <div><span>Phiên bản trạng thái</span><strong>${deviceState?.state_version ?? '—'}</strong></div>
      <div><span>Lưu trữ</span><strong>${overview?.storageMode === 'sqlite' ? 'SQLite bền vững' : 'Bộ nhớ tạm'}</strong></div>
    </section>
    <section class="metric-grid" aria-label="Dữ liệu cảm biến">
      ${sensorCard({ title: 'Mức sáng', value: lightValue, detail: light?.adc === null || light?.adc === undefined ? 'ADC chưa có' : `ADC ${light.adc}`, quality: light?.quality, receivedAt, staleAfter, symbol: '☼' })}
      ${sensorCard({ title: 'Vùng cửa', value: doorLabel, detail: door?.distance_mm === null || door?.distance_mm === undefined ? 'Khoảng cách chưa có' : `${door.distance_mm} mm`, quality: door?.quality, receivedAt, staleAfter, symbol: '⌁', warning: 'Không phải trạng thái đóng/mở của cánh cửa.' })}
      ${sensorCard({ title: 'MQ-2 tương đối', value: mq2?.relative_pct === null || mq2?.relative_pct === undefined ? mq2Label : `${Math.round(mq2.relative_pct)}%`, detail: mq2Label, quality: mq2?.quality, receivedAt, staleAfter, symbol: '◎', warning: 'Giá trị tương đối, không phải ppm.' })}
      ${sensorCard({ title: 'Cảm biến lửa', value: flameLabel, detail: flame?.raw === null || flame?.raw === undefined ? 'Tín hiệu chưa có' : `Tín hiệu số ${flame.raw}`, quality: flame?.quality, receivedAt, staleAfter, symbol: '△' })}
    </section>
    <div class="content-grid two-one">
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">ĐẦU RA</p><h2>Thiết bị và trạng thái báo cáo</h2></div><a href="/dieu-khien" data-route class="text-link">Điều khiển</a></div>
        <div class="output-grid">
          ${outputCard('Đèn', deviceState ? (deviceState.outputs.lamp.on ? 'Bật' : 'Tắt') : 'Chưa có', deviceState?.outputs.lamp.source ?? '', 'real')}
          ${outputCard('Quạt', deviceState ? (deviceState.outputs.fan.on ? 'Bật logic' : 'Tắt') : 'Chưa có', deviceState?.outputs.fan.source ?? '', 'simulated', 'Không suy ra động cơ đang quay.')}
          ${outputCard('Khóa', deviceState ? (deviceState.outputs.lock.command === 'locked' ? 'Lệnh khóa' : deviceState.outputs.lock.command === 'unlocked' ? 'Lệnh mở' : 'Không xác định') : 'Chưa có', 'Trạng thái lệnh', 'simulated', 'Chưa xác minh cơ khí.')}
        </div>
      </section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">NHẬT KÝ</p><h2>Gần đây</h2></div><a href="/nhat-ky" data-route class="text-link">Xem tất cả</a></div>${renderRecentLogs(logs)}</section>
    </div>`;
}

function commandStatus(state: Readonly<AppState>): string {
  const command = state.pendingCommand;
  if (!command) return '<p class="muted">Không có lệnh đang chờ.</p>';
  const labels: Record<string, string> = {
    pending: 'Đang chờ ACK', applied: 'Đã áp dụng', duplicate_ok: 'Đã áp dụng',
    rejected: 'Bị từ chối', expired: 'Đã hết hạn', unknown: 'Không xác định — đang đồng bộ'
  };
  const tone = command.status === 'pending' ? 'warning' : command.status === 'applied' || command.status === 'duplicate_ok' ? 'success' : 'danger';
  return `<div class="command-status tone-${tone}" role="status">
    ${statusPill(labels[command.status] ?? command.status, tone)}
    <div><strong>${escapeHtml(command.request.target)} · ${escapeHtml(command.request.value)}</strong><p>Mã ${escapeHtml(command.commandId)} · ${escapeHtml(reasonLabel(command.reasonCode))}</p></div>
  </div>`;
}

function renderDeviceControl(
  state: Readonly<AppState>,
  target: 'lamp' | 'fan',
  title: string,
  simulated: boolean
): string {
  const deviceState = state.overview?.overview.state?.data;
  const output = target === 'lamp' ? deviceState?.outputs.lamp : deviceState?.outputs.fan;
  const online = state.overview?.overview.availability?.data.status === 'online' && state.serverReachable;
  const away = deviceState?.room_profile === 'away';
  const blocked = !online || away || state.pendingCommand?.status === 'pending';
  const reason = !online ? 'Thiết bị chưa Trực tuyến.' : away ? 'Ra ngoài đang cưỡng chế tắt tiện nghi.' : '';
  return `<article class="control-card">
    <div class="output-card-title"><div><p class="eyebrow">${target === 'lamp' ? 'CHIẾU SÁNG' : 'TIỆN NGHI'}</p><h2>${escapeHtml(title)}</h2></div><span class="hardware-label ${simulated ? 'simulated' : 'real'}">${simulated ? 'MÔ PHỎNG' : 'PHẦN CỨNG THẬT'}</span></div>
    <p class="control-value">${output ? (output.on ? 'Bật' : 'Tắt') : 'Chưa có trạng thái'}</p>
    <p>Nguồn: <strong>${escapeHtml(output?.source ?? 'Chưa xác định')}</strong></p>
    ${simulated ? '<p class="inline-warning">Chỉ là trạng thái logic/LED mô phỏng; không khẳng định động cơ quay.</p>' : ''}
    <div class="segmented-actions" aria-label="Điều khiển đặt trạng thái">
      <button type="button" class="button primary" data-action="device" data-target="${target}" data-value="on"${disabled(blocked)}>Bật</button>
      <button type="button" class="button secondary" data-action="device" data-target="${target}" data-value="off"${disabled(blocked)}>Tắt</button>
    </div>
    ${reason ? `<p class="disabled-reason">${escapeHtml(reason)}</p>` : ''}
  </article>`;
}

function renderControl(state: Readonly<AppState>): string {
  const deviceState = state.overview?.overview.state?.data;
  const online = state.overview?.overview.availability?.data.status === 'online' && state.serverReachable;
  const securityActive = state.overview?.overview.activeAlerts.some((alert) => alert.type === 'security') ?? false;
  const busy = state.pendingCommand?.status === 'pending';
  return `${pageHeading('ĐIỀU KHIỂN', 'Điều khiển thiết bị', 'Đặt trạng thái rõ ràng và chỉ cập nhật sau xác nhận từ thiết bị.')}
    <section class="panel mode-panel">
      <div><p class="eyebrow">PHƯƠNG THỨC TIỆN NGHI</p><h2>${deviceState ? modeLabels[deviceState.control_mode] : 'Chưa có trạng thái'}</h2><p>Tự động dùng ngưỡng ánh sáng; Thủ công giữ lệnh người dùng cho tới khi đổi phương thức hoặc Ra ngoài cưỡng chế.</p></div>
      <div class="segmented-actions">
        <button type="button" class="button ${deviceState?.control_mode === 'auto' ? 'selected' : 'secondary'}" data-action="mode" data-value="auto"${disabled(!online || busy)}>Tự động</button>
        <button type="button" class="button ${deviceState?.control_mode === 'manual' ? 'selected' : 'secondary'}" data-action="mode" data-value="manual"${disabled(!online || busy)}>Thủ công</button>
      </div>
    </section>
    <div class="control-grid">
      ${renderDeviceControl(state, 'lamp', 'Đèn phòng', false)}
      ${renderDeviceControl(state, 'fan', 'Quạt', true)}
      <article class="control-card">
        <div class="output-card-title"><div><p class="eyebrow">TRUY CẬP</p><h2>Khóa phòng</h2></div><span class="hardware-label simulated">MÔ PHỎNG</span></div>
        <p class="control-value">${deviceState?.outputs.lock.command === 'locked' ? 'Lệnh khóa' : deviceState?.outputs.lock.command === 'unlocked' ? 'Lệnh mở' : 'Không xác định'}</p>
        <p class="inline-warning">Chưa xác minh cơ khí; không có servo/chốt đang hoạt động.</p>
        <div class="segmented-actions">
          <button type="button" class="button primary" data-action="lock" data-value="locked"${disabled(!online || busy)}>Khóa mô phỏng</button>
          <button type="button" class="button secondary" data-action="lock" data-value="unlocked"${disabled(!online || busy || securityActive)}>Mở mô phỏng</button>
        </div>
        ${securityActive ? '<p class="disabled-reason">Cảnh báo an ninh đang hoạt động nên lệnh mở bị chặn.</p>' : ''}
      </article>
    </div>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">TRẠNG THÁI LỆNH</p><h2>Phản hồi gần nhất</h2></div></div>${commandStatus(state)}</section>`;
}

const profileDescriptions = {
  home: ['Ở nhà', 'Tiện nghi theo Tự động hoặc Thủ công.', 'Cửa không tự mở; phương thức trước đó được giữ.'],
  away: ['Ra ngoài', 'Cưỡng chế tắt đèn/quạt và trang bị vùng cửa.', 'Khóa mô phỏng; từ chối lệnh bật tiện nghi.'],
  night: ['Ban đêm', 'Giữ phương thức tiện nghi và bảo vệ vùng cửa.', 'Hoạt động bên trong ngoài vùng cửa không gây báo động.']
} as const;

function renderRoomProfile(state: Readonly<AppState>): string {
  const current = state.overview?.overview.state?.data.room_profile;
  const online = state.overview?.overview.availability?.data.status === 'online' && state.serverReachable;
  const busy = state.pendingCommand?.status === 'pending';
  return `${pageHeading('HỒ SƠ PHÒNG', 'Trạng thái sử dụng phòng', 'Chọn bối cảnh vận hành; đây là ràng buộc liên tục, không phải cảnh thiết lập một lần.')}
    <div class="profile-grid">${(['home', 'away', 'night'] as const).map((profile) => {
      const [name, summary, impact] = profileDescriptions[profile];
      return `<article class="profile-card ${current === profile ? 'is-current' : ''}">
        <div class="profile-icon" aria-hidden="true">${profile === 'home' ? '⌂' : profile === 'away' ? '→' : '☾'}</div>
        <div>${current === profile ? statusPill('Đang áp dụng', 'success') : ''}<h2>${name}</h2><p>${summary}</p><div class="impact-box"><strong>Tác động</strong><p>${impact}</p></div></div>
        <button type="button" class="button ${current === profile ? 'secondary' : 'primary'}" data-action="profile" data-value="${profile}"${disabled(!online || busy || current === profile)}>${current === profile ? 'Đang sử dụng' : `Chuyển sang ${name}`}</button>
      </article>`;
    }).join('')}</div>
    <section class="panel policy-note"><div class="metric-symbol" aria-hidden="true">i</div><div><h2>Quy tắc khi trở về Ở nhà</h2><p>Nếu đang Thủ công, đèn và quạt tiếp tục tắt đến khi có lệnh mới. Nếu đang Tự động, thiết bị đánh giá lại dữ liệu hợp lệ. Khóa không tự mở.</p></div></section>
    <section class="panel">${commandStatus(state)}</section>`;
}

function configStatus(state: Readonly<AppState>): string {
  const config = state.config;
  if (!config) return emptyState('Chưa tải được cấu hình', 'Kiểm tra kết nối máy chủ rồi thử lại.');
  const desired = config.desired;
  const reportedVersion = config.reported?.data.config_version;
  const synchronized = reportedVersion === desired.version && ['applied', 'unchanged'].includes(config.reported?.data.apply_result ?? '');
  return `<div class="config-status-grid">
    <div><span>Cấu hình mong muốn</span><strong>Phiên bản ${desired.version}</strong><small>${escapeHtml(reasonLabel(desired.reasonCode))}</small></div>
    <div><span>Cấu hình báo cáo</span><strong>${reportedVersion === undefined ? 'Chưa có' : `Phiên bản ${reportedVersion}`}</strong><small>${escapeHtml(config.reported?.data.apply_result ?? 'Chờ thiết bị')}</small></div>
    <div>${statusPill(synchronized ? 'Đã đồng bộ' : 'Chờ thiết bị áp dụng', synchronized ? 'success' : 'warning')}</div>
  </div>`;
}

function configValues(state: Readonly<AppState>): ConfigSettings | null {
  return state.configDraft ?? state.config?.desired.settings ?? null;
}

function renderSettings(state: Readonly<AppState>): string {
  const settings = configValues(state);
  if (!settings) return `${pageHeading('TỰ ĐỘNG HÓA', 'Cài đặt tự động', 'Ngưỡng được lưu trên máy chủ và đồng bộ xuống thiết bị.')}${emptyState('Không tải được cấu hình', 'Hãy kiểm tra phiên và kết nối máy chủ.')}`;
  return `${pageHeading('TỰ ĐỘNG HÓA', 'Cài đặt tự động', 'Điều chỉnh vùng trễ ánh sáng mà không sửa firmware.')}
    <section class="panel">${configStatus(state)}</section>
    <form id="light-config-form" class="panel form-panel" novalidate>
      <div class="panel-heading"><div><p class="eyebrow">ĐÈN TỰ ĐỘNG</p><h2>Ngưỡng và vùng trễ</h2></div>${state.configDirty ? statusPill('Có thay đổi chưa lưu', 'warning') : ''}</div>
      <div class="form-grid">
        <label><span>Ngưỡng bật đèn</span><input name="light_on_pct" type="number" min="0" max="80" step="1" value="${settings.light_on_pct}" required><small>0% là tối nhất; cho phép 0–80%.</small></label>
        <label><span>Ngưỡng tắt đèn</span><input name="light_off_pct" type="number" min="20" max="100" step="1" value="${settings.light_off_pct}" required><small>Cao hơn ngưỡng bật ít nhất 5 điểm.</small></label>
        <label><span>Thời gian giữ tối thiểu</span><input type="text" value="10 giây" disabled><small>Thông số kỹ thuật cố định.</small></label>
      </div>
      <fieldset>
        <legend>Hiệu chuẩn quang trở</legend>
        <label class="check-row"><input name="light_calibration_enabled" type="checkbox"${checked(settings.light_calibration.enabled)}><span>Dùng hai mốc ADC hiệu chuẩn</span></label>
        <div class="form-grid two">
          <label><span>Mốc tối (ADC)</span><input name="light_dark_adc" type="number" min="0" max="1023" step="1" value="${settings.light_calibration.dark_adc}" required></label>
          <label><span>Mốc sáng (ADC)</span><input name="light_bright_adc" type="number" min="0" max="1023" step="1" value="${settings.light_calibration.bright_adc}" required></label>
        </div>
      </fieldset>
      <div class="form-actions"><button type="submit" class="button primary"${disabled(!state.serverReachable || state.pageLoading)}>Lưu cấu hình</button><button type="button" class="button secondary" data-action="reset-config">Khôi phục giá trị đã lưu</button></div>
    </form>
    <section class="panel policy-note"><div class="metric-symbol" aria-hidden="true">!</div><div><h2>MQ-2 thuộc chế độ bảo trì</h2><p>Ngưỡng MQ-2 là mức tương đối và không thể vô hiệu hóa phân hệ an toàn.</p><a href="/an-ninh-an-toan#bao-tri" data-route class="text-link">Mở Bảo trì/Hiệu chuẩn an toàn</a></div></section>`;
}

function alertCard(alert: AlertRecord, noActiveCauses: boolean): string {
  const tone = alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral';
  const canAck = !alert.active && alert.lifecycle === 'awaiting_ack' && noActiveCauses;
  return `<article class="alert-card tone-${tone}">
    <div class="alert-card-main"><div>${statusPill(severityLabels[alert.severity], tone)}<h3>${escapeHtml(alert.source)}</h3><p>${escapeHtml(reasonLabel(alert.reasonCode))}</p></div><div class="alert-meta"><span>${escapeHtml(lifecycleLabels[alert.lifecycle])}</span><span>${escapeHtml(formatDateTime(alert.updatedAt))}</span></div></div>
    <div class="alert-actions">
      ${alert.active ? `<button type="button" class="button secondary" data-action="alert-mute" data-alert-id="${escapeHtml(alert.alertId)}">Tắt tiếng</button>` : ''}
      <button type="button" class="button primary" data-action="alert-ack" data-alert-id="${escapeHtml(alert.alertId)}"${disabled(!canAck)}>Xác nhận</button>
    </div>
    ${alert.active ? '<p class="disabled-reason">Xác nhận chỉ khả dụng khi mọi nguyên nhân đã hết.</p>' : ''}
  </article>`;
}

function renderSecurity(state: Readonly<AppState>): string {
  const overview = state.overview?.overview;
  const telemetry = overview?.telemetry;
  const reportedState = overview?.state?.data;
  const settings = configValues(state);
  const alerts = overview?.alerts ?? overview?.activeAlerts ?? [];
  const active = overview?.activeAlerts ?? [];
  const mq2 = telemetry?.data.mq2;
  const flame = telemetry?.data.flame;
  const door = telemetry?.data.door_zone;
  const permission = state.notificationPermission;
  return `${pageHeading('BẢO VỆ PHÒNG', 'An ninh & An toàn', 'Theo dõi vùng cửa, cảnh báo an toàn và vòng đời từng nguyên nhân.')}
    <div class="security-grid">
      <section class="panel security-card"><p class="eyebrow">VÙNG CỬA · SRF04</p><h2>${door?.state === 'object_detected' ? 'Phát hiện đối tượng' : door?.state === 'clear' ? 'Vùng trống' : 'Không xác định'}</h2><p>${door?.distance_mm === null || door?.distance_mm === undefined ? 'Chưa có khoảng cách' : `${door.distance_mm} mm`} · ${door ? qualityLabels[door.quality] : 'Chưa có dữ liệu'}</p><p class="inline-warning">Đây không phải trạng thái đóng/mở cánh cửa.</p><p>Trang bị bảo vệ: <strong>${reportedState?.security.door_zone_armed ? 'Đang bật' : 'Đang tắt'}</strong></p></section>
      <section class="panel security-card"><p class="eyebrow">KHÓA TRUY CẬP</p><div class="output-card-title"><h2>${reportedState?.outputs.lock.command === 'locked' ? 'Lệnh khóa' : reportedState?.outputs.lock.command === 'unlocked' ? 'Lệnh mở' : 'Không xác định'}</h2><span class="hardware-label simulated">MÔ PHỎNG</span></div><p>Xác minh cơ khí: <strong>Chưa có</strong></p><p class="inline-warning">Không có servo/chốt đang hoạt động trong sản phẩm 1.2.</p><a href="/dieu-khien" data-route class="text-link">Tới điều khiển khóa</a></section>
      <section class="panel security-card"><p class="eyebrow">CẢNH BÁO CỤC BỘ</p><h2>${reportedState?.alarm_output.led ? 'LED đang cảnh báo' : 'LED bình thường'}</h2><p>Còi: <strong>${reportedState?.alarm_output.buzzer_available ? (reportedState.alarm_output.buzzer ? 'Đang kêu' : 'Sẵn sàng') : 'Không khả dụng'}</strong></p>${!reportedState?.alarm_output.buzzer_available ? '<p class="inline-warning">Còi chưa qua cổng phần cứng; LED vẫn là đầu ra cảnh báo.</p>' : ''}</section>
    </div>
    <div class="content-grid two-one">
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">AN TOÀN</p><h2>Cảm biến môi trường nguy cơ</h2></div></div>
        <div class="safety-readouts">
          <div><span>MQ-2</span><strong>${mq2?.state === 'warming' ? 'Đang làm nóng' : mq2?.state === 'normal' ? 'Bình thường' : mq2?.state === 'alert' ? 'Cảnh báo' : mq2?.state === 'sensor_fault' ? 'Lỗi cảm biến' : 'Chưa có'}</strong><small>${mq2?.relative_pct === null || mq2?.relative_pct === undefined ? 'Chưa có mức tương đối' : `${Math.round(mq2.relative_pct)}% tương đối`} · không phải ppm</small></div>
          <div><span>Cảm biến lửa</span><strong>${flame?.state === 'normal' ? 'Bình thường' : flame?.state === 'alert' ? 'Dấu hiệu lửa — Cảnh báo' : flame?.state === 'sensor_fault' ? 'Lỗi cảm biến' : 'Chưa có'}</strong><small>Không phải thiết bị báo cháy thương mại</small></div>
        </div>
      </section>
      <section class="panel"><p class="eyebrow">THÔNG BÁO TRÌNH DUYỆT</p><h2>${permission === 'granted' ? 'Đã cho phép' : permission === 'denied' ? 'Đã từ chối' : permission === 'unsupported' ? 'Không được hỗ trợ' : 'Chưa cấp quyền'}</h2><p>Cảnh báo trong ứng dụng luôn hoạt động, không phụ thuộc quyền này.</p><button type="button" class="button secondary" data-action="notification-permission"${disabled(permission === 'unsupported' || permission === 'granted')}>Cho phép thông báo</button></section>
    </div>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">VÒNG ĐỜI CẢNH BÁO</p><h2>${alerts.length ? `${alerts.length} nguyên nhân đã ghi nhận` : 'Không có cảnh báo'}</h2></div></div>
      <div class="alert-list">${alerts.length ? alerts.map((alert) => alertCard(alert, active.length === 0)).join('') : emptyState('Bình thường', 'Không có nguyên nhân cảnh báo đang hoạt động hoặc chờ xác nhận.')}</div>
    </section>
    <details id="bao-tri" class="panel maintenance-panel">
      <summary><span><span class="eyebrow">BẢO TRÌ / HIỆU CHUẨN</span><strong>Cấu hình MQ-2 tương đối</strong></span><span aria-hidden="true">＋</span></summary>
      <div class="maintenance-warning"><strong>Cảnh báo kỹ thuật</strong><p>Thông số chỉ phục vụ mô hình giáo dục. Không có nút vô hiệu hóa cảnh báo an toàn và không được diễn giải thành ppm.</p></div>
      ${settings ? `<form id="mq2-config-form" novalidate><div class="form-grid three">
        <label><span>Mốc nền ADC</span><input name="mq2_baseline_adc" type="number" min="0" max="1023" value="${settings.mq2.baseline_adc}" required></label>
        <label><span>Khoảng ADC</span><input name="mq2_span_adc" type="number" min="1" max="1023" value="${settings.mq2.span_adc}" required></label>
        <label><span>Ngưỡng tương đối</span><input name="mq2_threshold_pct" type="number" min="0" max="100" value="${settings.mq2.threshold_pct}" required></label>
      </div><label class="check-row"><input name="mq2_calibration_enabled" type="checkbox"${checked(settings.mq2.calibration_enabled)}><span>Dùng mốc hiệu chuẩn đã nhập</span></label><div class="form-actions"><button class="button primary" type="submit">Lưu cấu hình bảo trì</button></div></form>` : '<p>Chưa tải được cấu hình.</p>'}
    </details>`;
}

function chart(points: HistoryPoint[], from: string, to: string): string {
  const usable = points.filter((point) => point.value !== null && point.coverageQuality !== 'invalid');
  if (!usable.length) return emptyState('Chưa có dữ liệu', 'Không có mẫu mức sáng trong khoảng đã chọn. Khoảng trống không được nội suy.');
  const width = 900;
  const height = 300;
  const padding = { left: 54, right: 22, top: 22, bottom: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const start = Date.parse(from);
  const end = Date.parse(to);
  const x = (value: string) => padding.left + ((Date.parse(value) - start) / Math.max(end - start, 1)) * plotWidth;
  const y = (value: number) => padding.top + (1 - value / 100) * plotHeight;
  const segments = historySegments(points);
  const lines = segments.map((segment) => `<path d="${segment.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.bucketStartUtc).toFixed(2)} ${y(point.value!).toFixed(2)}`).join(' ')}" />`).join('');
  const dots = usable.map((point) => `<circle class="${point.coverageQuality === 'partial' ? 'partial' : ''}" cx="${x(point.bucketStartUtc).toFixed(2)}" cy="${y(point.value!).toFixed(2)}" r="3"><title>${escapeHtml(formatDateTime(point.bucketStartUtc))}: ${point.value?.toFixed(1)}%, ${point.sampleCount} mẫu</title></circle>`).join('');
  const grid = [0, 25, 50, 75, 100].map((value) => `<g><line x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}"/><text x="${padding.left - 12}" y="${y(value) + 4}" text-anchor="end">${value}%</text></g>`).join('');
  return `<div class="chart-wrap"><svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description">
    <title id="chart-title">Biểu đồ mức sáng</title><desc id="chart-description">Đường bị ngắt tại các khoảng thiếu dữ liệu; chấm rỗng biểu thị mẫu một phần.</desc>
    <g class="chart-grid">${grid}</g><g class="chart-lines">${lines}</g><g class="chart-dots">${dots}</g>
    <text class="axis-label" x="${padding.left}" y="${height - 10}">${escapeHtml(formatDateTime(from))}</text><text class="axis-label" x="${width - padding.right}" y="${height - 10}" text-anchor="end">${escapeHtml(formatDateTime(to))}</text>
  </svg></div>
  <div class="chart-legend"><span><i class="legend-line"></i>Mức sáng</span><span><i class="legend-dot"></i>Mẫu một phần</span><span><i class="legend-gap"></i>Khoảng trống ngoại tuyến</span></div>`;
}

function renderHistory(state: Readonly<AppState>): string {
  const history = state.history;
  const points = history?.points ?? [];
  const values = points.flatMap((point) => point.value === null ? [] : [point.value]);
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return `${pageHeading('DỮ LIỆU LỊCH SỬ', 'Mức sáng theo thời gian', 'Mẫu một phút từ SQLite; không nối đường qua khoảng thiếu dữ liệu.')}
    <section class="panel history-panel">
      <div class="panel-heading responsive"><div><p class="eyebrow">KHOẢNG THỜI GIAN</p><h2>${state.historyRange === 1 ? '24 giờ gần nhất' : `${state.historyRange} ngày gần nhất`}</h2></div><div class="range-switch" role="group" aria-label="Chọn khoảng lịch sử">
        ${([1, 7, 30] as const).map((days) => `<button type="button" class="button ${state.historyRange === days ? 'selected' : 'secondary'}" data-action="history-range" data-days="${days}">${days === 1 ? '24 giờ' : `${days} ngày`}</button>`).join('')}
      </div></div>
      ${state.historyLoading ? '<div class="loading-block"><span class="spinner"></span>Đang tải lịch sử…</div>' : history ? chart(points, history.from, history.to) : emptyState('Chưa tải lịch sử', 'Chọn khoảng thời gian hoặc thử tải lại.')}
      <div class="history-stats"><div><span>Số bucket</span><strong>${points.length}</strong></div><div><span>Trung bình</span><strong>${average === null ? '—' : `${average.toFixed(1)}%`}</strong></div><div><span>Chất lượng một phần</span><strong>${points.filter((point) => point.coverageQuality === 'partial').length}</strong></div></div>
      ${points.length ? `<details class="data-table-details"><summary>Xem dữ liệu dạng bảng</summary><div class="table-scroll"><table><thead><tr><th>Thời điểm</th><th>Mức sáng</th><th>Nhỏ nhất</th><th>Lớn nhất</th><th>Số mẫu</th><th>Chất lượng</th></tr></thead><tbody>${points.slice(-200).map((point) => `<tr><td>${escapeHtml(formatDateTime(point.bucketStartUtc))}</td><td>${point.value === null ? '—' : `${point.value.toFixed(1)}%`}</td><td>${point.minimum === null ? '—' : `${point.minimum.toFixed(1)}%`}</td><td>${point.maximum === null ? '—' : `${point.maximum.toFixed(1)}%`}</td><td>${point.sampleCount}</td><td>${point.coverageQuality === 'complete' ? 'Đầy đủ' : point.coverageQuality === 'partial' ? 'Một phần' : 'Không hợp lệ'}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    </section>`;
}

function localDateInput(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function renderLogs(state: Readonly<AppState>): string {
  const filters = state.logFilters;
  const items = (state.logs?.items ?? []).filter((item) => !filters.source || `${item.source} ${item.referenceId ?? ''}`.toLowerCase().includes(filters.source.toLowerCase()));
  return `${pageHeading('TRUY VẾT HỆ THỐNG', 'Nhật ký sự kiện', 'Lọc lệnh, cấu hình, cảm biến, cảnh báo và sự kiện hệ thống theo thời gian.')}
    <form id="log-filter-form" class="panel filter-panel">
      <label><span>Loại</span><select name="type"><option value="">Tất cả</option>${[
        ['command', 'Lệnh'], ['config', 'Cấu hình'], ['sensor', 'Cảm biến'], ['security', 'An ninh'], ['safety', 'An toàn'], ['system', 'Hệ thống'], ['auth', 'Xác thực']
      ].map(([value, label]) => `<option value="${value}"${selected(value!, filters.type)}>${label}</option>`).join('')}</select></label>
      <label><span>Mức độ</span><select name="severity"><option value="">Tất cả</option>${[
        ['info', 'Thông tin'], ['notice', 'Chú ý'], ['warning', 'Cảnh báo'], ['critical', 'Nghiêm trọng']
      ].map(([value, label]) => `<option value="${value}"${selected(value!, filters.severity)}>${label}</option>`).join('')}</select></label>
      <label><span>Từ thời điểm</span><input name="from" type="datetime-local" value="${escapeHtml(localDateInput(filters.from))}"></label>
      <label><span>Đến thời điểm</span><input name="to" type="datetime-local" value="${escapeHtml(localDateInput(filters.to))}"></label>
      <label><span>Nguồn hoặc mã</span><input name="source" type="search" value="${escapeHtml(filters.source)}" placeholder="Ví dụ: device, cmd-"></label>
      <button class="button primary" type="submit">Áp dụng bộ lọc</button>
    </form>
    <section class="panel log-panel">
      <div class="panel-heading"><div><p class="eyebrow">KẾT QUẢ</p><h2>${items.length} sự kiện đang hiển thị</h2></div><button type="button" class="button secondary compact" data-action="refresh-logs">Làm mới</button></div>
      ${state.logsLoading ? '<div class="loading-block"><span class="spinner"></span>Đang tải nhật ký…</div>' : items.length ? `<div class="log-list">${items.map((log) => `<article class="log-row">
        <div class="log-time"><strong>${escapeHtml(formatDateTime(log.createdAt))}</strong><span>${escapeHtml(log.type)}</span></div>
        <div class="log-content"><div>${statusPill(severityLabels[log.severity], log.severity === 'critical' ? 'danger' : log.severity === 'warning' ? 'warning' : 'neutral')}<strong>${escapeHtml(log.message)}</strong></div><p>Nguồn: ${escapeHtml(log.source)}${log.referenceId ? ` · Mã ${escapeHtml(log.referenceId)}` : ''}</p><details><summary>Chi tiết kỹ thuật</summary><pre>${escapeHtml(JSON.stringify(log.details, null, 2))}</pre></details></div>
      </article>`).join('')}</div>` : emptyState('Không có sự kiện phù hợp', 'Thay đổi bộ lọc hoặc chờ hệ thống tạo sự kiện mới.')}
      ${state.logs?.nextCursor ? '<div class="load-more"><button type="button" class="button secondary" data-action="load-more-logs">Tải thêm</button></div>' : ''}
    </section>`;
}

function renderGlobalAlerts(state: Readonly<AppState>): string {
  const active = state.overview?.overview.activeAlerts ?? [];
  if (!active.length) return '';
  const critical = active.some((alert) => alert.severity === 'critical');
  return `<section class="global-alert ${critical ? 'critical' : ''}" role="alert">
    <div class="global-alert-icon" aria-hidden="true">!</div><div><strong>${active.length} nguyên nhân cảnh báo đang hoạt động</strong><p>${active.map((alert) => `${alert.source}: ${reasonLabel(alert.reasonCode)}`).join(' · ')}</p></div>
    <a href="/an-ninh-an-toan" data-route class="button alert-button">Xem và xử lý</a>
  </section>`;
}

function renderBanners(state: Readonly<AppState>): string {
  const messages: string[] = [];
  const availability = state.overview?.overview.availability?.data;
  if (!state.serverReachable) messages.push('Không kết nối được máy chủ. Giá trị đang hiển thị có thể đã cũ; lệnh từ xa bị khóa.');
  if (availability?.status === 'offline') messages.push(`Thiết bị Ngoại tuyến — ${reasonLabel(availability.reason)}.`);
  if (availability?.status === 'degraded' || availability?.status === 'syncing') messages.push(`Thiết bị ${connectionLabels[availability.status]} — ${reasonLabel(availability.reason)}.`);
  if (state.realtime === 'degraded' && state.serverReachable) messages.push('Kênh cập nhật trực tiếp đang suy giảm; ứng dụng dùng tải lại định kỳ.');
  if (!messages.length) return '';
  return `<div class="banner-stack">${messages.map((message) => `<div class="system-banner" role="status"><span aria-hidden="true">!</span>${escapeHtml(message)}</div>`).join('')}</div>`;
}

function renderConfirmation(state: Readonly<AppState>): string {
  const confirmation = state.confirmation;
  if (!confirmation) return '';
  return `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
    <div class="modal-symbol ${confirmation.danger ? 'danger' : ''}" aria-hidden="true">${confirmation.danger ? '!' : '?'}</div>
    <h2 id="confirm-title">${escapeHtml(confirmation.title)}</h2><p id="confirm-message">${escapeHtml(confirmation.message)}</p>
    <div class="modal-actions"><button type="button" class="button secondary" data-action="confirm-cancel">Hủy</button><button type="button" class="button ${confirmation.danger ? 'danger' : 'primary'}" data-action="confirm-accept">${escapeHtml(confirmation.confirmLabel)}</button></div>
  </section></div>`;
}

function renderPage(state: Readonly<AppState>): string {
  switch (state.route) {
    case '/tong-quan': return renderOverview(state);
    case '/dieu-khien': return renderControl(state);
    case '/trang-thai-phong': return renderRoomProfile(state);
    case '/cai-dat-tu-dong': return renderSettings(state);
    case '/an-ninh-an-toan': return renderSecurity(state);
    case '/lich-su': return renderHistory(state);
    case '/nhat-ky': return renderLogs(state);
    default: return renderOverview(state);
  }
}

function desktopNavigation(state: Readonly<AppState>): string {
  return `<aside class="sidebar">
    <a href="/tong-quan" data-route class="brand"><span class="brand-mark" aria-hidden="true">S</span><span><strong>SmartRoom</strong><small>Phòng thông minh</small></span></a>
    <nav aria-label="Điều hướng chính">${routes.map((route) => `<a href="${route.path}" data-route class="nav-link ${state.route === route.path ? 'active' : ''}"${state.route === route.path ? ' aria-current="page"' : ''}><span aria-hidden="true">${route.symbol}</span>${route.label}</a>`).join('')}</nav>
    <div class="sidebar-footer"><span>Thiết bị</span><strong>${escapeHtml(state.overview?.overview.deviceId ?? 'room-01')}</strong><small>${state.overview?.overview.storageMode === 'sqlite' ? 'Dữ liệu bền vững' : 'Đang chờ dữ liệu'}</small></div>
  </aside>`;
}

function mobileNavigation(state: Readonly<AppState>): string {
  const mainPaths: AppRoute[] = ['/tong-quan', '/dieu-khien', '/trang-thai-phong', '/an-ninh-an-toan'];
  return `<nav class="mobile-nav" aria-label="Điều hướng điện thoại">${mainPaths.map((path) => {
    const route = routes.find((item) => item.path === path)!;
    return `<a href="${route.path}" data-route class="${state.route === route.path ? 'active' : ''}"${state.route === route.path ? ' aria-current="page"' : ''}><span aria-hidden="true">${route.symbol}</span><small>${route.shortLabel}</small></a>`;
  }).join('')}<button type="button" data-action="more-menu" class="${state.moreMenuOpen ? 'active' : ''}"><span aria-hidden="true">•••</span><small>Thêm</small></button></nav>
  ${state.moreMenuOpen ? `<div class="more-menu" role="dialog" aria-label="Điều hướng bổ sung"><a href="/cai-dat-tu-dong" data-route>Cài đặt tự động</a><a href="/lich-su" data-route>Lịch sử</a><a href="/nhat-ky" data-route>Nhật ký</a><button type="button" data-action="logout">Đăng xuất</button></div>` : ''}`;
}

export function renderLogin(state: Readonly<AppState>): string {
  return `<div class="login-layout">
    <section class="login-story"><div class="brand light"><span class="brand-mark" aria-hidden="true">S</span><span><strong>SmartRoom</strong><small>Hệ thống phòng thông minh IoT</small></span></div><div><p class="eyebrow">GIÁM SÁT · ĐIỀU KHIỂN · TỰ ĐỘNG HÓA</p><h1>Một căn phòng.<br>Một luồng trạng thái rõ ràng.</h1><p>Theo dõi mức sáng, vùng cửa và cảnh báo an toàn; mọi lệnh chỉ hiển thị thành công sau khi thiết bị xác nhận.</p></div><ul><li>Hoạt động cục bộ khi mất Internet</li><li>Dữ liệu SQLite và nhật ký có truy vết</li><li>Quạt và khóa luôn được ghi rõ là mô phỏng</li></ul></section>
    <main class="login-main"><form id="login-form" class="login-card">
      <div><p class="eyebrow">CHỦ PHÒNG</p><h1>Đăng nhập</h1><p>Dùng tài khoản đã tạo khi khởi tạo máy chủ.</p></div>
      <label><span>Tên tài khoản</span><input name="username" autocomplete="username" maxlength="64" required autofocus></label>
      <label><span>Mật khẩu</span><input name="password" type="password" autocomplete="current-password" maxlength="256" required></label>
      <button type="submit" class="button primary wide"${disabled(state.pageLoading)}>${state.pageLoading ? '<span class="spinner"></span>Đang đăng nhập…' : 'Đăng nhập'}</button>
      ${state.notice ? `<div class="form-message ${state.notice.kind}" role="alert">${escapeHtml(state.notice.message)}</div>` : ''}
      <p class="privacy-note">Mật khẩu không được lưu trong trình duyệt. Phiên do máy chủ quản lý bằng cookie bảo mật.</p>
    </form></main>
  </div>`;
}

export function renderApplication(state: Readonly<AppState>): string {
  if (state.initializing) return '<main class="splash"><span class="brand-mark">S</span><h1>Phòng thông minh</h1><p><span class="spinner"></span>Đang kiểm tra phiên…</p></main>';
  if (!state.session) return renderLogin(state);
  const availability = state.overview?.overview.availability?.data.status ?? 'offline';
  const activeCount = state.overview?.overview.activeAlerts.length ?? 0;
  const receivedAt = state.overview?.overview.telemetry?.receivedAt;
  return `<div class="app-shell">
    <a class="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>
    ${desktopNavigation(state)}
    <div class="app-column">
      <header class="topbar"><div><p class="topbar-room">Phòng thông minh</p><span class="topbar-page">${escapeHtml(routeLabel(state.route))}</span><small class="topbar-update">${receivedAt ? `Dữ liệu ${escapeHtml(relativeTime(receivedAt))}` : 'Chưa có dữ liệu thiết bị'}</small></div><div class="topbar-actions">${statusPill(state.serverReachable ? connectionLabels[availability] : 'Mất máy chủ', state.serverReachable && availability === 'online' ? 'success' : availability === 'degraded' || availability === 'syncing' ? 'warning' : 'danger')}<a href="/an-ninh-an-toan" data-route class="alert-counter ${activeCount ? 'has-alert' : ''}" aria-label="${activeCount} cảnh báo đang hoạt động"><span aria-hidden="true">!</span>${activeCount}</a><div class="account"><span class="avatar" aria-hidden="true">${escapeHtml(state.session.user.username.charAt(0).toUpperCase())}</span><span><strong>${escapeHtml(state.session.user.username)}</strong><small>Chủ phòng</small></span><button type="button" data-action="logout" class="icon-button" aria-label="Đăng xuất">↪</button></div></div></header>
      ${renderBanners(state)}${renderGlobalAlerts(state)}
      <main id="main-content" class="main-content" tabindex="-1">${renderPage(state)}</main>
      ${mobileNavigation(state)}
    </div>
    <div class="live-region" aria-live="polite" aria-atomic="true">${state.notice ? `<div class="toast ${state.notice.kind}">${escapeHtml(state.notice.message)}<button type="button" data-action="dismiss-notice" aria-label="Đóng thông báo">×</button></div>` : ''}</div>
    ${renderConfirmation(state)}
  </div>`;
}
