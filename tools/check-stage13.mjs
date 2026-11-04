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

function read(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    fail('File bắt buộc', `thiếu ${relative}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function expect(label, condition, detail) {
  condition ? pass(label) : fail(label, detail);
}

const requiredFiles = [
  'infrastructure/mqtt/mosquitto.conf.template',
  'infrastructure/mqtt/acl',
  'infrastructure/mqtt/client.example.conf',
  'infrastructure/mqtt/README.md',
  'infrastructure/mqtt/scripts/Common-Mqtt.ps1',
  'infrastructure/mqtt/scripts/Initialize-Mqtt.ps1',
  'infrastructure/mqtt/scripts/Start-Mqtt.ps1',
  'infrastructure/mqtt/scripts/Test-Mqtt.ps1',
  'docs/15-xay-dung-mqtt-v1.0.md',
];
expect(
  'Cây triển khai MQTT',
  requiredFiles.every((file) => fs.existsSync(path.join(root, file))),
  'thiếu một hoặc nhiều file Giai đoạn 13',
);

const template = read('infrastructure/mqtt/mosquitto.conf.template');
const templateRequired = [
  'global_plugin {{PASSWORD_PLUGIN}}',
  'plugin_opt_password_file {{PASSWORD_FILE}}',
  'global_plugin {{ACL_PLUGIN}}',
  'plugin_opt_acl_file {{ACL_FILE}}',
  'listener {{PORT}} {{BIND_ADDRESS}}',
  'protocol mqtt',
  'listener_allow_anonymous false',
  'message_size_limit 2048',
  'max_packet_size 4096',
  'max_qos 1',
  'persistence true',
];
expect(
  'Cấu hình bảo mật và giới hạn broker',
  templateRequired.every((item) => template.includes(item)) && !template.includes('allow_anonymous true'),
  'template thiếu plugin/listener/giới hạn hoặc cho phép ẩn danh',
);

const acl = read('infrastructure/mqtt/acl');
const expectedDeviceRead = [
  'config/desired',
  'commands/request',
  'sync/request',
];
const expectedDeviceWrite = [
  'availability',
  'telemetry/sensors',
  'state/reported',
  'config/reported',
  'commands/result',
  'events',
  'alerts/events',
  'alerts/reported',
  'sync/status',
  'diagnostics',
];
const devicePrefix = 'smartroom/v1/devices/room-01/';
expect(
  'ACL đọc của thiết bị',
  expectedDeviceRead.every((suffix) => acl.includes(`topic read ${devicePrefix}${suffix}`)),
  'thiếu topic hướng xuống',
);
expect(
  'ACL ghi của thiết bị',
  expectedDeviceWrite.every((suffix) => acl.includes(`topic write ${devicePrefix}${suffix}`)),
  'thiếu topic báo cáo',
);
expect(
  'ACL máy chủ và cách ly thiết bị',
  acl.includes('user room-01-device') &&
    acl.includes('user smartroom-backend') &&
    acl.includes('topic readwrite smartroom/v1/devices/#') &&
    !acl.includes(`topic write ${devicePrefix}config/desired`) &&
    !acl.includes('topic readwrite #'),
  'quyền rộng hoặc sai hướng',
);

const design = read('docs/09-thiet-ke-mqtt-v1.0.md');
const allTopics = [...expectedDeviceRead, ...expectedDeviceWrite];
expect(
  'ACL truy vết Thiết kế MQTT 1.0',
  allTopics.every((topic) => design.includes(`\`${topic}\``) || design.includes(`/${topic}\``)),
  'topic ACL không có trong thiết kế đã khóa',
);

const scripts = [
  read('infrastructure/mqtt/scripts/Common-Mqtt.ps1'),
  read('infrastructure/mqtt/scripts/Initialize-Mqtt.ps1'),
  read('infrastructure/mqtt/scripts/Start-Mqtt.ps1'),
  read('infrastructure/mqtt/scripts/Test-Mqtt.ps1'),
].join('\n');
expect(
  'Không đưa mật khẩu vào tham số mosquitto_passwd',
  !/mosquitto_passwd[^\n]*\s-b\b/i.test(scripts) && scripts.includes('-H sha512-pbkdf2'),
  'phát hiện batch password hoặc thiếu SHA-512 PBKDF2',
);
expect(
  'Bộ thử bao phủ xác thực và ACL',
  scripts.includes('Kết nối ẩn danh bị từ chối') &&
    scripts.includes('Mật khẩu sai bị từ chối') &&
    scripts.includes('Thiết bị không thể ghi config/desired') &&
    scripts.includes('Thiết bị không thể ghi topic phòng khác') &&
    scripts.includes('Thiết bị không thể đọc topic phòng khác'),
  'thiếu cổng smoke test quan trọng',
);

const ignore = read('.gitignore');
expect(
  'Bí mật và runtime MQTT bị loại khỏi quản lý mã nguồn',
  ignore.includes('infrastructure/mqtt/runtime/') && ignore.includes('infrastructure/mqtt/*.local.conf'),
  '.gitignore chưa bảo vệ runtime/profile MQTT',
);
const secretCandidates = [
  'infrastructure/mqtt/passwords',
  'infrastructure/mqtt/backend.local.conf',
];
expect(
  'Không có credential chạy trong nguồn',
  secretCandidates.every((file) => !fs.existsSync(path.join(root, file))),
  'phát hiện file credential ở vị trí không được phép',
);

const env = read('config/env.example');
const expectedMqttPasswordExample = ['MQTT_PASSWORD', 'THAY_BANG_MAT_KHAU_MQTT'].join('=');
expect(
  'Biến môi trường MQTT cho máy chủ',
  env.includes('MQTT_USERNAME=smartroom-backend') && env.includes(expectedMqttPasswordExample),
  'thiếu username/password mẫu an toàn',
);

const packageJson = JSON.parse(read('package.json') || '{}');
expect(
  'Lệnh kiểm tra Giai đoạn 13',
  packageJson.scripts?.['check:stage13'] === 'node tools/check-stage13.mjs',
  'package.json chưa đăng ký check:stage13',
);

const stageDoc = read('docs/15-xay-dung-mqtt-v1.0.md');
const projectReadme = read('README.md');
expect(
  'Trạng thái tài liệu Giai đoạn 13 đã khóa',
  stageDoc.includes('ĐÃ DUYỆT — 26/09/2026') && stageDoc.includes('TRẠNG THÁI KHÓA'),
  'tài liệu G13 chưa phản ánh phê duyệt',
);
expect(
  'README trỏ đến đầu ra Giai đoạn 13',
  projectReadme.includes('docs/15-xay-dung-mqtt-v1.0.md') && projectReadme.includes('Giai đoạn 14'),
  'README thiếu liên kết G13 hoặc mốc G14',
);

console.log(`\nTổng: ${passes} đạt, ${failures.length} không đạt.`);
if (failures.length > 0) process.exit(1);
