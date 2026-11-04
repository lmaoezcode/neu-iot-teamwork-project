import { connect as mqttConnect, type IClientOptions, type MqttClient } from 'mqtt';
import type { ServerConfig } from '../config/env.js';
import type { MqttConnectionStatus, MqttMessage, MqttPort } from './client.js';

export class MqttJsClient implements MqttPort {
  private client: MqttClient | null = null;
  private readonly subscriptions = new Map<string, 0 | 1>();
  private readonly messageListeners = new Set<(message: MqttMessage) => void | Promise<void>>();
  private readonly statusListeners = new Set<(status: MqttConnectionStatus, detail?: string) => void>();

  constructor(private readonly config: ServerConfig) {}

  async connect(): Promise<void> {
    if (this.client) return;
    const options: IClientOptions = {
      protocolVersion: 4,
      clean: true,
      clientId: this.config.mqttClientId,
      keepalive: 30,
      reconnectPeriod: 2000,
      connectTimeout: 10_000,
      resubscribe: true
    };
    if (this.config.mqttUsername) options.username = this.config.mqttUsername;
    if (this.config.mqttPassword) options.password = this.config.mqttPassword;

    const client = mqttConnect(this.config.mqttUrl, options);
    this.client = client;
    client.on('connect', () => {
      this.emitStatus('connected');
      for (const [topic, qos] of this.subscriptions) {
        client.subscribe(topic, { qos }, (error) => {
          if (error) this.emitStatus('error', `subscribe:${error.message}`);
        });
      }
    });
    client.on('reconnect', () => this.emitStatus('reconnecting'));
    client.on('offline', () => this.emitStatus('offline'));
    client.on('close', () => this.emitStatus('closed'));
    client.on('error', (error) => this.emitStatus('error', error.message));
    client.on('message', (topic, payload, packet) => {
      const message: MqttMessage = {
        topic,
        payload: new Uint8Array(payload),
        qos: packet.qos === 0 ? 0 : 1,
        retained: packet.retain
      };
      for (const listener of this.messageListeners) {
        void Promise.resolve(listener(message)).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : 'mqtt_message_handler_failed';
          this.emitStatus('error', detail);
        });
      }
    });
  }

  async subscribe(topic: string, qos: 0 | 1): Promise<void> {
    this.subscriptions.set(topic, qos);
    if (!this.client?.connected) return;
    await new Promise<void>((resolve, reject) => {
      this.client!.subscribe(topic, { qos }, (error) => (error ? reject(error) : resolve()));
    });
  }

  async publish(topic: string, payload: string, qos: 0 | 1, retain: boolean): Promise<void> {
    if (Buffer.byteLength(payload, 'utf8') > 2048) throw new Error('MQTT payload vượt giới hạn 2.048 byte.');
    if (!this.client?.connected) throw new Error('Bộ môi giới MQTT chưa kết nối.');
    await new Promise<void>((resolve, reject) => {
      this.client!.publish(topic, payload, { qos, retain }, (error) => (error ? reject(error) : resolve()));
    });
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (!client) return;
    await new Promise<void>((resolve) => client.end(false, {}, () => resolve()));
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  onMessage(listener: (message: MqttMessage) => void | Promise<void>): void {
    this.messageListeners.add(listener);
  }

  onStatus(listener: (status: MqttConnectionStatus, detail?: string) => void): void {
    this.statusListeners.add(listener);
  }

  private emitStatus(status: MqttConnectionStatus, detail?: string): void {
    for (const listener of this.statusListeners) {
      if (detail === undefined) listener(status);
      else listener(status, detail);
    }
  }
}
