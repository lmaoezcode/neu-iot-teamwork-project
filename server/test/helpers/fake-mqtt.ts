import type { MqttConnectionStatus, MqttMessage, MqttPort } from '../../src/mqtt/client.js';

export interface PublishedMessage {
  topic: string;
  payload: string;
  qos: 0 | 1;
  retain: boolean;
}

export class FakeMqttClient implements MqttPort {
  readonly publications: PublishedMessage[] = [];
  readonly subscriptions = new Map<string, 0 | 1>();
  private connected = false;
  private readonly messageListeners = new Set<(message: MqttMessage) => void | Promise<void>>();
  private readonly statusListeners = new Set<(status: MqttConnectionStatus, detail?: string) => void>();

  async connect(): Promise<void> {
    this.connected = true;
    for (const listener of this.statusListeners) listener('connected');
  }

  async publish(topic: string, payload: string, qos: 0 | 1, retain: boolean): Promise<void> {
    if (!this.connected) throw new Error('fake_mqtt_offline');
    this.publications.push({ topic, payload, qos, retain });
  }

  async subscribe(topic: string, qos: 0 | 1): Promise<void> {
    this.subscriptions.set(topic, qos);
  }

  async close(): Promise<void> {
    this.connected = false;
    for (const listener of this.statusListeners) listener('closed');
  }

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(listener: (message: MqttMessage) => void | Promise<void>): void {
    this.messageListeners.add(listener);
  }

  onStatus(listener: (status: MqttConnectionStatus, detail?: string) => void): void {
    this.statusListeners.add(listener);
  }

  async emit(topic: string, body: unknown, options: { qos?: 0 | 1; retained?: boolean } = {}): Promise<void> {
    const message: MqttMessage = {
      topic,
      payload: new TextEncoder().encode(JSON.stringify(body)),
      qos: options.qos ?? 1,
      retained: options.retained ?? false
    };
    await Promise.all([...this.messageListeners].map((listener) => listener(message)));
  }

  setConnected(value: boolean): void {
    this.connected = value;
    for (const listener of this.statusListeners) listener(value ? 'connected' : 'offline');
  }
}

