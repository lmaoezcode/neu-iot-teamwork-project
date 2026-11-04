export type RealtimeEventName =
  | 'telemetry.updated'
  | 'state.updated'
  | 'availability.updated'
  | 'config.updated'
  | 'command.updated'
  | 'alert.updated'
  | 'event.created';

export interface RealtimeEvent {
  id: string;
  name: RealtimeEventName;
  data: unknown;
}

export interface ReplayResult {
  events: RealtimeEvent[];
  cursorFound: boolean;
  latestId: string | null;
}

export interface EventStreamPort {
  publish(name: RealtimeEventName, data: unknown): RealtimeEvent;
  replayAfter(lastEventId: string | undefined): ReplayResult;
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
}

export class EventHub implements EventStreamPort {
  private readonly events: RealtimeEvent[] = [];
  private readonly listeners = new Set<(event: RealtimeEvent) => void>();
  private sequence = 0;

  constructor(private readonly capacity: number) {}

  publish(name: RealtimeEventName, data: unknown): RealtimeEvent {
    this.sequence += 1;
    const event: RealtimeEvent = {
      id: `stream-${this.sequence.toString().padStart(10, '0')}`,
      name,
      data: structuredClone(data)
    };
    this.events.push(event);
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity);
    for (const listener of this.listeners) listener(structuredClone(event));
    return structuredClone(event);
  }

  replayAfter(lastEventId: string | undefined): ReplayResult {
    const latestId = this.events.at(-1)?.id ?? null;
    if (!lastEventId) return { events: [], cursorFound: true, latestId };
    const index = this.events.findIndex((event) => event.id === lastEventId);
    if (index < 0) return { events: [], cursorFound: false, latestId };
    return {
      events: this.events.slice(index + 1).map((event) => structuredClone(event)),
      cursorFound: true,
      latestId
    };
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
