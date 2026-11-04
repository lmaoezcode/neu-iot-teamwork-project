import type {
  ApiErrorBody,
  CommandInput,
  CommandRecord,
  ConfigResponse,
  ConfigSettings,
  HistoryResponse,
  LogsResponse,
  OverviewResponse,
  SessionResponse,
  Severity,
  SystemLogRecord
} from '../types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Fetcher = typeof fetch;

export class ApiClient {
  private csrfToken: string | null = null;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly onUnauthorized: () => void = () => undefined
  ) {}

  useSession(session: SessionResponse): void {
    this.csrfToken = session.authenticated ? session.csrf_token : null;
  }

  async session(): Promise<SessionResponse> {
    const result = await this.request<SessionResponse>('/api/session');
    this.useSession(result);
    return result;
  }

  async login(username: string, password: string): Promise<SessionResponse> {
    const result = await this.request<SessionResponse>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    });
    this.useSession(result);
    return result;
  }

  async logout(): Promise<void> {
    await this.request<void>('/api/auth/logout', { method: 'POST' }, true);
    this.csrfToken = null;
  }

  overview(): Promise<OverviewResponse> {
    return this.request('/api/overview');
  }

  config(): Promise<ConfigResponse> {
    return this.request('/api/config');
  }

  updateConfig(baseVersion: number, settings: ConfigSettings): Promise<{ accepted: true; applied: false; desired: ConfigResponse['desired'] }> {
    return this.request('/api/config/desired', {
      method: 'PUT', body: JSON.stringify({ base_config_version: baseVersion, settings })
    }, true);
  }

  command(input: CommandInput): Promise<{ accepted: true; applied: false; command: CommandRecord }> {
    return this.request('/api/commands', { method: 'POST', body: JSON.stringify(input) }, true);
  }

  commandStatus(commandId: string): Promise<{ command: CommandRecord }> {
    return this.request(`/api/commands/${encodeURIComponent(commandId)}`);
  }

  alertAction(alertId: string, action: 'mute' | 'ack'): Promise<{ accepted: true; applied: false; command: CommandRecord }> {
    return this.request(`/api/alerts/${encodeURIComponent(alertId)}/${action}`, { method: 'POST' }, true);
  }

  history(from: string, to: string): Promise<HistoryResponse> {
    const query = new URLSearchParams({ metric: 'light', from, to });
    return this.request(`/api/history?${query.toString()}`);
  }

  logs(query: {
    type?: SystemLogRecord['type']; severity?: Severity; from?: string; to?: string; cursor?: string; limit?: number;
  }): Promise<LogsResponse> {
    const parameters = new URLSearchParams();
    if (query.type) parameters.set('type', query.type);
    if (query.severity) parameters.set('severity', query.severity);
    if (query.from) parameters.set('from', query.from);
    if (query.to) parameters.set('to', query.to);
    if (query.cursor) parameters.set('cursor', query.cursor);
    parameters.set('limit', String(query.limit ?? 50));
    return this.request(`/api/logs?${parameters.toString()}`);
  }

  private async request<T>(path: string, init: RequestInit = {}, mutation = false): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (mutation) {
      if (!this.csrfToken) throw new ApiError(403, 'csrf_missing', 'Phiên chưa có mã bảo vệ thao tác.');
      headers.set('x-csrf-token', this.csrfToken);
    }
    let response: Response;
    try {
      response = await this.fetcher(path, { ...init, headers, credentials: 'include', cache: 'no-store' });
    } catch {
      throw new ApiError(0, 'network_unavailable', 'Không thể kết nối tới máy chủ.');
    }
    if (response.status === 401) this.onUnauthorized();
    if (!response.ok) {
      let body: ApiErrorBody = { error_code: 'http_error', message: `Yêu cầu thất bại (${response.status}).` };
      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        // Giữ thông báo HTTP tổng quát nếu máy chủ không trả JSON.
      }
      throw new ApiError(response.status, body.error_code, body.message, body.details ?? {});
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
