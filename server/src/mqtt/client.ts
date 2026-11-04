export interface MqttMessage {
  topic: string;
  payload: Uint8Array;
  qos: 0 | 1;
  retained: boolean;
}

export type MqttConnectionStatus = 'connected' | 'reconnecting' | 'offline' | 'closed' | 'error';

export interface MqttPort {
  connect(): Promise<void>;
  publish(topic: string, payload: string, qos: 0 | 1, retain: boolean): Promise<void>;
  subscribe(topic: string, qos: 0 | 1): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
  onMessage(listener: (message: MqttMessage) => void | Promise<void>): void;
  onStatus(listener: (status: MqttConnectionStatus, detail?: string) => void): void;
}

export class DisabledMqttClient implements MqttPort {
  onMessage(_listener: (message: MqttMessage) => void | Promise<void>): void {}
  onStatus(_listener: (status: MqttConnectionStatus, detail?: string) => void): void {}
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  isConnected(): boolean {
    return false;
  }
  async subscribe(_topic: string, _qos: 0 | 1): Promise<void> {}
  async publish(_topic: string, _payload: string, _qos: 0 | 1, _retain: boolean): Promise<void> {
    throw new Error('MQTT đang bị vô hiệu hóa.');
  }
}

