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

const requiredFiles = [
  'config/integration-compatibility.json',
  'tests/integration/simulated-device.mjs',
  'tests/integration/stage17-software-chain.mjs',
  'tests/integration/hardware-evidence-tooling.ps1',
  'tests/integration/fixtures/stage17-redaction-input.fixture',
  'tests/integration/fixtures/stage17-redaction-expected.fixture',
  'server/test/command-timeout.test.ts',
  'server/test/mqtt-fuzz.test.ts',
  'server/test/reconnect-soak.test.ts',
  'web/test-resilience/command-timeout-render.test.ts',
  'tools/uno_protocol_host_test.cpp',
  'tools/esp32_protocol_host_test.cpp',
  'tools/check-stage17.mjs',
  'docs/19-tich-hop-he-thong-v1.0.md',
  'docs/19a-phieu-bang-chung-phan-cung.md',
  'infrastructure/firmware/Get-BoardPorts.ps1',
  'infrastructure/firmware/Test-HardwarePreparation.ps1',
  'infrastructure/firmware/Record-HardwareCheckpoint1.ps1',
  'infrastructure/firmware/Capture-SerialLog.ps1',
  'infrastructure/firmware/Upload-Firmware.ps1',
  'infrastructure/firmware/Redact-IntegrationLog.ps1',
  'infrastructure/firmware/README.md',
  'tests/integration/fixtures/ports-baseline.fixture.json',
  'tests/integration/fixtures/ports-uno.fixture.json',
  'tests/integration/fixtures/ports-esp32.fixture.json',
  'tests/integration/fixtures/ports-ambiguous.fixture.json'
];
expect(
  'Cây đầu ra tích hợp',
  requiredFiles.every((file) => fs.existsSync(path.join(root, file))),
  'thiếu manifest, simulator, runner, checker hoặc tài liệu G17'
);

let compatibility = {};
try {
  compatibility = JSON.parse(read('config/integration-compatibility.json'));
} catch (error) {
  fail('Manifest JSON', error instanceof Error ? error.message : 'không đọc được');
}
expect(
  'Phiên bản thành phần tương thích',
  compatibility.integration_version === 'stage17-1.0-draft' &&
    compatibility.device_id === 'room-01' &&
    compatibility.components?.uno_firmware === '1.0' &&
    compatibility.components?.esp32_firmware === '1.0' &&
    compatibility.components?.server === '1.0+CR-04' &&
    compatibility.components?.database === '1.0/migration-001' &&
    compatibility.components?.web === '1.0',
  'sai phiên bản UNO/ESP32/server/database/web hoặc device_id'
);
expect(
  'Phiên bản hợp đồng dây và MQTT',
  compatibility.contracts?.uno_esp32_protocol?.wire_version_hex === '0x10' &&
    compatibility.contracts?.uno_esp32_protocol?.uart === '19200 8N1' &&
    compatibility.contracts?.mqtt?.protocol === '3.1.1' &&
    compatibility.contracts?.mqtt?.schema === 'smartroom.mqtt' &&
    compatibility.contracts?.mqtt?.schema_version === 1 &&
    compatibility.contracts?.mqtt?.topic_root === 'smartroom/v1/devices',
  'manifest không khóa đúng UART/MQTT schema/topic'
);
expect(
  'Ranh giới bằng chứng phần cứng',
  compatibility.status === 'software_chain_verified_hardware_pending' &&
    Object.entries(compatibility.evidence ?? {})
      .filter(([name]) => name !== 'software_chain')
      .every(([, value]) => String(value).startsWith('pending_user_')),
  'manifest có thể suy diễn sai rằng phần cứng đã được xác minh'
);

const unoDomain = read('firmware/uno/include/domain.hpp');
const espDomain = read('firmware/esp32/include/domain.hpp');
const unoApp = read('firmware/uno/src/app.cpp');
const espLink = read('firmware/esp32/src/uno_link.cpp');
expect(
  'Firmware cùng giao thức UART 1.0',
  unoDomain.includes('kProtocolVersion = 0x10') &&
    espDomain.includes('kProtocolVersion = 0x10') &&
    unoApp.includes('linkSerial.begin(19200)') &&
    espLink.includes('SERIAL_8N1') &&
    espLink.includes('kUnoRxPin = 16') &&
    espLink.includes('kUnoTxPin = 17'),
  'UNO/ESP32 lệch wire version, baud, framing hoặc chân UART'
);

const espMqtt = read('firmware/esp32/src/mqtt_gateway.cpp');
const serverSchemas = read('server/src/validation/schemas.ts');
const serverEnv = read('server/src/config/env.ts');
expect(
  'ESP32 và server cùng MQTT schema/topic',
  espMqtt.includes('document["schema"] = "smartroom.mqtt"') &&
    espMqtt.includes('document["schema_version"] = 1') &&
    espMqtt.includes('"smartroom/v1/devices/%s"') &&
    serverSchemas.includes("z.literal('smartroom.mqtt')") &&
    serverSchemas.includes('schema_version: z.literal(1)') &&
    serverEnv.includes("mqttDeviceRoot: process.env.MQTT_DEVICE_ROOT ?? 'smartroom/v1/devices'"),
  'implementation ESP32/server lệch schema_version hoặc topic root'
);

const acl = read('infrastructure/mqtt/acl');
const inboundTopics = [
  'availability', 'telemetry/sensors', 'state/reported', 'config/reported', 'commands/result',
  'events', 'alerts/events', 'alerts/reported', 'sync/status', 'diagnostics'
];
const outboundTopics = ['config/desired', 'commands/request', 'sync/request'];
expect(
  'ACL phủ đúng hai chiều tích hợp',
  inboundTopics.every((suffix) => acl.includes(`topic write smartroom/v1/devices/room-01/${suffix}`)) &&
    outboundTopics.every((suffix) => acl.includes(`topic read smartroom/v1/devices/room-01/${suffix}`)) &&
    acl.includes('topic readwrite smartroom/v1/devices/#'),
  'ACL thiếu topic thiết bị hoặc backend'
);

const webClient = read('web/src/api/client.ts');
const webSse = read('web/src/realtime/sse-client.ts');
const webTypes = read('web/src/types.ts');
const routes = read('server/src/api/routes.ts');
expect(
  'Web và server cùng hợp đồng HTTP/SSE',
  ['/api/session', '/api/overview', '/api/config', '/api/commands', '/api/history', '/api/logs']
    .every((route) => webClient.includes(route) && routes.includes(route)) &&
    webSse.includes('/api/events/stream') && routes.includes('/api/events/stream') &&
    webClient.includes("headers.set('x-csrf-token'") &&
    webTypes.includes("| 'telemetry.updated'") &&
    webTypes.includes("| 'command.updated'") &&
    webTypes.includes("| 'alert.updated'"),
  'client/server lệch route, CSRF hoặc tên SSE'
);

const simulator = read('tests/integration/simulated-device.mjs');
const runner = read('tests/integration/stage17-software-chain.mjs');
expect(
  'Simulator gắn nhãn và đủ vòng lặp',
  simulator.includes('MÔ PHỎNG') &&
    ['config/desired', 'commands/request', 'sync/request', 'commands/result', 'config/reported', 'state/reported']
      .every((topic) => simulator.includes(topic)) &&
    simulator.includes('uno_ack: true'),
  'simulator thiếu nhãn hoặc luồng desired/command/result'
);
expect(
  'Runner tích hợp toàn chuỗi',
  runner.includes("mosquitto.exe") &&
    runner.includes('createApp') &&
    runner.includes('createServer') &&
    runner.includes('/api/events/stream') &&
    runner.includes("status === 'applied'") &&
    runner.includes('restartedApp.inject') &&
    runner.includes('hardware_evidence: false'),
  'runner thiếu broker/server/Vite/SSE/ACK/restart hoặc ranh giới bằng chứng'
);
expect(
  'Runner chịu lỗi và chống phát lại',
  runner.includes("details?.reason === 'invalid_schema'") &&
    runner.includes('staleState.state_version') &&
    runner.includes('duplicateEventId') &&
    runner.includes('await terminate(broker.child)') &&
    runner.includes('for (let cycle = 0; cycle < 3; cycle += 1)') &&
    runner.includes('replayedVersions.every') &&
    runner.includes('Cấu hình ngoại tuyến không được lưu vào outbox') &&
    runner.includes('3 chu kỳ broker thật giữ pending rồi applied'),
  'runner thiếu payload sai schema, state cũ, bản tin trùng hoặc 3 chu kỳ reconnect/outbox replay'
);

const commandTimeoutTest = read('server/test/command-timeout.test.ts');
const mqttFuzzTest = read('server/test/mqtt-fuzz.test.ts');
const reconnectSoakTest = read('server/test/reconnect-soak.test.ts');
const webTimeoutTest = read('web/test-resilience/command-timeout-render.test.ts');
expect(
  'Hồi quy chịu lỗi khóa các tình huống biên',
  commandTimeoutTest.includes("item.details.reason === 'device_result_timeout'") &&
    commandTimeoutTest.includes("expect(reconciled.status).toBe('applied')") &&
    mqttFuzzTest.includes('for (let index = 0; index < 1_000; index += 1)') &&
    mqttFuzzTest.includes('Math.min(original.length, 512)') &&
    reconnectSoakTest.includes('for (let cycle = 0; cycle < 25; cycle += 1)') &&
    reconnectSoakTest.includes('expect(observedVersions).toEqual') &&
    webTimeoutTest.includes('Không xác định — đang đồng bộ') &&
    webTimeoutTest.includes("not.toContain('Thiết bị đã xác nhận áp dụng lệnh')"),
  'thiếu timeout/kết quả muộn, fuzz 1.000 payload, soak 25 chu kỳ hoặc chốt UI không thành công giả'
);

const unoProtocolHost = read('tools/uno_protocol_host_test.cpp');
const espProtocolHost = read('tools/esp32_protocol_host_test.cpp');
expect(
  'Codec host từ chối khung UART bị cắt hoặc hỏng bit',
  [unoProtocolHost, espProtocolHost].every((source) =>
    source.includes('tu choi khung bi cat') &&
    source.includes('tu choi delimiter nam trong payload COBS') &&
    source.includes('tu choi khung hong mot bit')),
  'host test UNO/ESP32 thiếu vòng lặp khung cắt, delimiter sai hoặc hỏng một bit'
);

const portTool = read('infrastructure/firmware/Get-BoardPorts.ps1');
const preparationTool = read('infrastructure/firmware/Test-HardwarePreparation.ps1');
const checkpointTool = read('infrastructure/firmware/Record-HardwareCheckpoint1.ps1');
const serialTool = read('infrastructure/firmware/Capture-SerialLog.ps1');
const hardwareToolingTest = read('tests/integration/hardware-evidence-tooling.ps1');
const uploadTool = read('infrastructure/firmware/Upload-Firmware.ps1');
const redactTool = read('infrastructure/firmware/Redact-IntegrationLog.ps1');
const evidenceSheet = read('docs/19a-phieu-bang-chung-phan-cung.md');
expect(
  'Công cụ board có chốt an toàn',
  portTool.includes('[System.IO.Ports.SerialPort]::GetPortNames()') &&
    portTool.includes('[string]$SaveSnapshot') &&
    portTool.includes('[string]$CompareSnapshot') &&
    portTool.includes("schema = 'smartroom.board-port-snapshot'") &&
    portTool.includes('hardware_evidence = $false') &&
    portTool.includes("'Mới xuất hiện'") &&
    uploadTool.includes("SupportsShouldProcess = $true, ConfirmImpact = 'High'") &&
    uploadTool.includes("[ValidateSet('uno', 'esp32')]") &&
    uploadTool.includes('PLATFORMIO_CORE_DIR') &&
    ['SMARTROOM_ENABLE_MQ2', 'SMARTROOM_ENABLE_FLAME_SENSOR', 'SMARTROOM_ENABLE_BUZZER']
      .every((flag) => uploadTool.includes(flag)) &&
    uploadTool.includes("if (-not $Port) { throw") &&
    uploadTool.includes('secrets.hpp vẫn chứa giá trị mẫu'),
  'công cụ COM/build/upload thiếu snapshot/diff, ranh giới bằng chứng, xác nhận, kho cục bộ, cờ an toàn hoặc kiểm tra secret/cổng'
);
expect(
  'Biên bản Checkpoint 1 cần GPT duyệt',
  checkpointTool.includes("schema = 'smartroom.stage17-checkpoint1-user-report'") &&
    checkpointTool.includes("review_status = 'PENDING_GPT_REVIEW'") &&
    checkpointTool.includes("gate_decision = 'CHƯA ĐÁNH GIÁ'") &&
    checkpointTool.includes('hardware_evidence = $false') &&
    checkpointTool.includes('acceptance_updates_allowed = $false') &&
    checkpointTool.includes("'STOP_OUT_OF_RANGE'") &&
    checkpointTool.includes('reported_within_range') &&
    checkpointTool.includes('phải có đúng một cổng mới'),
  'công cụ nhập COM/số đo thiếu chốt dải, ánh xạ duy nhất hoặc có thể tự quyết định ĐẠT'
);
expect(
  'Thu serial có giới hạn và không khai khống boot',
  serialTool.includes("SupportsShouldProcess = $true, ConfirmImpact = 'Medium'") &&
    serialTool.includes("[ValidateSet(115200)]") &&
    serialTool.includes('[ValidateRange(5, 600)]') &&
    serialTool.includes('$serial.DtrEnable = $false') &&
    serialTool.includes('$serial.RtsEnable = $false') &&
    serialTool.includes('RAW_UNREVIEWED') &&
    serialTool.includes('capture alone is not hardware PASS evidence') &&
    serialTool.includes('Redact-IntegrationLog.ps1'),
  'công cụ serial thiếu WhatIf/timeout, bảo vệ reset, nhãn log thô hoặc nhắc che log'
);
expect(
  'Hồi quy công cụ bằng chứng không cần board',
  hardwareToolingTest.includes("$nominal.result -eq 'REPORTED_VALUES_WITHIN_RANGE'") &&
    hardwareToolingTest.includes('$outOfRangeExit -eq 2') &&
    hardwareToolingTest.includes("'ports-ambiguous.fixture.json'") &&
    hardwareToolingTest.includes('-Port COM999') &&
    hardwareToolingTest.includes('-WhatIf') &&
    hardwareToolingTest.includes("'stage17-redaction-expected.fixture'") &&
    hardwareToolingTest.includes('[System.IO.File]::ReadAllText($redactionInput) -ceq $originalBefore') &&
    hardwareToolingTest.includes("$nominal.hardware_evidence -eq $false") &&
    hardwareToolingTest.includes("$nominal.acceptance_updates_allowed -eq $false"),
  'thiếu hồi quy dải nguồn, COM mơ hồ, dry-run serial, che log hoặc ranh giới bằng chứng'
);
expect(
  'Tiền kiểm phần cứng không khai khống thao tác vật lý',
  preparationTool.includes("schema = 'smartroom.stage17-hardware-preparation'") &&
    preparationTool.includes("scope = 'TIỀN KIỂM MÁY PHÁT TRIỂN — CHƯA THAO TÁC PHẦN CỨNG'") &&
    preparationTool.includes('hardware_evidence = $false') &&
    preparationTool.includes('physical_measurements = $false') &&
    preparationTool.includes('upload_performed = $false') &&
    preparationTool.includes('acceptance_updates_allowed = $false') &&
    preparationTool.includes("board_mapping = 'waiting_human_unplug_replug'") &&
    preparationTool.includes("status = 'CHƯA THỰC HIỆN'"),
  'tiền kiểm thiếu ranh giới bằng chứng, trạng thái con người hoặc có thể bị hiểu là đã nạp/đo board'
);
expect(
  'Công cụ che log có mẫu hồi quy',
  redactTool.includes('PRIVATE_KEY_REDACTED') &&
    redactTool.includes('USERINFO_REDACTED') &&
    redactTool.includes('MAC_REDACTED') &&
    redactTool.includes('IP_REDACTED') &&
    redactTool.includes("smartroom_session=") &&
    read('tests/integration/fixtures/stage17-redaction-expected.fixture').includes('Authorization: [REDACTED]'),
  'công cụ che log thiếu lớp che bắt buộc hoặc fixture kỳ vọng'
);
expect(
  'Phiếu phần cứng không khai khống',
  evidenceSheet.includes('CHƯA THỰC HIỆN') &&
    evidenceSheet.includes('G17-HW-PWR-01A') &&
    evidenceSheet.includes('G17-HW-LVL-02H') &&
    evidenceSheet.includes('command_id') &&
    evidenceSheet.includes('Không có cổng nào được tự ghi `ĐẠT`'),
  'phiếu thiếu phép đo, truy vết lệnh hoặc ranh giới bằng chứng'
);

const rootPackage = JSON.parse(read('package.json') || '{}');
const serverPackage = JSON.parse(read('server/package.json') || '{}');
const webPackage = JSON.parse(read('web/package.json') || '{}');
expect(
  'Lệnh tái tạo G17',
  rootPackage.scripts?.['check:stage17'] === 'node tools/check-stage17.mjs' &&
    rootPackage.scripts?.['check:hardware-preparation'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File infrastructure/firmware/Test-HardwarePreparation.ps1' &&
    rootPackage.scripts?.['test:hardware-tooling'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File tests/integration/hardware-evidence-tooling.ps1' &&
    rootPackage.scripts?.['integration:stage17'] === 'pnpm build && node tests/integration/stage17-software-chain.mjs' &&
    rootPackage.scripts?.['test:resilience'] === 'pnpm -r --if-present run test:resilience' &&
    serverPackage.scripts?.['test:resilience']?.includes('command-timeout.test.ts') &&
    serverPackage.scripts?.['test:resilience']?.includes('mqtt-fuzz.test.ts') &&
    serverPackage.scripts?.['test:resilience']?.includes('reconnect-soak.test.ts') &&
    webPackage.scripts?.['test:resilience']?.includes('command-timeout-render.test.ts'),
  'package.json thiếu checker, runner hoặc bộ hồi quy chịu lỗi G17'
);

const stage16 = read('docs/18-xay-dung-ung-dung-web-v1.0.md');
const cr04 = read('docs/04-kiem-soat-thay-doi-CR-04.md');
expect(
  'Đầu vào G16 và CR-04 đã khóa',
  stage16.includes('**ĐÃ DUYỆT — 29/09/2026**') &&
    cr04.includes('**ĐÃ DUYỆT CÙNG GIAI ĐOẠN 16 — 29/09/2026**'),
  'chưa khóa G16/CR-04 trước khi tích hợp'
);

const document = read('docs/19-tich-hop-he-thong-v1.0.md');
expect(
  'Tài liệu tách phần mềm và phần cứng',
  document.includes('**ĐANG THỰC HIỆN**') &&
    document.includes('MÔ PHỎNG') &&
    document.includes('G17-SW-') &&
    document.includes('G17-HW-') &&
    document.includes('CHƯA THỰC HIỆN') &&
    document.includes('32 ca `KTxx`') &&
    document.includes('không phải bằng chứng phần cứng') &&
    document.includes('15/15') &&
    document.includes('6/6') &&
    document.includes('1.000 payload MQTT') &&
    document.includes('25 chu kỳ offline/online') &&
    document.includes('uno_boot_id') &&
    document.includes('19a-phieu-bang-chung-phan-cung.md'),
  'tài liệu thiếu trạng thái, cổng, giới hạn hoặc ranh giới học thuật'
);

const readme = read('README.md');
const workflow = read('docs/00-quy-trinh-du-an.md');
expect(
  'README và quy trình trỏ đúng G17',
  readme.includes('docs/19-tich-hop-he-thong-v1.0.md') &&
    readme.includes('Giai đoạn 17') &&
    workflow.includes('Giai đoạn 17') &&
    workflow.includes('phần cứng'),
  'trạng thái dự án chưa trỏ đúng đầu ra/điểm dừng G17'
);

console.log(`\nTóm tắt G17 tĩnh: ${passes} đạt, ${failures.length} không đạt.`);
if (failures.length > 0) process.exit(1);
