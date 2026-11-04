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
  'web/index.html',
  'web/vite.config.ts',
  'web/src/main.ts',
  'web/src/app.ts',
  'web/src/types.ts',
  'web/src/router.ts',
  'web/src/styles.css',
  'web/src/api/client.ts',
  'web/src/realtime/sse-client.ts',
  'web/src/state/store.ts',
  'web/src/state/realtime.ts',
  'web/src/domain/config-validation.ts',
  'web/src/domain/history.ts',
  'web/src/domain/format.ts',
  'web/src/notifications.ts',
  'web/src/ui/render.ts',
  'docs/18-xay-dung-ung-dung-web-v1.0.md',
  'docs/04-kiem-soat-thay-doi-CR-04.md'
];
expect(
  'Cây triển khai ứng dụng web',
  requiredFiles.every((file) => fs.existsSync(path.join(root, file))),
  'thiếu một hoặc nhiều file Giai đoạn 16'
);

const rootPackage = JSON.parse(read('package.json') || '{}');
const webPackage = JSON.parse(read('web/package.json') || '{}');
expect(
  'Lệnh kiểm tra và dựng web',
  rootPackage.scripts?.['check:stage16'] === 'node tools/check-stage16.mjs' &&
    ['typecheck', 'test', 'build'].every((name) => typeof webPackage.scripts?.[name] === 'string'),
  'thiếu checker G16 hoặc lệnh typecheck/test/build của web'
);

const router = read('web/src/router.ts');
const routes = [
  '/dang-nhap', '/tong-quan', '/dieu-khien', '/trang-thai-phong',
  '/cai-dat-tu-dong', '/an-ninh-an-toan', '/lich-su', '/nhat-ky'
];
expect(
  'Đủ tám tuyến và route guard',
  routes.every((route) => router.includes(`'${route}'`)) &&
    router.includes("if (!authenticated) return '/dang-nhap'") &&
    router.includes("route === '/dang-nhap' ? '/tong-quan'"),
  'thiếu tuyến bắt buộc hoặc quy tắc xác thực'
);

const api = read('web/src/api/client.ts');
const realtime = read('web/src/realtime/sse-client.ts');
const merge = read('web/src/state/realtime.ts');
expect(
  'API dùng cookie, CSRF và lỗi thống nhất',
  api.includes("credentials: 'include'") &&
    api.includes("headers.set('x-csrf-token'") &&
    api.includes("'network_unavailable'") &&
    api.includes('if (response.status === 401) this.onUnauthorized()'),
  'thiếu cookie/CSRF/lỗi mạng/xử lý hết phiên'
);
expect(
  'SSE có event tên và phục hồi snapshot',
  realtime.includes("new EventSource('/api/events/stream', { withCredentials: true })") &&
    ['telemetry.updated', 'state.updated', 'availability.updated', 'config.updated', 'command.updated', 'alert.updated', 'event.created']
      .every((name) => realtime.includes(`'${name}'`)) &&
    merge.includes("raw.snapshot === true") &&
    merge.includes('incoming.state_version < currentVersion'),
  'thiếu EventSource/event có tên/snapshot/chống state cũ'
);

const app = read('web/src/app.ts');
const render = read('web/src/ui/render.ts');
expect(
  'Luồng lệnh chờ ACK, không cập nhật lạc quan',
  app.includes('pendingCommand: response.command') &&
    app.includes("'Lệnh đã được máy chủ tiếp nhận và đang chờ thiết bị xác nhận.'") &&
    app.includes('this.startCommandPolling') &&
    app.includes('await this.loadCore()') &&
    render.includes('Đang chờ ACK') &&
    render.includes('Không xác định — đang đồng bộ'),
  'thiếu pending/ACK/poll/sync hoặc có nguy cơ hiển thị thành công giả'
);
expect(
  'Quy tắc xung đột và nhãn phạm vi',
  app.includes('force_manual: true') &&
    app.includes("state.room_profile !== 'home'") &&
    render.includes('Ra ngoài đang cưỡng chế') &&
    render.includes('MÔ PHỎNG') &&
    render.includes('Chưa xác minh cơ khí') &&
    render.includes('không phải ppm') &&
    render.includes('Không phải thiết bị báo cháy thương mại'),
  'thiếu xác nhận/xung đột hoặc nhãn mô phỏng/an toàn'
);

const validation = read('web/src/domain/config-validation.ts');
expect(
  'Xác thực cấu hình nguyên tử',
  validation.includes('settings.light_off_pct < settings.light_on_pct + 5') &&
    validation.includes('calibration.bright_adc - calibration.dark_adc < 10') &&
    validation.includes('mq2.baseline_adc + mq2.span_adc > 1023') &&
    validation.includes('mq2.threshold_pct < 0') &&
    app.includes('if (!validation.valid)') &&
    app.includes('baseVersion'),
  'thiếu vùng trễ, hiệu chuẩn, miền MQ-2 hoặc base version'
);

const history = read('web/src/domain/history.ts');
expect(
  'Biểu đồ giữ khoảng trống',
  history.includes('time - previousTime > maximumGapMs') &&
    history.includes("point.coverageQuality !== 'invalid'") &&
    render.includes('historySegments(points)') &&
    render.includes('Khoảng trống ngoại tuyến'),
  'dữ liệu lịch sử có thể bị nối qua khoảng thiếu'
);

const notifications = read('web/src/notifications.ts');
expect(
  'Thông báo trình duyệt có chủ ý và chống lặp',
  app.includes("action === 'notification-permission'") &&
    notifications.includes('requestPermission()') &&
    notifications.includes('this.shown.has(alert.alertId)') &&
    notifications.includes('if (!alert.active'),
  'tự xin quyền, thiếu chống lặp hoặc thông báo nguyên nhân không active'
);

const css = read('web/src/styles.css');
expect(
  'Responsive và khả năng tiếp cận ở lớp CSS',
  ['560px', '720px', '900px', '1024px', '1200px'].every((width) => css.includes(`min-width: ${width}`)) &&
    css.includes('min-height: 44px') &&
    css.includes(':focus-visible') &&
    css.includes('prefers-reduced-motion') &&
    css.includes('.mobile-nav') &&
    css.includes('.sidebar'),
  'thiếu breakpoint, mục tiêu chạm, focus, reduced motion hoặc điều hướng thích ứng'
);
expect(
  'HTML tiếng Việt và viewport',
  read('web/index.html').includes('<html lang="vi">') &&
    read('web/index.html').includes('name="viewport"'),
  'thiếu ngôn ngữ hoặc viewport'
);

const testFiles = [];
function collectTests(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTests(absolute);
    else if (entry.name.endsWith('.test.ts')) testFiles.push(absolute);
  }
}
collectTests(path.join(root, 'web/src'));
const testSources = testFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const testCount = matches(testSources, /\bit\(['"`]([^'"`]+)['"`]/g).length +
  matches(testSources, /\btest\(['"`]([^'"`]+)['"`]/g).length;
expect(
  'Bộ kiểm thử web G16',
  testFiles.length === 7 && testCount === 30 &&
    testSources.includes('csrf_missing') &&
    testSources.includes('bỏ qua state_version cũ') &&
    testSources.includes('không nối qua mẫu rỗng') &&
    testSources.includes('chống gửi lặp'),
  `mong đợi 7 file/30 test có các điểm rủi ro; đọc được ${testFiles.length}/${testCount}`
);

const serverDomain = read('server/src/types/domain.ts');
const memoryRepository = read('server/src/data/memory-repository.ts');
const sqliteRepository = read('server/src/data/sqlite-repository.ts');
const serverService = read('server/src/services/smart-room-service.ts');
const cr04Test = read('server/test/cr04-alerts.test.ts');
expect(
  'CR-04 giữ cảnh báo chờ xác nhận',
  serverDomain.includes('alerts: AlertRecord[]') &&
    memoryRepository.includes('activeAlerts: alerts.filter') &&
    sqliteRepository.includes('activeAlerts: alerts.filter') &&
    serverService.includes('active_alerts: alerts.filter') &&
    cr04Test.includes("toContain('alert-awaiting-ack')") &&
    (cr04Test.includes('not.toContain') || cr04Test.includes('toHaveLength(0)')),
  'API/repository/SSE/test chưa cùng ngữ nghĩa alerts/activeAlerts'
);

const specification = read('docs/01-dac-ta-he-thong-v1.2.md');
const groupA = matches(
  sectionBetween(specification, '## 5. A —', '## 6. B —'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);
const stageDoc = read('docs/18-xay-dung-ung-dung-web-v1.0.md');
expect(
  'Truy vết 16 chức năng nhóm A',
  groupA.length === 16 && groupA.every((id) => stageDoc.includes(`| ${id} |`)),
  `mong đợi 16 mã A trong tài liệu; đọc được ${groupA.length}`
);
expect(
  'Giới hạn học thuật và điểm duyệt rõ ràng',
  (stageDoc.includes('**CHỜ DUYỆT**') || stageDoc.includes('**ĐÃ DUYỆT — 29/09/2026**')) &&
    stageDoc.includes('30/30 kiểm thử') &&
    stageDoc.includes('32 ca `KTxx` đang áp dụng vẫn là `CHƯA THỰC HIỆN`') &&
    stageDoc.includes('không phải ppm') &&
    stageDoc.includes('chưa tuyên bố WCAG'),
  'tài liệu thiếu trạng thái, kết quả phần mềm hoặc giới hạn học thuật'
);

const cr04 = read('docs/04-kiem-soat-thay-doi-CR-04.md');
expect(
  'CR-04 được quản lý cùng G16',
  cr04.includes('CR-04') &&
    (cr04.includes('CHỜ DUYỆT CÙNG GIAI ĐOẠN 16') || cr04.includes('ĐÃ DUYỆT CÙNG GIAI ĐOẠN 16')) &&
    cr04.includes('không đổi phạm vi, MQTT, firmware hoặc lược đồ DB'),
  'CR-04 thiếu trạng thái, phạm vi hoặc cổng đóng'
);

const readme = read('README.md');
const workflow = read('docs/00-quy-trinh-du-an.md');
expect(
  'README và quy trình trỏ đúng điểm G16',
  readme.includes('docs/18-xay-dung-ung-dung-web-v1.0.md') &&
    readme.includes('30/30') &&
    (workflow.includes('Giai đoạn 16') || workflow.includes('Giai đoạn 1–16')) &&
    workflow.includes('30/30'),
  'README/quy trình chưa liên kết đầu ra hoặc thiếu kết quả G16'
);

const productionSources = [app, api, realtime, merge, validation, history, notifications, render].join('\n');
expect(
  'Không còn mã giả hoặc MQTT client trong web',
  !/\bTODO\b|\bFIXME\b/i.test(productionSources) &&
    !/mqtt\.(connect|subscribe|publish)/i.test(productionSources),
  'còn TODO/FIXME hoặc web kết nối MQTT trực tiếp'
);

console.log(`\nTóm tắt G16: ${routes.length} tuyến; ${groupA.length}/16 chức năng A; ${testFiles.length} file/${testCount} kiểm thử web.`);
console.log(`Tổng: ${passes} đạt, ${failures.length} không đạt.`);
if (failures.length > 0) process.exit(1);
