import { ApiClient, ApiError } from './api/client';
import { validateConfig } from './domain/config-validation';
import { historyWindow } from './domain/history';
import { relativeTime } from './domain/format';
import { NotificationManager } from './notifications';
import { guardedRoute, normalizeRoute } from './router';
import { RealtimeClient } from './realtime/sse-client';
import { mergeRealtimeOverview } from './state/realtime';
import { AppStore, initialState } from './state/store';
import type {
  AlertRecord,
  AppRoute,
  CommandInput,
  CommandRecord,
  ConfigResponse,
  ConfigSettings,
  RealtimeEventName,
  Severity,
  SystemLogRecord
} from './types';
import { renderApplication } from './ui/render';

const terminalStatuses = new Set(['applied', 'duplicate_ok', 'rejected', 'expired', 'unknown']);

function cloneSettings(settings: ConfigSettings): ConfigSettings {
  return structuredClone(settings);
}

function integer(form: FormData, name: string): number {
  return Number(form.get(name));
}

function localDateToIso(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || value === '') return '';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '';
}

export class SmartRoomApplication {
  private readonly store = new AppStore(initialState());
  private readonly notifications = new NotificationManager();
  private readonly api: ApiClient;
  private realtime: RealtimeClient | null = null;
  private fallbackTimer: number | null = null;
  private freshnessTimer: number | null = null;
  private commandPollTimer: number | null = null;
  private noticeTimer: number | null = null;
  private dialogOpen = false;

  constructor(private readonly root: HTMLElement) {
    this.api = new ApiClient(fetch.bind(globalThis),() => this.expireSession());
  }

  async start(): Promise<void> {
    this.root.addEventListener('click', (event) => void this.handleClick(event));
    this.root.addEventListener('submit', (event) => void this.handleSubmit(event));
    this.root.addEventListener('input', (event) => this.captureConfigDraft(event));
    this.root.addEventListener('change', (event) => this.captureConfigDraft(event));
    this.root.addEventListener('keydown', (event) => this.handleDialogKeydown(event));
    window.addEventListener('popstate', () => void this.navigate(normalizeRoute(window.location.pathname), false));
    this.store.subscribe((state) => {
      const openingDialog = Boolean(state.confirmation) && !this.dialogOpen;
      this.root.innerHTML = renderApplication(state);
      this.dialogOpen = Boolean(state.confirmation);
      if (openingDialog) {
        queueMicrotask(() => this.root.querySelector<HTMLButtonElement>('[data-action="confirm-cancel"]')?.focus());
      }
    });
    this.freshnessTimer = window.setInterval(() => this.updateFreshnessLabels(), 5_000);

    const requested = normalizeRoute(window.location.pathname);
    try {
      const session = await this.api.session();
      if (!session.authenticated) {
        const route = '/dang-nhap' as const;
        history.replaceState({}, '', route);
        this.store.patch({ session: null, initializing: false, route, returnRoute: requested });
        return;
      }
      const route = guardedRoute(requested, true);
      history.replaceState({}, '', route);
      this.store.patch({ session, initializing: false, route, returnRoute: route });
      await this.loadCore();
      this.connectRealtime();
      await this.loadRouteData(route);
    } catch (error) {
      const route = '/dang-nhap' as const;
      history.replaceState({}, '', route);
      this.store.patch({
        initializing: false,
        route,
        returnRoute: requested,
        serverReachable: !(error instanceof ApiError && error.status === 0),
        notice: { kind: 'error', message: this.errorMessage(error) }
      });
    }
  }

  private async loadCore(): Promise<void> {
    this.store.patch({ pageLoading: true });
    try {
      const [overview, config, logs] = await Promise.all([
        this.api.overview(), this.api.config(), this.api.logs({ limit: 10 })
      ]);
      const priorDraft = this.store.get().configDirty ? this.store.get().configDraft : null;
      this.store.patch({
        overview,
        config,
        configDraft: priorDraft ?? cloneSettings(config.desired.settings),
        logs,
        pageLoading: false,
        serverReachable: true
      });
      this.notifications.notifyNewActive(overview.overview.activeAlerts);
    } catch (error) {
      this.store.patch({ pageLoading: false, serverReachable: false });
      this.showNotice('error', this.errorMessage(error));
    }
  }

  private connectRealtime(): void {
    this.realtime?.close();
    this.store.patch({ realtime: 'connecting' });
    this.realtime = new RealtimeClient({
      onOpen: () => {
        this.stopFallbackPolling();
        this.store.patch({ realtime: 'open', serverReachable: true });
      },
      onError: () => {
        this.store.patch({ realtime: 'degraded' });
        this.startFallbackPolling();
      },
      onEvent: (name, data) => void this.applyRealtime(name, data)
    });
    this.realtime.connect();
  }

  private async applyRealtime(name: RealtimeEventName, data: unknown): Promise<void> {
    if (name === 'config.updated' && typeof data === 'object' && data !== null && 'desired' in data) {
      const config = data as ConfigResponse;
      this.store.patch({
        config,
        configDraft: this.store.get().configDirty ? this.store.get().configDraft : cloneSettings(config.desired.settings)
      });
      return;
    }
    if (name === 'command.updated') {
      const command = data as CommandRecord;
      if (command?.commandId) this.handleCommandUpdate(command);
      return;
    }
    if (name === 'event.created') {
      if (this.store.get().route === '/nhat-ky' || this.store.get().route === '/tong-quan') await this.loadLogs(false);
      return;
    }
    const before = this.store.get().overview?.overview.activeAlerts ?? [];
    const overview = mergeRealtimeOverview(this.store.get().overview, name, data);
    if (overview) {
      this.store.patch({ overview, serverReachable: true });
      if (name === 'alert.updated') {
        const beforeIds = new Set(before.map((alert) => alert.alertId));
        this.notifications.notifyNewActive(overview.overview.activeAlerts.filter((alert) => !beforeIds.has(alert.alertId)));
      }
    }
  }

  private async handleClick(event: Event): Promise<void> {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action], [data-route]') : null;
    if (!target) return;
    if (target.hasAttribute('data-route')) {
      event.preventDefault();
      const href = target.getAttribute('href') ?? '/tong-quan';
      const url = new URL(href, window.location.origin);
      await this.navigate(normalizeRoute(url.pathname), true, url.hash);
      return;
    }
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'logout') await this.logout();
    else if (action === 'more-menu') this.store.patch({ moreMenuOpen: !this.store.get().moreMenuOpen });
    else if (action === 'dismiss-notice') this.store.patch({ notice: null });
    else if (action === 'confirm-cancel') this.store.patch({ confirmation: null });
    else if (action === 'confirm-accept') {
      const command = this.store.get().confirmation?.command;
      this.store.patch({ confirmation: null });
      if (command) await this.executeCommand(command);
    } else if (action === 'device') {
      await this.prepareDeviceCommand(target.dataset.target as 'lamp' | 'fan', target.dataset.value as 'on' | 'off');
    } else if (action === 'mode') await this.prepareModeCommand(target.dataset.value as 'auto' | 'manual');
    else if (action === 'profile') await this.prepareProfileCommand(target.dataset.value as 'home' | 'away' | 'night');
    else if (action === 'lock') await this.prepareLockCommand(target.dataset.value as 'locked' | 'unlocked');
    else if (action === 'alert-mute') await this.alertAction(target.dataset.alertId, 'mute');
    else if (action === 'alert-ack') await this.alertAction(target.dataset.alertId, 'ack');
    else if (action === 'notification-permission') await this.requestNotifications();
    else if (action === 'history-range') {
      const days = Number(target.dataset.days) as 1 | 7 | 30;
      if ([1, 7, 30].includes(days)) {
        this.store.patch({ historyRange: days });
        await this.loadHistory();
      }
    } else if (action === 'refresh-logs') await this.loadLogs(false);
    else if (action === 'load-more-logs') await this.loadLogs(true);
    else if (action === 'reset-config') {
      const desired = this.store.get().config?.desired.settings;
      if (desired) this.store.patch({ configDraft: cloneSettings(desired), configDirty: false });
    }
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (form.id === 'login-form') await this.login(form);
    else if (form.id === 'light-config-form') await this.saveLightConfig(form);
    else if (form.id === 'mq2-config-form') await this.saveMq2Config(form);
    else if (form.id === 'log-filter-form') await this.applyLogFilters(form);
  }

  private handleDialogKeydown(event: KeyboardEvent): void {
    if (!this.store.get().confirmation) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.store.patch({ confirmation: null });
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = this.root.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')] : [];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private async login(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const username = String(data.get('username') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!username || !password) {
      this.showNotice('error', 'Hãy nhập tên tài khoản và mật khẩu.');
      return;
    }
    this.store.patch({ pageLoading: true, notice: null });
    try {
      const session = await this.api.login(username, password);
      if (!session.authenticated) throw new ApiError(401, 'invalid_credentials', 'Thông tin đăng nhập chưa đúng.');
      const route = guardedRoute(this.store.get().returnRoute, true);
      history.replaceState({}, '', route);
      this.store.patch({ session, route, pageLoading: false, serverReachable: true });
      await this.loadCore();
      this.connectRealtime();
      await this.loadRouteData(route);
    } catch (error) {
      this.store.patch({ pageLoading: false });
      this.showNotice('error', error instanceof ApiError && error.status === 401 ? 'Thông tin đăng nhập chưa đúng.' : this.errorMessage(error));
    }
  }

  private async logout(): Promise<void> {
    try {
      await this.api.logout();
    } catch {
      // Phiên cục bộ vẫn phải kết thúc nếu máy chủ đã mất kết nối.
    }
    this.realtime?.close();
    this.stopFallbackPolling();
    this.stopCommandPolling();
    const route = '/dang-nhap' as const;
    history.replaceState({}, '', route);
    this.store.patch({ ...initialState(), initializing: false, route, returnRoute: '/tong-quan' });
  }

  private expireSession(): void {
    if (!this.store.get().session) return;
    const returnRoute = this.store.get().route === '/dang-nhap' ? '/tong-quan' : this.store.get().route;
    this.realtime?.close();
    this.stopFallbackPolling();
    history.replaceState({}, '', '/dang-nhap');
    this.store.patch({ session: null, route: '/dang-nhap', returnRoute, notice: { kind: 'warning', message: 'Phiên đã hết hạn. Hãy đăng nhập lại; lệnh cũ sẽ không được gửi lại.' } });
  }

  private async navigate(route: AppRoute, push: boolean, hash = ''): Promise<void> {
    const guarded = guardedRoute(route, Boolean(this.store.get().session));
    if (push) history.pushState({}, '', `${guarded}${hash}`);
    this.store.patch({ route: guarded, moreMenuOpen: false });
    await this.loadRouteData(guarded);
    queueMicrotask(() => {
      if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
    });
  }

  private async loadRouteData(route: AppRoute): Promise<void> {
    if (route === '/lich-su') await this.loadHistory();
    if (route === '/nhat-ky') await this.loadLogs(false);
  }

  private prepareDeviceCommand(target: 'lamp' | 'fan', value: 'on' | 'off'): void {
    const state = this.store.get().overview?.overview.state?.data;
    if (!state) return;
    const command: CommandInput = {
      operation: 'set_device', target, value, expected_state_version: state.state_version
    };
    if (state.control_mode === 'auto') {
      command.options = { user_confirmed: true, force_manual: true };
      this.store.patch({ confirmation: {
        title: 'Chuyển sang Thủ công?',
        message: `Lệnh trực tiếp sẽ chuyển phương thức sang Thủ công rồi ${value === 'on' ? 'bật' : 'tắt'} ${target === 'lamp' ? 'đèn' : 'quạt mô phỏng'}.`,
        confirmLabel: 'Xác nhận và thực hiện', danger: false, command
      } });
      return;
    }
    void this.executeCommand(command);
  }

  private async prepareModeCommand(value: 'auto' | 'manual'): Promise<void> {
    const state = this.store.get().overview?.overview.state?.data;
    if (!state || state.control_mode === value) return;
    const command: CommandInput = { operation: 'set_control_mode', target: 'system', value, expected_state_version: state.state_version, options: { user_confirmed: true } };
    this.store.patch({ confirmation: {
      title: value === 'auto' ? 'Bật điều khiển Tự động?' : 'Chuyển sang Thủ công?',
      message: value === 'auto' ? 'Thiết bị sẽ đánh giá ngay mức sáng hợp lệ thay vì giữ mù đầu ra hiện tại.' : 'Quy tắc ánh sáng sẽ dừng; trạng thái tải hiện tại được giữ cho đến lệnh mới hoặc hồ sơ Ra ngoài.',
      confirmLabel: 'Áp dụng phương thức', danger: false, command
    } });
  }

  private async prepareProfileCommand(value: 'home' | 'away' | 'night'): Promise<void> {
    const state = this.store.get().overview?.overview.state?.data;
    if (!state || state.room_profile === value) return;
    const descriptions = {
      home: 'Cửa không tự mở. Phương thức trước đó được giữ; tải Thủ công không tự bật lại.',
      away: 'Đèn và quạt bị cưỡng chế tắt, khóa mô phỏng được áp dụng và vùng cửa được trang bị bảo vệ.',
      night: 'Phương thức tiện nghi được giữ và chỉ vùng cửa được trang bị bảo vệ.'
    };
    this.store.patch({ confirmation: {
      title: `Chuyển sang ${value === 'home' ? 'Ở nhà' : value === 'away' ? 'Ra ngoài' : 'Ban đêm'}?`,
      message: descriptions[value], confirmLabel: 'Xác nhận chuyển hồ sơ', danger: value === 'away',
      command: { operation: 'set_room_profile', target: 'system', value, expected_state_version: state.state_version, options: { user_confirmed: true } }
    } });
  }

  private async prepareLockCommand(value: 'locked' | 'unlocked'): Promise<void> {
    const state = this.store.get().overview?.overview.state?.data;
    if (!state) return;
    const command: CommandInput = { operation: 'set_lock', target: 'lock', value, expected_state_version: state.state_version };
    if (value === 'unlocked') {
      command.options = { user_confirmed: true, transition_home: state.room_profile !== 'home' };
      const safety = this.store.get().overview?.overview.activeAlerts.some((alert) => alert.type === 'safety');
      this.store.patch({ confirmation: {
        title: 'Mở khóa mô phỏng?',
        message: `${state.room_profile !== 'home' ? 'Hệ thống sẽ chuyển nguyên tử về Ở nhà trước. ' : ''}${safety ? 'Cảnh báo an toàn vẫn tồn tại và không bị xóa. ' : ''}Đây chỉ là trạng thái mô phỏng, không xác nhận chốt cơ khí.`,
        confirmLabel: 'Xác nhận mở mô phỏng', danger: true, command
      } });
      return;
    }
    await this.executeCommand(command);
  }

  private async executeCommand(input: CommandInput): Promise<void> {
    try {
      const response = await this.api.command(input);
      this.store.patch({ pendingCommand: response.command });
      this.showNotice('info', 'Lệnh đã được máy chủ tiếp nhận và đang chờ thiết bị xác nhận.');
      this.startCommandPolling(response.command.commandId);
    } catch (error) {
      this.showNotice('error', this.errorMessage(error));
      await this.refreshOverview();
    }
  }

  private handleCommandUpdate(command: CommandRecord): void {
    const current = this.store.get().pendingCommand;
    if (current && current.commandId !== command.commandId) return;
    this.store.patch({ pendingCommand: command });
    if (!terminalStatuses.has(command.status)) return;
    this.stopCommandPolling();
    const success = command.status === 'applied' || command.status === 'duplicate_ok';
    this.showNotice(success ? 'success' : 'warning', success ? 'Thiết bị đã xác nhận áp dụng lệnh.' : command.status === 'unknown' ? 'Kết quả lệnh chưa xác định; đang tải lại trạng thái thực tế.' : `Lệnh không được áp dụng: ${command.reasonCode}.`);
    void this.loadCore();
  }

  private startCommandPolling(commandId: string): void {
    this.stopCommandPolling();
    const started = Date.now();
    this.commandPollTimer = window.setInterval(() => {
      void (async () => {
        try {
          const { command } = await this.api.commandStatus(commandId);
          this.handleCommandUpdate(command);
          if (Date.now() - started > 40_000) this.stopCommandPolling();
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 0)) this.stopCommandPolling();
        }
      })();
    }, 2_000);
  }

  private stopCommandPolling(): void {
    if (this.commandPollTimer !== null) window.clearInterval(this.commandPollTimer);
    this.commandPollTimer = null;
  }

  private async alertAction(alertId: string | undefined, action: 'mute' | 'ack'): Promise<void> {
    if (!alertId) return;
    try {
      const response = await this.api.alertAction(alertId, action);
      this.store.patch({ pendingCommand: response.command });
      this.showNotice('info', action === 'mute' ? 'Đã gửi yêu cầu tắt tiếng; nguyên nhân cảnh báo vẫn được giữ.' : 'Đã gửi yêu cầu xác nhận cảnh báo.');
      this.startCommandPolling(response.command.commandId);
    } catch (error) {
      this.showNotice('error', this.errorMessage(error));
    }
  }

  private captureConfigDraft(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const form = input.form;
    const current = this.store.get().configDraft ?? this.store.get().config?.desired.settings;
    if (!form || !current || (form.id !== 'light-config-form' && form.id !== 'mq2-config-form')) return;
    const draft = cloneSettings(current);
    const data = new FormData(form);
    if (form.id === 'light-config-form') {
      draft.light_on_pct = integer(data, 'light_on_pct');
      draft.light_off_pct = integer(data, 'light_off_pct');
      draft.light_calibration.dark_adc = integer(data, 'light_dark_adc');
      draft.light_calibration.bright_adc = integer(data, 'light_bright_adc');
      draft.light_calibration.enabled = data.get('light_calibration_enabled') === 'on';
    } else {
      draft.mq2.baseline_adc = integer(data, 'mq2_baseline_adc');
      draft.mq2.span_adc = integer(data, 'mq2_span_adc');
      draft.mq2.threshold_pct = integer(data, 'mq2_threshold_pct');
      draft.mq2.calibration_enabled = data.get('mq2_calibration_enabled') === 'on';
    }
    this.store.patchSilently({ configDraft: draft, configDirty: true });
  }

  private async saveLightConfig(form: HTMLFormElement): Promise<void> {
    const current = this.store.get().configDraft ?? this.store.get().config?.desired.settings;
    if (!current) return;
    const data = new FormData(form);
    const draft = cloneSettings(current);
    draft.light_on_pct = integer(data, 'light_on_pct');
    draft.light_off_pct = integer(data, 'light_off_pct');
    draft.light_calibration.dark_adc = integer(data, 'light_dark_adc');
    draft.light_calibration.bright_adc = integer(data, 'light_bright_adc');
    draft.light_calibration.enabled = data.get('light_calibration_enabled') === 'on';
    await this.saveConfig(draft);
  }

  private async saveMq2Config(form: HTMLFormElement): Promise<void> {
    const current = this.store.get().configDraft ?? this.store.get().config?.desired.settings;
    if (!current) return;
    const data = new FormData(form);
    const draft = cloneSettings(current);
    draft.mq2.baseline_adc = integer(data, 'mq2_baseline_adc');
    draft.mq2.span_adc = integer(data, 'mq2_span_adc');
    draft.mq2.threshold_pct = integer(data, 'mq2_threshold_pct');
    draft.mq2.calibration_enabled = data.get('mq2_calibration_enabled') === 'on';
    await this.saveConfig(draft);
  }

  private async saveConfig(settings: ConfigSettings): Promise<void> {
    const validation = validateConfig(settings);
    if (!validation.valid) {
      this.showNotice('error', Object.values(validation.errors)[0] ?? 'Cấu hình không hợp lệ.');
      return;
    }
    const baseVersion = this.store.get().config?.desired.version;
    if (baseVersion === undefined) return;
    this.store.patch({ pageLoading: true });
    try {
      const response = await this.api.updateConfig(baseVersion, settings);
      const current = this.store.get().config;
      if (current) this.store.patch({ config: { ...current, desired: response.desired }, configDraft: cloneSettings(settings), configDirty: false, pageLoading: false });
      this.showNotice('info', 'Cấu hình đã lưu trên máy chủ; đang chờ thiết bị áp dụng.');
    } catch (error) {
      this.store.patch({ pageLoading: false });
      this.showNotice('error', this.errorMessage(error));
      if (error instanceof ApiError && error.errorCode === 'config_version_conflict') await this.loadCore();
    }
  }

  private async loadHistory(): Promise<void> {
    this.store.patch({ historyLoading: true });
    const range = historyWindow(this.store.get().historyRange);
    try {
      const history = await this.api.history(range.from, range.to);
      this.store.patch({ history, historyLoading: false, serverReachable: true });
    } catch (error) {
      this.store.patch({ historyLoading: false, serverReachable: false });
      this.showNotice('error', this.errorMessage(error));
    }
  }

  private async applyLogFilters(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const type = String(data.get('type') ?? '') as '' | SystemLogRecord['type'];
    const severity = String(data.get('severity') ?? '') as '' | Severity;
    const from = localDateToIso(data.get('from'));
    const to = localDateToIso(data.get('to'));
    if (from && to && Date.parse(from) >= Date.parse(to)) {
      this.showNotice('error', 'Thời điểm kết thúc phải sau thời điểm bắt đầu.');
      return;
    }
    this.store.patch({ logFilters: { type, severity, from, to, source: String(data.get('source') ?? '').trim() } });
    await this.loadLogs(false);
  }

  private async loadLogs(append: boolean): Promise<void> {
    const state = this.store.get();
    if (append && !state.logs?.nextCursor) return;
    this.store.patch({ logsLoading: true });
    try {
      const page = await this.api.logs({
        ...(state.logFilters.type ? { type: state.logFilters.type } : {}),
        ...(state.logFilters.severity ? { severity: state.logFilters.severity } : {}),
        ...(state.logFilters.from ? { from: state.logFilters.from } : {}),
        ...(state.logFilters.to ? { to: state.logFilters.to } : {}),
        ...(append && state.logs?.nextCursor ? { cursor: state.logs.nextCursor } : {}),
        limit: 50
      });
      const items = append && state.logs ? [...state.logs.items, ...page.items] : page.items;
      const unique = [...new Map(items.map((item) => [item.id, item])).values()];
      this.store.patch({ logs: { items: unique, nextCursor: page.nextCursor }, logsLoading: false, serverReachable: true });
    } catch (error) {
      this.store.patch({ logsLoading: false, serverReachable: false });
      this.showNotice('error', this.errorMessage(error));
    }
  }

  private async requestNotifications(): Promise<void> {
    const permission = await this.notifications.request();
    this.store.patch({ notificationPermission: permission });
    if (permission === 'granted') {
      this.notifications.notifyNewActive(this.store.get().overview?.overview.activeAlerts ?? []);
      this.showNotice('success', 'Thông báo trình duyệt đã được bật.');
    } else if (permission === 'denied') {
      this.showNotice('warning', 'Trình duyệt đã từ chối quyền; cảnh báo trong ứng dụng vẫn hoạt động.');
    } else if (permission === 'unsupported') {
      this.showNotice('warning', 'Trình duyệt này không hỗ trợ thông báo hệ điều hành.');
    }
  }

  private startFallbackPolling(): void {
    if (this.fallbackTimer !== null) return;
    void this.refreshOverview();
    this.fallbackTimer = window.setInterval(() => void this.refreshOverview(), 15_000);
  }

  private stopFallbackPolling(): void {
    if (this.fallbackTimer !== null) window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private async refreshOverview(): Promise<void> {
    try {
      const overview = await this.api.overview();
      this.store.patch({ overview, serverReachable: true });
    } catch (error) {
      this.store.patch({ serverReachable: false });
      if (!(error instanceof ApiError && error.status === 401)) return;
    }
  }

  private updateFreshnessLabels(): void {
    const elements = this.root.querySelectorAll<HTMLElement>('[data-received-at][data-stale-after]');
    for (const element of elements) {
      const receivedAt = element.dataset.receivedAt;
      const staleAfter = Number(element.dataset.staleAfter ?? '15');
      const stale = !receivedAt || Date.now() - Date.parse(receivedAt) > staleAfter * 1000;
      element.classList.toggle('is-stale', stale);
      element.textContent = `${stale ? 'Dữ liệu cũ' : 'Cập nhật'} · ${relativeTime(receivedAt)}`;
    }
  }

  private showNotice(kind: 'success' | 'warning' | 'error' | 'info', message: string): void {
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.store.patch({ notice: { kind, message } });
    this.noticeTimer = window.setTimeout(() => this.store.patch({ notice: null }), 7_000);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    return error instanceof Error ? error.message : 'Đã xảy ra lỗi chưa xác định.';
  }
}
