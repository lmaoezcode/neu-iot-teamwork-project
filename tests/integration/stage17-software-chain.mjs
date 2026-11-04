/**
 * Giai đoạn 17 — phép thử tích hợp phần mềm toàn chuỗi.
 *
 * MÔ PHỎNG: thay UNO/ESP32 thật bằng SimulatedDevice. Broker, server, SQLite,
 * Vite proxy, HTTP/CSRF và SSE vẫn là các implementation sản phẩm thật.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SimulatedDevice } from './simulated-device.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const webRoot = path.join(root, 'web');
const mosquittoExecutable = path.join(root, 'tools', '.mosquitto', 'mosquitto.exe');
const evidencePath = path.join(root, 'data', 'logs', 'stage17-software-integration.json');
const results = [];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function pass(label, detail) {
  results.push({ label, detail });
  process.stdout.write(`[ĐẠT] ${label}: ${detail}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object', 'Không cấp được cổng loopback tạm.');
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function distinctPorts(count) {
  const ports = new Set();
  while (ports.size < count) ports.add(await freePort());
  return [...ports];
}

async function waitForPort(port, child, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Mosquitto dừng sớm với mã ${child.exitCode}.`);
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port });
        socket.setTimeout(500);
        socket.once('connect', () => {
          socket.end();
          resolve();
        });
        socket.once('timeout', () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
        socket.once('error', reject);
      });
      return;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw new Error(`Mosquitto không mở cổng ${port}: ${lastError instanceof Error ? lastError.message : 'timeout'}`);
}

async function waitUntil(label, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  const suffix = lastError instanceof Error ? ` (${lastError.message})` : '';
  throw new Error(`${label} không đạt trước thời hạn${suffix}.`);
}

async function terminate(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([once(child, 'exit'), delay(3000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([once(child, 'exit'), delay(2000)]);
  }
}

async function startBroker(directory, port) {
  assert(existsSync(mosquittoExecutable), 'Thiếu tools/.mosquitto/mosquitto.exe; hãy chuẩn bị Mosquitto theo Giai đoạn 13.');
  const configPath = path.join(directory, 'mosquitto-stage17.conf');
  const config = [
    `listener ${port} 127.0.0.1`,
    'protocol mqtt',
    'listener_allow_anonymous true',
    'max_connections 8',
    'max_qos 1',
    'message_size_limit 2048',
    'max_packet_size 4096',
    'persistence false',
    'connection_messages false',
    'log_dest stdout',
    'log_type error',
    'log_type warning',
    'log_type notice',
    ''
  ].join('\n');
  await writeFile(configPath, config, 'utf8');
  const child = spawn(mosquittoExecutable, ['-c', configPath, '-v'], {
    cwd: path.dirname(mosquittoExecutable),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const capture = (chunk) => {
    output = `${output}${chunk.toString('utf8')}`.slice(-20000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  await waitForPort(port, child);
  return { child, output: () => output };
}

function cookieFrom(response) {
  const value = response.headers.get('set-cookie');
  assert(value, 'Phản hồi đăng nhập không có cookie phiên.');
  return value.split(';', 1)[0];
}

async function jsonRequest(baseUrl, pathName, options = {}) {
  const method = options.method ?? 'GET';
  const headers = { accept: 'application/json' };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers['x-csrf-token'] = options.csrf;
  if (method !== 'GET' && method !== 'HEAD') headers.origin = baseUrl;
  let body;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathName}`, { method, headers, body });
  let payload = null;
  if (response.status !== 204) {
    const text = await response.text();
    payload = text === '' ? null : JSON.parse(text);
  }
  if (!response.ok) {
    throw new Error(`${method} ${pathName} trả ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { response, payload };
}

async function captureSseEvent({ baseUrl, cookie, eventName, trigger }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl}/api/events/stream`, {
      headers: { accept: 'text/event-stream', cookie },
      signal: controller.signal
    });
    assert(response.ok, `SSE trả HTTP ${response.status}.`);
    assert(response.headers.get('content-type')?.includes('text/event-stream'), 'SSE thiếu content-type đúng.');
    assert(response.body, 'SSE không có response body.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const readEvent = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) throw new Error('Luồng SSE đóng trước khi nhận sự kiện cần tìm.');
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          if (!block.includes(`event: ${eventName}`)) continue;
          const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
          return dataLine ? JSON.parse(dataLine.slice(6)) : {};
        }
      }
    })();
    await trigger();
    return await readEvent;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function main() {
  const [brokerPort, apiPort, webPort] = await distinctPorts(3);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'super-iot-stage17-'));
  const databaseFile = path.join(temporaryRoot, 'stage17.sqlite3');
  let broker;
  let simulator;
  let app;
  let vite;
  let restartedApp;
  let brokerOutput = '';
  try {
    const compatibility = JSON.parse(await readFile(path.join(root, 'config', 'integration-compatibility.json'), 'utf8'));
    assert(compatibility.status === 'software_chain_verified_hardware_pending', 'Manifest tích hợp không ở trạng thái mong đợi.');
    pass('Ma trận tương thích', 'UART 1.0/0x10, MQTT schema 1, server+CR-04, SQLite migration 001 và web 1.0');

    broker = await startBroker(temporaryRoot, brokerPort);
    pass('Broker vận chuyển thật', `Mosquitto loopback nhận MQTT 3.1.1 ở cổng tạm ${brokerPort}`);

    simulator = new SimulatedDevice({ brokerUrl: `mqtt://127.0.0.1:${brokerPort}` });
    await simulator.start();

    const appModuleUrl = pathToFileURL(path.join(root, 'server', 'dist', 'app.js')).href;
    const passwordModuleUrl = pathToFileURL(path.join(root, 'server', 'dist', 'security', 'password.js')).href;
    const [{ createApp }, { hashPassword }] = await Promise.all([
      import(appModuleUrl),
      import(passwordModuleUrl)
    ]);
    const ownerPassword = 'Mat-khau-thu-nghiem-tich-hop-2026!';
    const config = {
      nodeEnv: 'test',
      httpHost: '127.0.0.1',
      httpPort: apiPort,
      webDevPort: webPort,
      webOrigin: `http://127.0.0.1:${webPort}`,
      deviceId: compatibility.device_id,
      dbFile: databaseFile,
      retentionDays: 30,
      retentionIntervalSeconds: 3600,
      retentionBatchSize: 500,
      mqttEnabled: true,
      mqttUrl: `mqtt://127.0.0.1:${brokerPort}`,
      mqttDeviceRoot: compatibility.contracts.mqtt.topic_root,
      mqttClientId: `stage17-backend-${process.pid}`,
      mqttUsername: undefined,
      mqttPassword: undefined,
      ownerUsername: 'chu-phong',
      ownerPasswordHash: await hashPassword(ownerPassword),
      sessionSecret: 'stage17-simulation-session-secret-32-characters-minimum',
      sessionTtlSeconds: 3600,
      sessionCookieName: 'smartroom_session',
      cookieSecure: false,
      sseReplaySize: 64,
      logLevel: 'silent'
    };
    app = await createApp(config);
    await app.listen({ host: '127.0.0.1', port: apiPort });

    const requireFromWeb = createRequire(path.join(webRoot, 'package.json'));
    const viteEntry = requireFromWeb.resolve('vite');
    const { createServer } = await import(pathToFileURL(viteEntry).href);
    vite = await createServer({
      root: webRoot,
      configFile: false,
      logLevel: 'silent',
      appType: 'spa',
      server: {
        host: '127.0.0.1',
        port: webPort,
        strictPort: true,
        proxy: {
          '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false },
          '/health': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false }
        }
      }
    });
    await vite.listen();
    const webBase = `http://127.0.0.1:${webPort}`;

    const page = await fetch(`${webBase}/`);
    const pageText = await page.text();
    const entry = await fetch(`${webBase}/src/main.ts`);
    const entryText = await entry.text();
    assert(page.ok && pageText.includes('<html lang="vi">'), 'Vite không phục vụ HTML tiếng Việt.');
    assert(entry.ok && entryText.includes('SmartRoomApp'), 'Vite không biên dịch entry TypeScript của web.');
    pass('Web/Vite thật', 'SPA tiếng Việt và entry TypeScript được phục vụ qua Vite');

    const health = await waitUntil('Kết nối server–broker', async () => {
      simulator.assertHealthy();
      const response = await fetch(`${webBase}/health`);
      if (!response.ok) return false;
      const body = await response.json();
      return body.mqtt === 'connected' && body.storage === 'sqlite' ? body : false;
    });
    assert(health.deviceId === 'room-01', 'Health trả sai device_id.');
    pass('Server–MQTT–SQLite', 'server kết nối broker và báo storage=sqlite');

    const login = await jsonRequest(webBase, '/api/auth/login', {
      method: 'POST',
      body: { username: 'chu-phong', password: ownerPassword }
    });
    assert(login.payload?.authenticated === true, 'Đăng nhập không tạo phiên xác thực.');
    const cookie = cookieFrom(login.response);
    const csrf = login.payload.csrf_token;
    assert(typeof csrf === 'string' && csrf.length > 10, 'Đăng nhập thiếu CSRF token.');
    const session = await jsonRequest(webBase, '/api/session', { cookie });
    assert(session.payload?.authenticated === true, 'Cookie phiên không đi qua Vite proxy.');
    pass('Phiên web và CSRF', 'đăng nhập qua proxy tạo cookie HttpOnly và CSRF token dùng được');

    await simulator.publishTelemetry(37);
    const overview = await waitUntil('Snapshot thiết bị tại API', async () => {
      simulator.assertHealthy();
      const current = await jsonRequest(webBase, '/api/overview', { cookie });
      const value = current.payload?.overview;
      return value?.availability?.data?.status === 'online' &&
        value?.telemetry?.data?.light?.relative_pct === 37 &&
        value?.state?.data?.config_version === value?.desiredConfig?.version &&
        value?.reportedConfig?.data?.config_version === value?.desiredConfig?.version
        ? current.payload
        : false;
    });
    assert(overview.overview.storageMode === 'sqlite', 'Overview không dùng SQLite.');
    pass('Telemetry → API', 'snapshot mô phỏng đi qua MQTT, schema validation và SQLite tới overview');

    const stateVersion = overview.overview.state.data.state_version;
    const command = await jsonRequest(webBase, '/api/commands', {
      method: 'POST',
      cookie,
      csrf,
      body: {
        operation: 'set_device',
        target: 'lamp',
        value: 'on',
        expected_state_version: stateVersion,
        options: { user_confirmed: true, force_manual: true }
      }
    });
    assert(command.response.status === 202 && command.payload?.command?.status === 'pending', 'Lệnh không đi vào trạng thái pending.');
    const commandId = command.payload.command.commandId;
    const appliedCommand = await waitUntil('ACK lệnh đầu-cuối', async () => {
      simulator.assertHealthy();
      const current = await jsonRequest(webBase, `/api/commands/${encodeURIComponent(commandId)}`, { cookie });
      return current.payload?.command?.status === 'applied' ? current.payload.command : false;
    });
    assert(appliedCommand.actualState?.lamp_on === true, 'ACK lệnh không chứa trạng thái đèn đã xác nhận.');
    const commandOverview = await waitUntil('Trạng thái sau lệnh', async () => {
      const current = await jsonRequest(webBase, '/api/overview', { cookie });
      const value = current.payload?.overview;
      return value?.state?.data?.outputs?.lamp?.on === true &&
        value?.state?.data?.control_mode === 'manual' &&
        value?.desiredConfig?.version === value?.state?.data?.config_version
        ? current.payload
        : false;
    });
    pass('Lệnh có ACK toàn chuỗi', `command_id ${commandId} chuyển pending → applied, không cập nhật lạc quan`);

    const beforeConfig = await jsonRequest(webBase, '/api/config', { cookie });
    const settings = structuredClone(beforeConfig.payload.desired.settings);
    settings.light_on_pct = 25;
    const configUpdate = await jsonRequest(webBase, '/api/config/desired', {
      method: 'PUT',
      cookie,
      csrf,
      body: { base_config_version: beforeConfig.payload.desired.version, settings }
    });
    assert(configUpdate.response.status === 202, 'API cấu hình không trả 202.');
    const requestedVersion = configUpdate.payload.desired.version;
    const synchronizedConfig = await waitUntil('Desired/reported config', async () => {
      simulator.assertHealthy();
      const current = await jsonRequest(webBase, '/api/config', { cookie });
      return current.payload?.desired?.version === requestedVersion &&
        current.payload?.desired?.deliveryStatus === 'applied' &&
        current.payload?.reported?.data?.config_version === requestedVersion
        ? current.payload
        : false;
    });
    assert(synchronizedConfig.desired.settings.light_on_pct === 25, 'Giá trị cấu hình đã áp dụng không khớp.');
    pass('Cấu hình desired/reported', `phiên bản ${requestedVersion} được lưu, publish retained và thiết bị mô phỏng báo applied`);

    const sseData = await captureSseEvent({
      baseUrl: webBase,
      cookie,
      eventName: 'telemetry.updated',
      trigger: () => simulator.publishTelemetry(64)
    });
    assert(sseData.light?.relative_pct === 64, 'SSE telemetry không mang mẫu 64%.');
    pass('SSE thời gian thực', 'telemetry.updated đi qua server và Vite proxy tới client stream');

    const from = new Date(Date.now() - 5 * 60_000).toISOString();
    const to = new Date(Date.now() + 5 * 60_000).toISOString();
    const history = await jsonRequest(
      webBase,
      `/api/history?metric=light&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { cookie }
    );
    assert(history.payload?.storage_mode === 'sqlite' && history.payload?.points?.length > 0, 'Lịch sử không đọc được mẫu SQLite.');
    pass('Lịch sử bền vững', `${history.payload.points.length} bucket ánh sáng đọc lại từ SQLite`);

    const invalidTelemetry = simulator.envelope('invalid', { unexpected: true });
    await simulator.publishRaw('telemetry/sensors', invalidTelemetry, { qos: 0 });
    await waitUntil('Log loại schema sai', async () => {
      const logs = await jsonRequest(webBase, '/api/logs?type=system&severity=warning&limit=100', { cookie });
      return logs.payload?.items?.some((item) =>
        item.message.includes('MQTT không hợp lệ') && item.details?.reason === 'invalid_schema'
      );
    });
    const afterInvalid = await jsonRequest(webBase, '/api/overview', { cookie });
    assert(afterInvalid.payload.overview.telemetry.data.light.relative_pct === 64, 'Schema sai đã ghi đè telemetry hợp lệ.');
    pass('Loại payload sai schema', 'bản tin bị ghi log warning và không ghi đè snapshot hợp lệ');

    const beforeStale = await jsonRequest(webBase, '/api/overview', { cookie });
    const currentState = beforeStale.payload.overview.state.data;
    const staleState = structuredClone(currentState);
    staleState.state_version = Math.max(0, currentState.state_version - 1);
    staleState.outputs.lamp.on = false;
    await simulator.publishRaw('state/reported', simulator.envelope('stale-state', staleState), { retain: true });
    await delay(300);
    const afterStale = await jsonRequest(webBase, '/api/overview', { cookie });
    assert(afterStale.payload.overview.state.data.state_version === currentState.state_version, 'State cũ làm lùi state_version.');
    assert(afterStale.payload.overview.state.data.outputs.lamp.on === true, 'State cũ đã ghi đè trạng thái đèn hiện hành.');
    pass('Chống state cũ', 'state_version thấp hơn bị bỏ qua, snapshot không quay lùi');

    const duplicateEventId = `stage17-duplicate-${process.pid}`;
    const duplicateEvent = simulator.envelope('duplicate', {
      event_id: duplicateEventId,
      event_type: 'integration_duplicate_probe',
      severity: 'notice',
      source: 'stage17_simulator',
      occurred_at: new Date().toISOString(),
      uptime_ms: 130000,
      state_version: currentState.state_version,
      details: { scope: 'simulation' },
      replayed: false
    });
    await simulator.publishRaw('events', duplicateEvent);
    await simulator.publishRaw('events', duplicateEvent);
    await waitUntil('Chống trùng message_id', async () => {
      const logs = await jsonRequest(webBase, '/api/logs?type=system&limit=100', { cookie });
      return logs.payload?.items?.filter((item) => item.referenceId === duplicateEventId).length === 1;
    });
    await delay(300);
    const duplicateLogs = await jsonRequest(webBase, '/api/logs?type=system&limit=100', { cookie });
    assert(
      duplicateLogs.payload.items.filter((item) => item.referenceId === duplicateEventId).length === 1,
      'Bản tin trùng message_id tạo nhiều bản ghi sự kiện.'
    );
    pass('Chống trùng MQTT', 'hai lần phát cùng message_id chỉ tạo một sự kiện');

    const replayedVersions = [];
    for (let cycle = 0; cycle < 3; cycle += 1) {
      brokerOutput += broker.output();
      await terminate(broker.child);
      broker = null;
      await waitUntil(`Server nhận biết broker ngoại tuyến lần ${cycle + 1}`, async () => {
        const response = await fetch(`${webBase}/health`);
        if (!response.ok) return false;
        const body = await response.json();
        return body.mqtt !== 'connected' ? body : false;
      });

      const offlineConfig = await jsonRequest(webBase, '/api/config', { cookie });
      const offlineSettings = structuredClone(offlineConfig.payload.desired.settings);
      offlineSettings.light_on_pct = 26 + cycle;
      const queuedWhileOffline = await jsonRequest(webBase, '/api/config/desired', {
        method: 'PUT',
        cookie,
        csrf,
        body: { base_config_version: offlineConfig.payload.desired.version, settings: offlineSettings }
      });
      assert(queuedWhileOffline.response.status === 202, 'Cấu hình ngoại tuyến không được lưu vào outbox.');
      const offlineVersion = queuedWhileOffline.payload.desired.version;
      assert(queuedWhileOffline.payload.desired.deliveryStatus === 'pending_delivery', 'Cấu hình ngoại tuyến bị báo đã giao sai.');

      broker = await startBroker(temporaryRoot, brokerPort);
      await waitUntil(`Thiết bị mô phỏng nối lại broker lần ${cycle + 1}`, () => simulator.isConnected(), 15000);
      await waitUntil(`Server nối lại broker lần ${cycle + 1}`, async () => {
        const response = await fetch(`${webBase}/health`);
        if (!response.ok) return false;
        const body = await response.json();
        return body.mqtt === 'connected' ? body : false;
      }, 15000);
      const replayedConfig = await waitUntil(`Outbox được gửi lại lần ${cycle + 1}`, async () => {
        simulator.assertHealthy();
        const current = await jsonRequest(webBase, '/api/config', { cookie });
        return current.payload?.desired?.version === offlineVersion &&
          current.payload?.desired?.deliveryStatus === 'applied' &&
          current.payload?.reported?.data?.config_version === offlineVersion
          ? current.payload
          : false;
      }, 15000);
      assert(
        replayedConfig.desired.settings.light_on_pct === 26 + cycle,
        `Cấu hình trong outbox sai sau reconnect lần ${cycle + 1}.`
      );
      replayedVersions.push(offlineVersion);
    }
    assert(
      replayedVersions.every((version, index) => index === 0 || version === replayedVersions[index - 1] + 1),
      'Phiên bản cấu hình không tăng đơn điệu qua các chu kỳ reconnect.'
    );
    pass('Broker reconnect và outbox replay', `3 chu kỳ broker thật giữ pending rồi applied; phiên bản ${replayedVersions.join(' → ')}`);
    const finalReplayedVersion = replayedVersions.at(-1);
    assert(Number.isInteger(finalReplayedVersion), 'Thiếu phiên bản cấu hình cuối sau soak reconnect.');

    const databaseStats = await stat(databaseFile);
    assert(databaseStats.size > 0, 'Tệp SQLite rỗng hoặc chưa được tạo.');
    await vite.close();
    vite = null;
    await app.close();
    app = null;

    restartedApp = await createApp({
      ...config,
      mqttEnabled: false,
      mqttClientId: `stage17-restart-${process.pid}`,
      mqttUsername: undefined,
      mqttPassword: undefined,
      logLevel: 'silent'
    });
    const persisted = await restartedApp.inject({
      method: 'GET',
      url: '/api/overview',
      headers: { cookie }
    });
    assert(persisted.statusCode === 200, `Phiên/overview sau restart trả ${persisted.statusCode}.`);
    const persistedBody = persisted.json();
    assert(persistedBody.overview.state.data.outputs.lamp.on === true, 'Trạng thái đèn không còn sau restart.');
    assert(persistedBody.overview.telemetry.data.light.relative_pct === 64, 'Telemetry mới nhất không còn sau restart.');
    assert(persistedBody.overview.desiredConfig.version === finalReplayedVersion, 'Phiên bản desired không còn sau restart.');
    pass('Khôi phục sau restart', 'phiên, trạng thái, telemetry và cấu hình còn trong SQLite khi MQTT tắt');

    simulator.assertHealthy();
    brokerOutput += broker.output();
    const version = brokerOutput.match(/mosquitto version ([0-9.]+)/i)?.[1] ?? '2.1.x';
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify({
      executed_at: new Date().toISOString(),
      scope: 'MÔ PHỎNG PHẦN MỀM — không phải bằng chứng phần cứng',
      broker: `Mosquitto ${version}`,
      result: 'PASS',
      checks: results,
      hardware_evidence: false
    }, null, 2)}\n`, 'utf8');

    process.stdout.write(`\nTóm tắt G17 phần mềm: ${results.length}/${results.length} cổng đạt.\n`);
    process.stdout.write(`Minh chứng máy đọc: ${evidencePath}\n`);
  } catch (error) {
    brokerOutput = broker?.output() ?? brokerOutput;
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`\n[KHÔNG ĐẠT] Tích hợp G17: ${message}\n`);
    if (brokerOutput) process.stderr.write(`\nNhật ký Mosquitto gần nhất:\n${brokerOutput.slice(-4000)}\n`);
    throw error;
  } finally {
    if (restartedApp) await restartedApp.close().catch(() => undefined);
    if (vite) await vite.close().catch(() => undefined);
    if (app) await app.close().catch(() => undefined);
    if (simulator) await simulator.stop().catch(() => undefined);
    await terminate(broker?.child);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch(() => {
  process.exitCode = 1;
});
