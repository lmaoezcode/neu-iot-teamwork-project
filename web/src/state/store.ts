import type { AppState } from '../types';

type Listener = (state: Readonly<AppState>) => void;

export function initialState(): AppState {
  return {
    route: '/tong-quan',
    returnRoute: '/tong-quan',
    session: null,
    initializing: true,
    pageLoading: false,
    serverReachable: true,
    realtime: 'closed',
    overview: null,
    config: null,
    configDraft: null,
    configDirty: false,
    pendingCommand: null,
    confirmation: null,
    historyRange: 1,
    history: null,
    historyLoading: false,
    logs: null,
    logsLoading: false,
    logFilters: { type: '', severity: '', from: '', to: '', source: '' },
    moreMenuOpen: false,
    notice: null,
    notificationPermission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  };
}

export class AppStore {
  private state: AppState;
  private readonly listeners = new Set<Listener>();

  constructor(value: AppState = initialState()) {
    this.state = value;
  }

  get(): Readonly<AppState> {
    return this.state;
  }

  patch(value: Partial<AppState>): void {
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener(this.state);
  }

  patchSilently(value: Partial<AppState>): void {
    this.state = { ...this.state, ...value };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
}
