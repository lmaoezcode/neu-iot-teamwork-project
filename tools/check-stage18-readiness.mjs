import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
let passes = 0;

function read(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Thiếu file: ${relative}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function expect(label, condition, detail) {
  if (condition) {
    passes += 1;
    console.log(`[ĐẠT] ${label}`);
  } else {
    failures.push(`${label}: ${detail}`);
    console.error(`[KHÔNG ĐẠT] ${label}: ${detail}`);
  }
}

const matrixText = read('docs/02-ma-tran-kiem-thu-v1.2.md');
const readinessText = read('config/stage18-test-readiness.json');
const preparationDocument = read('docs/20-chuan-bi-kiem-thu-phan-mem-v1.0.md');
const preflightRunner = read('tests/acceptance/stage18-software-preflight.mjs');
const rootPackage = JSON.parse(read('package.json') || '{}');
const serverPackage = JSON.parse(read('server/package.json') || '{}');
const webPackage = JSON.parse(read('web/package.json') || '{}');
const activeIds = [...matrixText.matchAll(/^### (KT\d{2}) —/gm)].map((match) => match[1]);
const matrixPending = [...matrixText.matchAll(/\*\*Kết quả thực tế:\*\* `CHƯA THỰC HIỆN`\./g)].length;

let manifest = {};
try {
  manifest = JSON.parse(readinessText);
} catch (error) {
  failures.push(`Manifest JSON không hợp lệ: ${error instanceof Error ? error.message : 'không đọc được'}`);
}

const tests = Array.isArray(manifest.tests) ? manifest.tests : [];
const manifestIds = tests.map((item) => item.id);
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
expect(
  'Đúng 32 ca đang áp dụng',
  activeIds.length === 32 &&
    new Set(activeIds).size === 32 &&
    JSON.stringify(sorted(activeIds)) === JSON.stringify(sorted(manifestIds)),
  'manifest phải khớp chính xác 32 tiêu đề KTxx của Ma trận 1.2'
);
expect(
  'Không dùng lại mã đã ngừng',
  ['KT01', 'KT05', 'KT22', 'KT23', 'KT32', 'KT33', 'KT37'].every((id) => !manifestIds.includes(id)),
  'manifest chứa mã lịch sử đã ngừng áp dụng'
);
expect(
  'Ranh giới chuẩn bị sớm',
  manifest.schema === 'smartroom.stage18-readiness' &&
    manifest.schema_version === 1 &&
    manifest.scope === 'CHUAN_BI_SOM_KHI_G17_DANG_MO' &&
    manifest.current_stage === 17 &&
    manifest.target_stage === 18 &&
    manifest.acceptance_updates_allowed === false,
  'manifest có thể bị hiểu là đã mở hoặc đã hoàn thành G18'
);

const allowedReadiness = new Set(['software_automated', 'software_manual', 'hybrid', 'hardware_primary', 'conditional']);
expect(
  'Mọi ca có phân loại và việc còn thiếu',
  tests.length === 32 && tests.every((item) =>
    allowedReadiness.has(item.readiness) &&
    Array.isArray(item.automated_coverage) &&
    typeof item.remaining_evidence === 'string' && item.remaining_evidence.length >= 20 &&
    typeof item.needs_user_or_hardware === 'boolean'),
  'thiếu phân loại, danh sách bao phủ hoặc mô tả bằng chứng còn thiếu'
);
expect(
  'Không ghi kết quả chấp nhận sớm',
  matrixPending === 32 && tests.every((item) => item.acceptance_result === 'CHƯA THỰC HIỆN'),
  'một ca đã bị đổi khỏi CHƯA THỰC HIỆN khi G17 còn mở'
);

const missingCoverageFiles = [];
for (const item of tests) {
  for (const relative of item.automated_coverage) {
    if (!fs.existsSync(path.join(root, relative))) missingCoverageFiles.push(`${item.id}:${relative}`);
  }
}
expect(
  'Mọi tham chiếu kiểm thử tồn tại',
  missingCoverageFiles.length === 0,
  missingCoverageFiles.join(', ') || 'có đường dẫn không tồn tại'
);

const commandTimeoutTest = read('server/test/command-timeout.test.ts');
const mqttFuzzTest = read('server/test/mqtt-fuzz.test.ts');
const reconnectSoakTest = read('server/test/reconnect-soak.test.ts');
const webTimeoutTest = read('web/test-resilience/command-timeout-render.test.ts');
expect(
  'Bộ hồi quy chịu lỗi có thể tái tạo',
  rootPackage.scripts?.['test:resilience'] === 'pnpm -r --if-present run test:resilience' &&
    serverPackage.scripts?.['test:resilience']?.includes('command-timeout.test.ts') &&
    serverPackage.scripts?.['test:resilience']?.includes('mqtt-fuzz.test.ts') &&
    serverPackage.scripts?.['test:resilience']?.includes('reconnect-soak.test.ts') &&
    webPackage.scripts?.['test:resilience']?.includes('command-timeout-render.test.ts') &&
    commandTimeoutTest.includes("expect(timedOut.status).toBe('unknown')") &&
    commandTimeoutTest.includes("expect(reconciled.status).toBe('applied')") &&
    mqttFuzzTest.includes('for (let index = 0; index < 1_000; index += 1)') &&
    mqttFuzzTest.includes('Math.min(original.length, 512)') &&
    reconnectSoakTest.includes('for (let cycle = 0; cycle < 25; cycle += 1)') &&
    webTimeoutTest.includes('Không xác định — đang đồng bộ') &&
    webTimeoutTest.includes("not.toContain('Thiết bị đã xác nhận áp dụng lệnh')"),
  'thiếu script hoặc chốt timeout/fuzz/soak/UI của bộ test:resilience'
);

const kt16 = tests.find((item) => item.id === 'KT16');
const kt18 = tests.find((item) => item.id === 'KT18');
expect(
  'Bản đồ gắn hardening vào đúng ca hybrid',
  kt16?.automated_coverage.includes('server/test/reconnect-soak.test.ts') &&
    kt18?.automated_coverage.includes('server/test/command-timeout.test.ts') &&
    kt18?.automated_coverage.includes('web/test-resilience/command-timeout-render.test.ts'),
  'KT16 thiếu reconnect soak hoặc KT18 thiếu timeout server/web'
);

const unoProtocolHost = read('tools/uno_protocol_host_test.cpp');
const espProtocolHost = read('tools/esp32_protocol_host_test.cpp');
expect(
  'Host test UART phủ khung cắt và hỏng bit',
  [unoProtocolHost, espProtocolHost].every((source) =>
    source.includes('tu choi khung bi cat') && source.includes('tu choi khung hong mot bit')),
  'host test UNO/ESP32 chưa phủ đủ hai lớp hỏng khung'
);

const counts = Object.fromEntries([...allowedReadiness].map((kind) => [kind, tests.filter((item) => item.readiness === kind).length]));
expect(
  'Phân nhóm 32 ca nhất quán',
  counts.software_automated === 3 &&
    counts.software_manual === 1 &&
    counts.hybrid === 18 &&
    counts.hardware_primary === 9 &&
    counts.conditional === 1,
  `sai số lượng phân nhóm: ${JSON.stringify(counts)}`
);
expect(
  'Ba ca thuần phần mềm không đòi board',
  ['KT19', 'KT20', 'KT21'].every((id) => {
    const item = tests.find((candidate) => candidate.id === id);
    return item?.readiness === 'software_automated' && item.needs_user_or_hardware === false;
  }),
  'KT19/KT20/KT21 phải tách khỏi ca cần thao tác vật lý'
);
expect(
  'Ca trình duyệt và ca điều kiện không bị tự động hóa quá mức',
  tests.find((item) => item.id === 'KT34')?.readiness === 'software_manual' &&
    tests.find((item) => item.id === 'KT35')?.readiness === 'conditional',
  'KT34 cần trình duyệt thật; KT35 chỉ chạy khi mở nhóm C'
);
expect(
  'Tài liệu giữ nguyên cổng G17',
  preparationDocument.includes('CHUẨN BỊ SỚM') &&
    preparationDocument.includes('G17 CHƯA ĐÓNG') &&
    preparationDocument.includes('không cập nhật') &&
    preparationDocument.includes('32 ca') &&
    preparationDocument.includes('KT19') &&
    preparationDocument.includes('KT35'),
  'tài liệu thiếu nhãn chuẩn bị, phân nhóm hoặc ranh giới kết quả'
);
expect(
  'Runner tiền kiểm không sửa trạng thái chấp nhận',
  preflightRunner.includes("scope: 'TIỀN KIỂM PHẦN MỀM/MÔ PHỎNG — G17 CHƯA ĐÓNG'") &&
    preflightRunner.includes('acceptance_updates_allowed: false') &&
    preflightRunner.includes('hardware_evidence: false') &&
    preflightRunner.includes("acceptance_result: 'CHƯA THỰC HIỆN'") &&
    ['KT19', 'KT20', 'KT21'].every((id) => preflightRunner.includes(`'${id}'`)),
  'runner thiếu nhãn tiền kiểm, ranh giới phần cứng hoặc giữ nguyên kết quả KT'
);
expect(
  'Lệnh chuẩn bị G18 tái tạo được',
  rootPackage.scripts?.['check:stage18-readiness'] === 'node tools/check-stage18-readiness.mjs' &&
    rootPackage.scripts?.['preflight:stage18'] === 'node tests/acceptance/stage18-software-preflight.mjs' &&
    preparationDocument.includes('15/15') &&
    preparationDocument.includes('13/13') &&
    preparationDocument.includes('PREFLIGHT_PASS') &&
    preparationDocument.includes('28 kiểm thử server') &&
    preparationDocument.includes('31 kiểm thử web') &&
    preparationDocument.includes('6/6') &&
    preparationDocument.includes('1.000 payload MQTT') &&
    preparationDocument.includes('25 chu kỳ reconnect') &&
    preparationDocument.includes('3 chu kỳ broker Mosquitto thật'),
  'package hoặc tài liệu thiếu lệnh/kết quả tiền kiểm có nhãn'
);

console.log(`\nTóm tắt sẵn sàng G18: ${passes} đạt, ${failures.length} không đạt; phân nhóm ${JSON.stringify(counts)}.`);
if (failures.length > 0) process.exit(1);
