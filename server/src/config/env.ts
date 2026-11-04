import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  nodeEnv: string;
  httpHost: string;
  httpPort: number;
  webDevPort: number;
  webOrigin: string;
  deviceId: string;
  dbFile: string;
  retentionDays: number;
  retentionIntervalSeconds: number;
  retentionBatchSize: number;
  mqttEnabled: boolean;
  mqttUrl: string;
  mqttDeviceRoot: string;
  mqttClientId: string;
  mqttUsername: string | undefined;
  mqttPassword: string | undefined;
  ownerUsername: string;
  ownerPasswordHash: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  sessionCookieName: string;
  cookieSecure: boolean;
  sseReplaySize: number;
  logLevel: string;
}

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

export function resolveProjectFile(value: string): string {
  if (value === ':memory:') return value;
  if (isAbsolute(value)) return resolve(value);
  return resolve(projectRoot, value);
}

function integerFromEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} phải là số nguyên trong khoảng ${minimum}..${maximum}.`);
  }
  return value;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${name} chỉ nhận true hoặc false.`);
}

function requiredSecret(name: string, minimumLength: number): string {
  const value = process.env[name]?.trim() ?? '';
  if (value.length < minimumLength || /^THAY_BANG_/i.test(value)) {
    throw new Error(`${name} chưa được cấu hình an toàn (tối thiểu ${minimumLength} ký tự).`);
  }
  return value;
}

function optionalSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '' || /^THAY_BANG_/i.test(value)) return undefined;
  return value;
}

function validateDeviceId(value: string): string {
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(value)) {
    throw new Error('DEVICE_ID không đúng miền [a-z0-9][a-z0-9-]{2,31}.');
  }
  return value;
}

export function loadConfig(): ServerConfig {
  const webDevPort = integerFromEnv('WEB_DEV_PORT', 5173, 1, 65535);
  const mqttEnabled = booleanFromEnv('MQTT_ENABLED', true);
  const mqttUsername = optionalSecret('MQTT_USERNAME') ?? process.env.MQTT_USERNAME?.trim();
  const mqttPassword = optionalSecret('MQTT_PASSWORD');
  if (mqttEnabled && (!mqttUsername || !mqttPassword)) {
    throw new Error('MQTT_ENABLED=true yêu cầu MQTT_USERNAME và MQTT_PASSWORD thật ở môi trường chạy.');
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    httpHost: process.env.HTTP_HOST?.trim() || '127.0.0.1',
    httpPort: integerFromEnv('HTTP_PORT', 3000, 1, 65535),
    webDevPort,
    webOrigin: process.env.WEB_ORIGIN?.trim() || `http://localhost:${webDevPort}`,
    deviceId: validateDeviceId(process.env.DEVICE_ID?.trim() || 'room-01'),
    dbFile: resolveProjectFile(process.env.DB_FILE?.trim() || './data/smartroom.sqlite3'),
    retentionDays: integerFromEnv('RETENTION_DAYS', 30, 1, 3650),
    retentionIntervalSeconds: integerFromEnv('RETENTION_INTERVAL_SECONDS', 3600, 60, 86_400),
    retentionBatchSize: integerFromEnv('RETENTION_BATCH_SIZE', 500, 10, 10_000),
    mqttEnabled,
    mqttUrl: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    mqttDeviceRoot: process.env.MQTT_DEVICE_ROOT ?? 'smartroom/v1/devices',
    mqttClientId: process.env.MQTT_CLIENT_ID ?? 'smartroom-backend',
    mqttUsername,
    mqttPassword,
    ownerUsername: process.env.OWNER_USERNAME?.trim() || 'chu-phong',
    ownerPasswordHash: requiredSecret('OWNER_PASSWORD_HASH', 32),
    sessionSecret: requiredSecret('SESSION_SECRET', 32),
    sessionTtlSeconds: integerFromEnv('SESSION_TTL_SECONDS', 28_800, 900, 604_800),
    sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || 'smartroom_session',
    cookieSecure: booleanFromEnv('COOKIE_SECURE', false),
    sseReplaySize: integerFromEnv('SSE_REPLAY_SIZE', 256, 32, 4096),
    logLevel: process.env.LOG_LEVEL?.trim() || 'info'
  };
}
