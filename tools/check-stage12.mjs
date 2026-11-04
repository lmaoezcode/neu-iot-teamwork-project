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
  'firmware/esp32/platformio.ini',
  'firmware/esp32/include/app.hpp',
  'firmware/esp32/include/domain.hpp',
  'firmware/esp32/include/protocol.hpp',
  'firmware/esp32/include/uno_link.hpp',
  'firmware/esp32/include/config_store.hpp',
  'firmware/esp32/include/offline_queue.hpp',
  'firmware/esp32/include/mqtt_gateway.hpp',
  'firmware/esp32/include/runtime_config.hpp',
  'firmware/esp32/include/secrets.example.hpp',
  'firmware/esp32/src/main.cpp',
  'firmware/esp32/src/app.cpp',
  'firmware/esp32/src/protocol.cpp',
  'firmware/esp32/src/uno_link.cpp',
  'firmware/esp32/src/config_store.cpp',
  'firmware/esp32/src/offline_queue.cpp',
  'firmware/esp32/src/mqtt_gateway.cpp',
  'firmware/esp32/test/README.md',
  'tools/esp32_protocol_host_test.cpp',
  'docs/14-lap-trinh-esp32-v1.0.md'
];
for (const path of requiredFiles) read(path);

const specification = read('docs/01-dac-ta-he-thong-v1.2.md');
const uartDesign = read('docs/08-giao-thuc-uno-esp32-v1.0.md');
const mqttDesign = read('docs/09-thiet-ke-mqtt-v1.0.md');
const stage11 = read('docs/13-lap-trinh-arduino-uno-v1.0.md');
const stage12 = read('docs/14-lap-trinh-esp32-v1.0.md');
const readme = read('README.md');
const gitignore = read('.gitignore');
const platformio = read('firmware/esp32/platformio.ini');
const linkSource = read('firmware/esp32/src/uno_link.cpp');
const queueSource = read('firmware/esp32/src/offline_queue.cpp');
const mqttSource = read('firmware/esp32/src/mqtt_gateway.cpp');
const configSource = read('firmware/esp32/src/config_store.cpp');
const configHeader = read('firmware/esp32/include/config_store.hpp');
const allSource = requiredFiles
  .filter((path) => path.startsWith('firmware/esp32/include/') || path.startsWith('firmware/esp32/src/'))
  .map(read)
  .join('\n');

const groupA = matches(sectionBetween(specification, '## 5. A —', '## 6. B —'), /^\| ([A-Z]{2}-\d{2}) \|/gm);
for (const id of groupA) {
  if (!stage12.includes(id)) failures.push(`Thiếu truy vết chức năng nhóm A trong Giai đoạn 12: ${id}`);
}

const gateIds = matches(stage12, /^\| (G12-[A-Z0-9-]+) \|/gm);
if (gateIds.length !== 15) failures.push(`Số cổng Giai đoạn 12 không khớp: ${gateIds.length}`);
if (new Set(gateIds).size !== gateIds.length) failures.push('Mã cổng Giai đoạn 12 bị lặp.');

if (/\bdelay\s*\(/.test(allSource)) failures.push('Firmware ESP32 còn dùng delay() chặn vòng lặp.');
if (/\bTODO\b|\bFIXME\b|Giai đoạn 10:/.test(allSource)) failures.push('Firmware ESP32 còn placeholder/TODO.');
if (/\bppm\b/i.test(allSource)) failures.push('Firmware ESP32 xuất hiện tuyên bố/field ppm.');
if (/\bservo\b|\bmotor\b|\brelay\b/i.test(allSource)) failures.push('Firmware ESP32 không được hồi sinh servo/motor/relay.');

for (const token of [
  'HELLO_REQUEST', 'SESSION_START', 'SNAPSHOT_REQUEST', 'SYNC_COMPLETE',
  'CONFIG_SET', 'CONTROL_SET', 'kResponseTimeoutMs = 150', 'kMaximumAttempts = 3',
  'frame.ackSequence != pending_.sequence', 'abandonedKind', 'observer_->onEventReport', 'observer_->onAlertReport'
]) {
  if (!linkSource.includes(token)) failures.push(`Thiếu thành phần UART chủ: ${token}`);
}

for (const token of ['LittleFS.begin(true)', 'kCapacity = 128', 'droppedOldest', 'commitHeader', 'recordChecksum']) {
  if (!(queueSource + read('firmware/esp32/include/offline_queue.hpp')).includes(token)) failures.push(`Thiếu thành phần queue bền vững: ${token}`);
}

for (const token of ['Preferences', 'checksum', 'putBytes', 'getBytes', 'validateConfig']) {
  if (!(configHeader + configSource).includes(token)) failures.push(`Thiếu thành phần NVS: ${token}`);
}

const topicSuffixes = [
  '/availability', '/telemetry/sensors', '/state/reported', '/config/desired', '/config/reported',
  '/commands/request', '/commands/result', '/events', '/alerts/events', '/alerts/reported',
  '/sync/request', '/sync/status', '/diagnostics'
];
for (const suffix of topicSuffixes) {
  if (!mqttSource.includes(`"%s${suffix}"`)) failures.push(`Thiếu topic MQTT trong firmware: ${suffix}`);
  if (!mqttDesign.includes(suffix.slice(1))) failures.push(`Topic không có trong thiết kế MQTT: ${suffix}`);
}

for (const token of [
  'setWill(topicAvailability_, willPayload, true, 1)',
  'subscribe(topicConfigDesired_, 1)',
  'subscribe(topicCommandRequest_, 1)',
  'subscribe(topicSyncRequest_, 1)',
  'mqtt_.publish(topic, payload, retained, qos)',
  'networkPhase_ == NetworkPhase::Online',
  'store_.save(inFlightConfig_)',
  'publishCommandResult'
]) {
  if (!mqttSource.includes(token)) failures.push(`Thiếu quy tắc MQTT/ACK: ${token}`);
}
for (const token of [
  'jsonUint16', 'jsonUint8', 'jsonBoolean', 'validInboundEnvelope',
  'parseIsoUtc(data["issued_at"]', 'parseIsoUtc(data["expires_at"]', 'serviceUnoIdentity'
]) {
  if (!mqttSource.includes(token)) failures.push(`Thiếu kiểm tra lược đồ bản tin vào: ${token}`);
}
for (const token of ['"unknown"', '"uart_timeout"']) {
  if (!mqttSource.includes(token)) failures.push(`Thiếu trạng thái kết quả khi UART hết thời gian: ${token}`);
}

const callbackSection = sectionBetween(mqttSource, 'void MqttGateway::onMqttMessage', 'bool MqttGateway::enqueueInbound');
if (!callbackSection.includes('enqueueInbound') || /publish|deserializeJson|requestControl|requestConfig/.test(callbackSection)) {
  failures.push('Callback MQTT phải chỉ phân loại/sao chép bản tin vào hàng đợi RAM.');
}

if (!/espressif32@6\.13\.0/.test(platformio) || !/256dpi\/MQTT@2\.5\.2/.test(platformio) ||
    !/bblanchon\/ArduinoJson@7\.4\.2/.test(platformio)) failures.push('Phiên bản platform/thư viện ESP32 chưa khóa đúng.');
if (!/-Wall[\s\S]*-Wextra[\s\S]*-Werror/.test(platformio)) failures.push('Build project source chưa bật cảnh báo nghiêm ngặt.');
if (!gitignore.includes('firmware/esp32/include/secrets.hpp')) failures.push('secrets.hpp chưa được ignore.');
if (existsSync(join(projectRoot, 'firmware/esp32/include/secrets.hpp'))) failures.push('Phát hiện secrets.hpp trong workspace; không được đưa bí mật vào bộ bàn giao.');

if (!/ĐÃ DUYỆT — 26\/09\/2026/.test(stage11)) failures.push('Firmware UNO 1.0 chưa được ghi nhận đã duyệt.');
if (!/Trạng thái \| \*\*ĐÃ DUYỆT — 26\/09\/2026\*\*/.test(stage12)) failures.push('Tài liệu Giai đoạn 12 chưa được khóa sau phê duyệt.');
if (!/Giai đoạn 13/.test(readme) || !/14-lap-trinh-esp32-v1\.0\.md/.test(readme)) failures.push('README chưa phản ánh Firmware ESP32 đã duyệt và mốc Giai đoạn 13.');
if (!uartDesign.includes('CRC-16/CCITT-FALSE') || !mqttDesign.includes('MQTT 3.1.1')) failures.push('Đường cơ sở UART/MQTT không đọc được.');

const result = {
  requiredFiles: requiredFiles.length,
  groupAFunctionsTraced: groupA.length,
  mqttTopics: topicSuffixes.length,
  stage12Gates: gateIds.length,
  persistentQueueCapacity: 128,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
