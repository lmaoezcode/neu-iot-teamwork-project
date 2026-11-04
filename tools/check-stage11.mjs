import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(relativePath) {
  const absolutePath = join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Thiếu file bắt buộc: ${relativePath}`);
    return '';
  }
  return readFileSync(absolutePath, 'utf8');
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
  'firmware/uno/platformio.ini',
  'firmware/uno/include/app.hpp',
  'firmware/uno/include/domain.hpp',
  'firmware/uno/include/protocol.hpp',
  'firmware/uno/include/sensors.hpp',
  'firmware/uno/src/main.cpp',
  'firmware/uno/src/app.cpp',
  'firmware/uno/src/protocol.cpp',
  'firmware/uno/src/sensors.cpp',
  'firmware/uno/test/README.md',
  'tools/uno_protocol_host_test.cpp',
  'tools/uno_app_host_test.cpp',
  'tools/host-stubs/Arduino.h',
  'tools/host-stubs/SoftwareSerial.h',
  'tools/host-stubs/avr/wdt.h',
  'docs/13-lap-trinh-arduino-uno-v1.0.md'
];

for (const path of requiredFiles) read(path);

const specification = read('docs/01-dac-ta-he-thong-v1.2.md');
const stage10 = read('docs/12-cau-truc-du-an-v1.0.md');
const stage11 = read('docs/13-lap-trinh-arduino-uno-v1.0.md');
const readme = read('README.md');
const platformio = read('firmware/uno/platformio.ini');
const appSource = read('firmware/uno/src/app.cpp');
const source = [
  read('firmware/uno/include/domain.hpp'),
  read('firmware/uno/include/protocol.hpp'),
  read('firmware/uno/include/sensors.hpp'),
  appSource,
  read('firmware/uno/src/protocol.cpp'),
  read('firmware/uno/src/sensors.cpp')
].join('\n');

const groupA = matches(
  sectionBetween(specification, '## 5. A —', '## 6. B —'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);
for (const id of groupA) {
  if (!stage11.includes(id)) failures.push(`Thiếu truy vết chức năng nhóm A trong Giai đoạn 11: ${id}`);
}

const gateIds = matches(stage11, /^\| (G11-[A-Z0-9-]+) \|/gm);
if (gateIds.length !== 11) failures.push(`Số cổng Giai đoạn 11 không khớp: ${gateIds.length}`);
if (new Set(gateIds).size !== gateIds.length) failures.push('Mã cổng Giai đoạn 11 bị lặp.');

if (/\bdelay\s*\(/.test(source)) failures.push('Firmware UNO còn dùng delay() chặn vòng lặp.');
if (/#if\s+0/.test(source)) failures.push('Firmware UNO còn khối mã nháp #if 0.');
if (/ArduinoJson|PubSubClient|WiFi\.h|HTTPClient|\bMQTT\b|\bString\s*[<(]/.test(source)) {
  failures.push('Firmware UNO vi phạm ranh giới: có mạng/JSON động/String.');
}
if (/\bservo\b|\bmotor\b|\brelay\b/i.test(source)) failures.push('Firmware UNO không được hồi sinh servo/motor/relay.');

for (const flag of ['SMARTROOM_ENABLE_MQ2', 'SMARTROOM_ENABLE_FLAME_SENSOR', 'SMARTROOM_ENABLE_BUZZER']) {
  if (!new RegExp(`-D\\s+${flag}=0`).test(platformio)) failures.push(`Cờ ${flag} không mặc định bằng 0.`);
}
if (!/-std=gnu\+\+17/.test(platformio)) failures.push('PlatformIO chưa khóa C++17.');
if (!/monitor_speed\s*=\s*115200/.test(platformio)) failures.push('Serial monitor USB chưa khớp 115200.');

for (const token of [
  'crc16CcittFalse', 'cobsEncode', 'cobsDecode', 'decodeFrame',
  'SoftwareSerial', 'SESSION_START', 'SYNC_COMPLETE', 'CONTROL_SET',
  'kAutomationHoldMs', 'doorConfirmSamples', 'SMARTROOM_ENABLE_MQ2'
]) {
  if (!source.includes(token)) failures.push(`Thiếu thành phần bắt buộc trong mã UNO: ${token}`);
}

const handlerStart = appSource.indexOf('void handleFrame(const Frame& frame)');
const sessionValidation = appSource.indexOf('if (frame.sessionId != linkSessionId)', handlerStart);
const sequenceValidation = appSource.indexOf('if (!duplicateFrame)', handlerStart);
const cumulativeAck = appSource.indexOf('acknowledgePending(frame.ackSequence)', handlerStart);
if (handlerStart < 0 || sessionValidation < 0 || sequenceValidation < 0 || cumulativeAck < sequenceValidation || cumulativeAck < sessionValidation) {
  failures.push('UNO chỉ được xử lý ACK cộng dồn sau khi khung qua kiểm tra phiên và sequence.');
}

if (!/0x29B1U/.test(read('tools/uno_protocol_host_test.cpp')) || !/0xD2/.test(read('tools/uno_protocol_host_test.cpp'))) {
  failures.push('Kiểm thử host thiếu vector CRC/khung bắt buộc.');
}
if (!/ĐÃ DUYỆT — 26\/09\/2026/.test(stage10)) failures.push('Tài liệu Giai đoạn 10 chưa được ghi nhận đã duyệt.');
if (!/13-lap-trinh-arduino-uno-v1\.0\.md/.test(readme) || !/Firmware UNO 1\.0[^\n]*đã được duyệt/.test(readme)) {
  failures.push('README chưa liên kết hoặc chưa ghi nhận Firmware UNO 1.0 đã duyệt.');
}

const result = {
  requiredFiles: requiredFiles.length,
  groupAFunctionsTraced: groupA.length,
  stage11Gates: gateIds.length,
  blockingCalls: matches(source, /\b(delay)\s*\(/g).length,
  safeDefaults: 3,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
