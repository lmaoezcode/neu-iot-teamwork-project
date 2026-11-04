import { describe, expect, it, vi } from 'vitest';
import { EventHub } from '../src/realtime/event-stream.js';

describe('bộ phát SSE', () => {
  it('phát, giới hạn cửa sổ và phát hiện con trỏ quá cũ', () => {
    const hub = new EventHub(2);
    const listener = vi.fn();
    const unsubscribe = hub.subscribe(listener);
    const first = hub.publish('state.updated', { version: 1 });
    const second = hub.publish('state.updated', { version: 2 });
    const third = hub.publish('state.updated', { version: 3 });
    expect(listener).toHaveBeenCalledTimes(3);
    expect(hub.replayAfter(second.id).events).toEqual([third]);
    expect(hub.replayAfter(first.id).cursorFound).toBe(false);
    unsubscribe();
    hub.publish('event.created', { id: 4 });
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

