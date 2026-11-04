import type { RealtimeEventName } from '../types';

const eventNames: RealtimeEventName[] = [
  'telemetry.updated', 'state.updated', 'availability.updated', 'config.updated',
  'command.updated', 'alert.updated', 'event.created'
];

export interface RealtimeCallbacks {
  onOpen(): void;
  onError(): void;
  onEvent(name: RealtimeEventName, data: unknown, eventId: string): void;
}

export class RealtimeClient {
  private source: EventSource | null = null;

  constructor(private readonly callbacks: RealtimeCallbacks) {}

  connect(): void {
    if (this.source) return;
    const source = new EventSource('/api/events/stream', { withCredentials: true });
    this.source = source;
    source.onopen = () => this.callbacks.onOpen();
    source.onerror = () => this.callbacks.onError();
    for (const name of eventNames) {
      source.addEventListener(name, (event) => {
        const message = event as MessageEvent<string>;
        try {
          this.callbacks.onEvent(name, JSON.parse(message.data) as unknown, message.lastEventId);
        } catch {
          // Bỏ riêng event hỏng; snapshot/polling sẽ phục hồi trạng thái.
        }
      });
    }
  }

  close(): void {
    this.source?.close();
    this.source = null;
  }
}
