import type { FastifyInstance } from 'fastify';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/security/password.js';
import { envelope, onlineAvailability, reportedState, telemetry, testConfig } from './helpers/fixtures.js';
import { FakeMqttClient } from './helpers/fake-mqtt.js';

let passwordHash: string;
const openedApps: FastifyInstance[] = [];

beforeAll(async () => {
  passwordHash = await hashPassword('Mat-khau-thu-nghiem-2026!');
});

afterEach(async () => {
  await Promise.all(openedApps.splice(0).map((app) => app.close()));
});

async function setup(): Promise<{ app: FastifyInstance; mqtt: FakeMqttClient; cookie: string; csrf: string }> {
  const mqtt = new FakeMqttClient();
  const app = await createApp(testConfig(passwordHash), { mqtt });
  openedApps.push(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: 'http://localhost:5173' },
    payload: { username: 'chu-phong', password: 'Mat-khau-thu-nghiem-2026!' }
  });
  expect(response.statusCode).toBe(200);
  const body = response.json<{ csrf_token: string }>();
  const setCookie = response.headers['set-cookie'];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = rawCookie?.split(';')[0] ?? '';
  return { app, mqtt, cookie, csrf: body.csrf_token };
}

describe('API máy chủ', () => {
  it('không cho người chưa đăng nhập đọc tổng quan và không để sai mật khẩu tạo phiên', async () => {
    const mqtt = new FakeMqttClient();
    const app = await createApp(testConfig(passwordHash), { mqtt });
    openedApps.push(app);
    const overview = await app.inject({ method: 'GET', url: '/api/overview' });
    expect(overview.statusCode).toBe(401);
    expect(overview.json().error_code).toBe('authentication_required');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'chu-phong', password: 'sai' }
    });
    expect(login.statusCode).toBe(401);
    expect(login.headers['set-cookie']).toBeUndefined();
  });

  it('bảo vệ thao tác ghi bằng CSRF và từ chối cấu hình sai quan hệ', async () => {
    const { app, cookie, csrf } = await setup();
    const desired = (await app.inject({ method: 'GET', url: '/api/config', headers: { cookie } })).json();
    const noCsrf = await app.inject({
      method: 'PUT',
      url: '/api/config/desired',
      headers: { cookie },
      payload: { base_config_version: 1, settings: desired.desired.settings }
    });
    expect(noCsrf.statusCode).toBe(403);
    expect(noCsrf.json().error_code).toBe('csrf_invalid');

    const invalidSettings = structuredClone(desired.desired.settings);
    invalidSettings.light_on_pct = 50;
    invalidSettings.light_off_pct = 52;
    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/config/desired',
      headers: { cookie, 'x-csrf-token': csrf },
      payload: { base_config_version: 1, settings: invalidSettings }
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error_code).toBe('validation_error');
  });

  it('lưu desired hợp lệ ở trạng thái chờ và tạo mẫu lịch sử phút không nội suy', async () => {
    const { app, mqtt, cookie, csrf } = await setup();
    const configResponse = await app.inject({ method: 'GET', url: '/api/config', headers: { cookie } });
    const settings = configResponse.json().desired.settings;
    settings.light_on_pct = 25;
    settings.light_off_pct = 45;
    const update = await app.inject({
      method: 'PUT',
      url: '/api/config/desired',
      headers: { cookie, 'x-csrf-token': csrf },
      payload: { base_config_version: 1, settings }
    });
    expect(update.statusCode).toBe(202);
    expect(update.json().applied).toBe(false);
    expect(update.json().desired.version).toBe(2);
    expect(mqtt.publications.some((item) => item.topic.endsWith('/config/desired') && item.retain)).toBe(true);

    const root = 'smartroom/v1/devices/room-01';
    await mqtt.emit(`${root}/telemetry/sensors`, telemetry('telemetry-history-1', 37));
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const history = await app.inject({
      method: 'GET',
      url: `/api/history?metric=light&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: { cookie }
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().gap_policy).toBe('missing_buckets_omitted');
    expect(history.json().points).toHaveLength(1);
    expect(history.json().points[0].value).toBe(37);
  });

  it('giữ lệnh ở pending tới commands/result và cập nhật desired sau giao dịch ghép', async () => {
    const { app, mqtt, cookie, csrf } = await setup();
    const root = 'smartroom/v1/devices/room-01';
    await mqtt.emit(`${root}/availability`, onlineAvailability(), { retained: true });
    await mqtt.emit(`${root}/state/reported`, reportedState(), { retained: true });

    const needsConfirmation = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { cookie, 'x-csrf-token': csrf },
      payload: { operation: 'set_device', target: 'lamp', value: 'on' }
    });
    expect(needsConfirmation.statusCode).toBe(409);
    expect(needsConfirmation.json().error_code).toBe('manual_confirmation_required');

    const accepted = await app.inject({
      method: 'POST',
      url: '/api/commands',
      headers: { cookie, 'x-csrf-token': csrf },
      payload: {
        operation: 'set_device',
        target: 'lamp',
        value: 'on',
        expected_state_version: 44,
        options: { user_confirmed: true, force_manual: true }
      }
    });
    expect(accepted.statusCode).toBe(202);
    const acceptedBody = accepted.json();
    expect(acceptedBody.applied).toBe(false);
    expect(acceptedBody.command.status).toBe('pending');
    const commandId: string = acceptedBody.command.commandId;
    const requestPublish = mqtt.publications.find((item) => item.topic.endsWith('/commands/request') && item.payload.includes(commandId));
    expect(requestPublish?.retain).toBe(false);
    const wire = JSON.parse(requestPublish!.payload);
    expect(wire.data.base_config_version).toBe(1);
    expect(wire.data.new_config_version).toBe(2);

    await mqtt.emit(
      `${root}/commands/result`,
      envelope(`result-${commandId}`, {
        command_id: commandId,
        result: 'applied',
        reason_code: 'none',
        config_version: 2,
        state_version: 45,
        actual_state: { lamp_on: true, control_mode: 'manual' },
        uno_ack: true,
        replayed: false
      })
    );

    const commandResponse = await app.inject({ method: 'GET', url: `/api/commands/${commandId}`, headers: { cookie } });
    expect(commandResponse.json().command.status).toBe('applied');
    const configResponse = await app.inject({ method: 'GET', url: '/api/config', headers: { cookie } });
    expect(configResponse.json().desired.version).toBe(2);
    expect(configResponse.json().desired.settings.control_mode).toBe('manual');
    const retainedDesired = mqtt.publications.find(
      (item) => item.topic.endsWith('/config/desired') && item.retain && JSON.parse(item.payload).data.config_version === 2
    );
    expect(retainedDesired).toBeDefined();
  });
});
