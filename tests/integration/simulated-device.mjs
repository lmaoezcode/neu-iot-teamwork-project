/**
 * MÔ PHỎNG: thiết bị này chỉ tái hiện hợp đồng MQTT 1.0 của ESP32/UNO.
 * Nó không phải bằng chứng board, UART, cảm biến hoặc đầu ra vật lý đã chạy.
 */
import { createRequire } from 'node:module';

const requireFromServer = createRequire(new URL('../../server/package.json', import.meta.url));
const { connect } = requireFromServer('mqtt');

const initialSettings = Object.freeze({
  light_on_pct: 30,
  light_off_pct: 50,
  control_mode: 'auto',
  room_profile: 'home',
  light_calibration: { dark_adc: 0, bright_adc: 1023, enabled: false },
  mq2: { baseline_adc: 0, span_adc: 1, threshold_pct: 80, calibration_enabled: false },
  door_zone: { threshold_mm: 500, confirm_samples: 3, calibration_enabled: false }
});

const clone = (value) => structuredClone(value);

function waitForConnect(client, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Thiết bị mô phỏng không kết nối được broker đúng hạn.'));
    }, timeoutMs);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off('connect', onConnect);
      client.off('error', onError);
    };
    client.once('connect', onConnect);
    client.once('error', onError);
  });
}

function subscribe(client, topics) {
  return new Promise((resolve, reject) => {
    client.subscribe(topics, { qos: 1 }, (error) => (error ? reject(error) : resolve()));
  });
}

function publish(client, topic, payload, qos, retain) {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos, retain }, (error) => (error ? reject(error) : resolve()));
  });
}

function end(client) {
  return new Promise((resolve) => client.end(false, {}, resolve));
}

export class SimulatedDevice {
  constructor({ brokerUrl, deviceId = 'room-01' }) {
    this.brokerUrl = brokerUrl;
    this.deviceId = deviceId;
    this.root = `smartroom/v1/devices/${deviceId}`;
    this.client = null;
    this.sequence = 0;
    this.sampleCounter = 0;
    this.configVersion = 1;
    this.stateVersion = 44;
    this.settings = clone(initialSettings);
    this.outputs = {
      lamp: { on: false, source: 'auto', actuator_mode: 'hardware_real' },
      fan: { on: false, source: 'auto', actuator_mode: 'simulated' },
      lock: { command: 'locked', actuator_mode: 'simulated', mechanical_verified: false }
    };
    this.errors = [];
    this.transportErrors = [];
  }

  async start() {
    const client = connect(this.brokerUrl, {
      protocolVersion: 4,
      clean: true,
      clientId: `stage17-simulator-${process.pid}`,
      reconnectPeriod: 250,
      resubscribe: true,
      connectTimeout: 5000
    });
    this.client = client;
    client.on('error', (error) => {
      this.transportErrors.push(error.message);
      if (this.transportErrors.length > 20) this.transportErrors.shift();
    });
    client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload).catch((error) => this.errors.push(error));
    });
    await waitForConnect(client);
    await subscribe(client, [
      `${this.root}/config/desired`,
      `${this.root}/commands/request`,
      `${this.root}/sync/request`
    ]);
    await this.publishSnapshots('simulator_started');
  }

  async stop() {
    if (!this.client) return;
    const client = this.client;
    this.client = null;
    await end(client);
  }

  assertHealthy() {
    if (this.errors.length > 0) throw this.errors[0];
  }

  isConnected() {
    return this.client?.connected ?? false;
  }

  envelope(category, data) {
    this.sequence += 1;
    return {
      schema: 'smartroom.mqtt',
      schema_version: 1,
      message_id: `stage17-${category.slice(0, 12)}-${String(this.sequence).padStart(6, '0')}`,
      device_id: this.deviceId,
      sent_at: new Date().toISOString(),
      time_quality: 'synced',
      esp_boot_id: 1701,
      uno_boot_id: 1101,
      link_session_id: 17001101,
      data
    };
  }

  async publishEnvelope(suffix, category, data, { qos = 1, retain = false } = {}) {
    const body = JSON.stringify(this.envelope(category, data));
    await this.publishRaw(suffix, body, { qos, retain });
  }

  async publishRaw(suffix, payload, { qos = 1, retain = false } = {}) {
    if (!this.client) throw new Error('Thiết bị mô phỏng chưa khởi động.');
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (Buffer.byteLength(body, 'utf8') > 2048) throw new Error(`Payload mô phỏng quá 2.048 byte: ${suffix}`);
    await publish(this.client, `${this.root}/${suffix}`, body, qos, retain);
  }

  async publishAvailability(reason = 'ready') {
    await this.publishEnvelope('availability', 'availability', {
      status: 'online',
      reason,
      protocol_version: '1.0',
      config_version: this.configVersion,
      state_version: this.stateVersion,
      uptime_ms: 120000 + this.sequence
    }, { retain: true });
  }

  stateData() {
    return {
      state_version: this.stateVersion,
      config_version: this.configVersion,
      room_profile: this.settings.room_profile,
      control_mode: this.settings.control_mode,
      outputs: clone(this.outputs),
      security: { door_zone_armed: this.settings.room_profile !== 'home' },
      alert: { lifecycle: 'normal', active_count: 0 },
      alarm_output: { led: false, buzzer: false, buzzer_available: false },
      health: { connection: 'online', sensor_fault: false, queue_depth: 0 }
    };
  }

  async publishState() {
    await this.publishEnvelope('state/reported', 'state', this.stateData(), { retain: true });
  }

  async publishReportedConfig(applyResult = 'applied') {
    await this.publishEnvelope('config/reported', 'config', {
      config_version: this.configVersion,
      apply_result: applyResult,
      reason_code: 'none',
      reported_at_uptime_ms: 120000 + this.sequence,
      settings: clone(this.settings)
    }, { retain: true });
  }

  async publishAlertSnapshot() {
    await this.publishEnvelope('alerts/reported', 'alerts', {
      causes: [],
      active_count: 0,
      maximum_severity: 'info',
      lifecycle: 'normal',
      alarm_led: false,
      buzzer: false,
      buzzer_available: false
    }, { retain: true });
  }

  async publishDiagnostics() {
    await this.publishEnvelope('diagnostics', 'diagnostics', {
      uptime_ms: 120000 + this.sequence,
      health_flags: 0,
      uart_crc_errors: 0,
      uart_frame_errors: 0,
      uno_queue_overflows: 0,
      last_error: 'none',
      local_detail: 0,
      offline_queue_depth: 0,
      offline_queue_dropped: 0,
      mqtt_inbound_dropped: 0
    }, { qos: 0 });
  }

  async publishTelemetry(lightPct = 37) {
    this.sampleCounter += 1;
    await this.publishEnvelope('telemetry/sensors', 'telemetry', {
      uptime_ms: 120000 + this.sampleCounter * 1000,
      sample_counter: this.sampleCounter,
      light: { adc: Math.round(lightPct * 10.23), relative_pct: lightPct, quality: 'valid' },
      door_zone: { distance_mm: 840, state: 'clear', quality: 'valid' },
      mq2: { adc: null, relative_pct: null, state: 'sensor_fault', quality: 'invalid', heat_status: 'warming' },
      flame: { raw: null, state: 'sensor_fault', quality: 'invalid' }
    }, { qos: 0 });
  }

  async publishSnapshots(reason) {
    await this.publishReportedConfig('unchanged');
    await this.publishState();
    await this.publishAlertSnapshot();
    await this.publishAvailability(reason);
    await this.publishDiagnostics();
  }

  async handleMessage(topic, payload) {
    let envelope;
    try {
      envelope = JSON.parse(payload.toString('utf8'));
    } catch {
      throw new Error(`Thiết bị mô phỏng nhận JSON không hợp lệ ở ${topic}.`);
    }
    if (envelope?.schema !== 'smartroom.mqtt' || envelope.schema_version !== 1 || envelope.device_id !== this.deviceId) {
      throw new Error(`Thiết bị mô phỏng nhận envelope không tương thích ở ${topic}.`);
    }
    if (topic === `${this.root}/config/desired`) {
      await this.applyDesiredConfig(envelope.data);
      return;
    }
    if (topic === `${this.root}/commands/request`) {
      await this.applyCommand(envelope.data);
      return;
    }
    if (topic === `${this.root}/sync/request`) await this.synchronize(envelope.data);
  }

  async applyDesiredConfig(data) {
    if (!data || !Number.isInteger(data.config_version) || typeof data.settings !== 'object') {
      throw new Error('Cấu hình desired mô phỏng thiếu phiên bản/settings.');
    }
    const changed = data.config_version !== this.configVersion || JSON.stringify(data.settings) !== JSON.stringify(this.settings);
    this.configVersion = data.config_version;
    this.settings = clone(data.settings);
    if (changed) this.stateVersion += 1;
    await this.publishReportedConfig(changed ? 'applied' : 'unchanged');
    await this.publishState();
    await this.publishAvailability('ready');
  }

  async applyCommand(data) {
    if (!data || typeof data.command_id !== 'string') throw new Error('Lệnh mô phỏng thiếu command_id.');
    if (data.operation === 'set_device' && (data.target === 'lamp' || data.target === 'fan')) {
      this.outputs[data.target].on = data.value === 'on';
      this.outputs[data.target].source = 'manual';
      if (data.options?.force_manual) this.settings.control_mode = 'manual';
    } else if (data.operation === 'set_control_mode') {
      this.settings.control_mode = data.value;
    } else if (data.operation === 'set_room_profile') {
      this.settings.room_profile = data.value;
    } else if (data.operation === 'set_lock') {
      this.outputs.lock.command = data.value;
      if (data.options?.transition_home) this.settings.room_profile = 'home';
    } else if (data.operation !== 'alert_action') {
      throw new Error(`Lệnh mô phỏng không hỗ trợ: ${data.operation}.`);
    }
    this.configVersion = data.new_config_version;
    this.stateVersion += 1;
    await this.publishEnvelope('commands/result', 'command', {
      command_id: data.command_id,
      result: 'applied',
      reason_code: 'none',
      config_version: this.configVersion,
      state_version: this.stateVersion,
      actual_state: {
        lamp_on: this.outputs.lamp.on,
        fan_on: this.outputs.fan.on,
        room_profile: this.settings.room_profile,
        control_mode: this.settings.control_mode,
        lock_command: this.outputs.lock.command
      },
      uno_ack: true,
      replayed: false
    });
    await this.publishState();
    await this.publishReportedConfig('applied');
    await this.publishAvailability('ready');
  }

  async synchronize(data) {
    const syncId = data?.sync_id;
    if (typeof syncId !== 'string') throw new Error('Yêu cầu sync mô phỏng thiếu sync_id.');
    await this.publishEnvelope('sync/status', 'sync', {
      sync_id: syncId,
      result: 'started',
      config_version: this.configVersion,
      state_version: this.stateVersion,
      queue_remaining: 0,
      reason_code: 'none'
    });
    await this.publishSnapshots('sync_completed');
    await this.publishEnvelope('sync/status', 'sync', {
      sync_id: syncId,
      result: 'completed',
      config_version: this.configVersion,
      state_version: this.stateVersion,
      queue_remaining: 0,
      reason_code: 'none'
    });
  }
}
