import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
let passes = 0;

function pass(label) {
  passes += 1;
  console.log(`[ĐẠT] ${label}`);
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
  console.error(`[KHÔNG ĐẠT] ${label}: ${detail}`);
}

function expect(label, condition, detail) {
  condition ? pass(label) : fail(label, detail);
}

function read(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    fail('File bắt buộc', `thiếu ${relative}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function matches(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function sectionBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex >= 0 ? text.slice(startIndex, endIndex) : '';
}

const requiredFiles = [
  'pnpm-lock.yaml',
  'server/package.json',
  'server/src/index.ts',
  'server/src/app.ts',
  'server/src/api/routes.ts',
  'server/src/config/env.ts',
  'server/src/data/repository.ts',
  'server/src/data/memory-repository.ts',
  'server/src/mqtt/client.ts',
  'server/src/mqtt/mqttjs-client.ts',
  'server/src/realtime/event-stream.ts',
  'server/src/security/login-limiter.ts',
  'server/src/security/password.ts',
  'server/src/security/session-store.ts',
  'server/src/services/smart-room-service.ts',
  'server/src/types/domain.ts',
  'server/src/validation/schemas.ts',
  'server/test/api.test.ts',
  'server/test/event-stream.test.ts',
  'server/test/mqtt-schema.test.ts',
  'server/test/password.test.ts',
  'server/test/service.test.ts',
  'infrastructure/server/Initialize-Server.ps1',
  'infrastructure/server/Start-Server.ps1',
  'infrastructure/server/README.md',
  'docs/16-xay-dung-may-chu-v1.0.md',
  'docs/04-kiem-soat-thay-doi-CR-03.md'
];
expect(
  'Cây triển khai máy chủ',
  requiredFiles.every((file) => fs.existsSync(path.join(root, file))),
  'thiếu một hoặc nhiều file Giai đoạn 14'
);

const rootPackage = JSON.parse(read('package.json') || '{}');
const serverPackage = JSON.parse(read('server/package.json') || '{}');
expect(
  'Workspace và lệnh kiểm tra G14',
  rootPackage.packageManager === 'pnpm@11.19.0' &&
    rootPackage.scripts?.['check:stage14'] === 'node tools/check-stage14.mjs' &&
    Array.isArray(rootPackage.workspaces) && rootPackage.workspaces.includes('server'),
  'package.json gốc chưa khóa workspace/lệnh đúng'
);
expect(
  'Phụ thuộc máy chủ tối thiểu',
  ['fastify', '@fastify/cookie', '@fastify/cors', 'mqtt', 'zod'].every(
    (dependency) => typeof serverPackage.dependencies?.[dependency] === 'string'
  ) &&
    ['typescript', 'tsx', 'vitest'].every(
      (dependency) => typeof serverPackage.devDependencies?.[dependency] === 'string'
    ),
  'thiếu framework, MQTT, validator hoặc công cụ kiểm thử'
);

const routes = read('server/src/api/routes.ts');
const routeTokens = [
  "app.post('/api/auth/login'",
  "app.post('/api/auth/logout'",
  "app.get('/api/session'",
  "app.get('/api/overview'",
  "app.get('/api/config'",
  "app.put('/api/config/desired'",
  "app.post('/api/commands'",
  "'/api/commands/:command_id'",
  "'/api/alerts/:alert_id/mute'",
  "'/api/alerts/:alert_id/ack'",
  "app.get('/api/history'",
  "app.get('/api/logs'",
  "app.get('/api/events/stream'"
];
expect(
  'Bề mặt API/SSE đã khóa',
  routeTokens.every((token) => routes.includes(token)),
  'thiếu một hoặc nhiều route của Thiết kế giao diện 1.0'
);
expect(
  'Bảo vệ phiên, Origin và CSRF',
  routes.includes('assertTrustedOrigin') &&
    routes.includes('requireMutationSession') &&
    routes.includes("request.headers['x-csrf-token']") &&
    routes.includes('login_rate_limited') &&
    routes.includes("httpOnly: true") &&
    routes.includes("sameSite: 'strict'"),
  'thiếu một lớp bảo vệ thao tác web'
);

const mqttClient = read('server/src/mqtt/mqttjs-client.ts');
const service = read('server/src/services/smart-room-service.ts');
const schemas = read('server/src/validation/schemas.ts');
const inboundTopics = [
  'availability',
  'telemetry/sensors',
  'state/reported',
  'config/reported',
  'commands/result',
  'events',
  'alerts/events',
  'alerts/reported',
  'sync/status',
  'diagnostics'
];
const outboundTopics = ['config/desired', 'commands/request', 'sync/request'];
expect(
  'Đủ topic MQTT hai chiều',
  [...inboundTopics, ...outboundTopics].every((topic) => service.includes(`'${topic}'`)),
  'topic máy chủ không khớp Thiết kế MQTT 1.0'
);
expect(
  'MQTT 3.1.1, reconnect và giới hạn payload',
  mqttClient.includes('protocolVersion: 4') &&
    mqttClient.includes('clean: true') &&
    mqttClient.includes('keepalive: 30') &&
    mqttClient.includes('reconnectPeriod: 2000') &&
    mqttClient.includes('resubscribe: true') &&
    mqttClient.includes('2048'),
  'client MQTT thiếu khóa giao thức/reconnect/giới hạn'
);
expect(
  'Schema MQTT chặt và không tuyên bố ppm',
  schemas.includes('.strict()') &&
    schemas.includes('2048') &&
    !/\bppm\b/i.test(schemas) &&
    service.includes('value.device_id !== topic.deviceId'),
  'schema không strict, sai giới hạn, có ppm hoặc thiếu khớp device_id'
);
expect(
  'Lệnh và cấu hình chờ ACK cuối',
  service.includes("status: 'pending'") &&
    service.includes("reasonCode: 'waiting_device_result'") &&
    routes.includes('reply.code(202)') &&
    service.includes('device_result_timeout') &&
    service.includes('applyCommandResult') &&
    service.includes('current.version !== baseVersion'),
  'dịch vụ thiếu pending/timeout/ACK hoặc kiểm tra phiên bản'
);

const app = read('server/src/app.ts');
const repository = read('server/src/data/repository.ts');
const memoryRepository = read('server/src/data/memory-repository.ts');
expect(
  'Ranh giới repository vẫn thay thế được sau G15',
  app.includes('overrides.repository ?? new SQLiteRepository') &&
    repository.includes('export interface DataRepository') &&
    memoryRepository.includes('implements DataRepository') &&
    read('server/src/data/sqlite-repository.ts').includes('implements DataRepository'),
  'API/dịch vụ mất cổng repository hoặc hiện thực G15 không tuân thủ cổng'
);
expect(
  'G14 không giả độ bền dữ liệu',
  service.includes("storage: 'volatile_stage14'") &&
    memoryRepository.includes("storageMode: 'volatile_stage14'") &&
    !/sqlite|better-sqlite|drizzle/i.test(memoryRepository),
  'kho tạm thiếu nhãn hoặc đang giả hiện thực SQLite'
);

const password = read('server/src/security/password.ts');
const sessions = read('server/src/security/session-store.ts');
const limiter = read('server/src/security/login-limiter.ts');
const env = read('server/src/config/env.ts');
expect(
  'Mật khẩu và phiên an toàn',
  password.includes('nodeScrypt') &&
    password.includes('randomBytes(16)') &&
    password.includes('timingSafeEqual') &&
    sessions.includes('createHmac') &&
    sessions.includes('randomBytes') &&
    limiter.includes('maximumAttempts = 5'),
  'thiếu scrypt/salt/so sánh hằng thời gian/HMAC/giới hạn đăng nhập'
);
expect(
  'Không chấp nhận bí mật mẫu',
  env.includes('requiredSecret') && env.includes('/^THAY_BANG_/i') && env.includes("mqttEnabled && (!mqttUsername || !mqttPassword)"),
  'cấu hình có thể chạy với bí mật mẫu/thiếu MQTT credential'
);

const testSources = [
  'server/test/api.test.ts',
  'server/test/event-stream.test.ts',
  'server/test/mqtt-schema.test.ts',
  'server/test/password.test.ts',
  'server/test/service.test.ts'
].map(read).join('\n');
const testCount = matches(testSources, /\bit\(['"`]([^'"`]+)['"`]/g).length +
  matches(testSources, /\btest\(['"`]([^'"`]+)['"`]/g).length;
expect(
  'Bộ kiểm thử G14',
  testCount === 13 &&
    testSources.includes('CSRF') &&
    testSources.includes('không khử nhầm chuyển tiếp pending sang applied') &&
    testSources.includes('không chứa mật khẩu rõ'),
  `mong đợi 13 kiểm thử cùng các cổng bảo mật/CR-03, thực tế đếm ${testCount}`
);

const specification = read('docs/01-dac-ta-he-thong-v1.2.md');
const groupA = matches(
  sectionBetween(specification, '## 5. A —', '## 6. B —'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);
const stageDoc = read('docs/16-xay-dung-may-chu-v1.0.md');
expect(
  'Truy vết chức năng nhóm A',
  groupA.length === 16 && groupA.every((id) => stageDoc.includes(id)),
  `mong đợi 16 chức năng nhóm A có mặt trong tài liệu; đọc được ${groupA.length}`
);
expect(
  'Giới hạn G14 và bàn giao G15 rõ ràng',
  stageDoc.includes('volatile_stage14') &&
    stageDoc.includes('Giai đoạn 15') &&
    stageDoc.includes('không tuyên bố đã đạt lưu trữ 30 ngày') &&
    stageDoc.includes('Toàn bộ `KT01–KT39` đang áp dụng vẫn giữ trạng thái `CHƯA THỰC HIỆN`'),
  'tài liệu có thể gây hiểu sai về độ bền hoặc kết quả thực nghiệm'
);

const firmwareMqtt = read('firmware/esp32/src/mqtt_gateway.cpp');
const cr03 = read('docs/04-kiem-soat-thay-doi-CR-03.md');
expect(
  'CR-03 đã hiện thực và truy vết',
  firmwareMqtt.includes('link_.unoBootId()') &&
    firmwareMqtt.includes('"config-report", nextMessageCounter()') &&
    cr03.includes('pending') && cr03.includes('applied'),
  'firmware hoặc CR-03 chưa thể hiện ID riêng cho từng config/reported'
);

const ignore = read('.gitignore');
const configFiles = fs.existsSync(path.join(root, 'config')) ? fs.readdirSync(path.join(root, 'config')) : [];
expect(
  'Bí mật chạy không nằm trong repository',
  ignore.includes('config/*.local.env') &&
    !configFiles.some((name) => name.endsWith('.local.env')) &&
    read('config/env.example').includes('THAY_BANG_MAT_KHAU_MQTT'),
  'phát hiện env cục bộ hoặc mẫu bí mật không an toàn'
);

const sourceFiles = requiredFiles
  .filter((file) => file.startsWith('server/src/'))
  .map(read)
  .join('\n');
expect(
  'Không còn mã giả trong máy chủ',
  !/\bTODO\b|\bFIXME\b|Giai đoạn 10:/i.test(sourceFiles),
  'còn placeholder/TODO trong mã nguồn G14'
);

const readme = read('README.md');
const workflow = read('docs/00-quy-trinh-du-an.md');
expect(
  'Tài liệu dự án giữ đầu ra G14 và trỏ đúng mốc kế tiếp',
    readme.includes('docs/16-xay-dung-may-chu-v1.0.md') &&
    readme.includes('Giai đoạn 14') &&
    readme.includes('docs/17-xay-dung-co-so-du-lieu-v1.0.md') &&
    (workflow.includes('Giai đoạn 15') || workflow.includes('| 15 | Xây dựng cơ sở dữ liệu |')),
  'README/quy trình làm mất đầu ra G14 hoặc chưa chuyển mốc sang G15'
);

console.log(`\nTóm tắt G14: ${groupA.length}/16 chức năng A; 13 tuyến API; ${inboundTopics.length} topic vào; ${outboundTopics.length} topic ra; ${testCount} kiểm thử.`);
console.log(`Tổng: ${passes} đạt, ${failures.length} không đạt.`);
if (failures.length > 0) process.exit(1);
