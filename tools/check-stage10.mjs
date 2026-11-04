import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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

const requiredFiles = [
  'README.md',
  'package.json',
  'config/env.example',
  '.gitignore',
  'docs/00-quy-trinh-du-an.md',
  'docs/01-dac-ta-he-thong-v1.2.md',
  'docs/02-ma-tran-kiem-thu-v1.2.md',
  'docs/03-danh-muc-phan-cung-v1.2.md',
  'docs/04-kiem-soat-thay-doi-CR-02.md',
  'docs/05-kien-truc-he-thong-v1.1.md',
  'docs/06-thiet-ke-uml-v1.1.md',
  'docs/07-thiet-ke-phan-cung-v1.0.md',
  'docs/08-giao-thuc-uno-esp32-v1.0.md',
  'docs/09-thiet-ke-mqtt-v1.0.md',
  'docs/10-thiet-ke-du-lieu-v1.0.md',
  'docs/11-thiet-ke-giao-dien-v1.0.md',
  'docs/12-cau-truc-du-an-v1.0.md',
  'server/src/app.ts',
  'server/src/index.ts',
  'web/src/main.ts',
  'firmware/uno/src/main.cpp',
  'firmware/esp32/src/main.cpp'
];

for (const relativePath of requiredFiles) read(relativePath);

for (const relativePath of ['package.json', 'server/package.json', 'web/package.json']) {
  try {
    JSON.parse(read(relativePath));
  } catch (error) {
    failures.push(`JSON không hợp lệ: ${relativePath} (${error.message})`);
  }
}

const specification = read('docs/01-dac-ta-he-thong-v1.2.md');
const matrix = read('docs/02-ma-tran-kiem-thu-v1.2.md');
const structure = read('docs/12-cau-truc-du-an-v1.0.md');
const readme = read('README.md');

const functionIds = matches(specification, /^### \d+\.\d+\. ([A-Z]{2}-\d{2}) —/gm);
const testIds = matches(matrix, /^### (KT\d{2}) —/gm);
const gateIds = matches(structure, /^\| (G10-[A-Z0-9-]+) \|/gm);

function sectionBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex >= 0 ? text.slice(startIndex, endIndex) : '';
}

const groupA = matches(
  sectionBetween(specification, '## 5. A —', '## 6. B —'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);
const groupB = matches(
  sectionBetween(specification, '## 6. B —', '## 7. C —'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);
const groupC = matches(
  sectionBetween(specification, '## 7. C —', '### 7.1.'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);

if (functionIds.length !== 18 || groupA.length !== 16 || groupB.length !== 1 || groupC.length !== 1) {
  failures.push(`Số chức năng không khớp: ${functionIds.length} tổng, A=${groupA.length}, B=${groupB.length}, C=${groupC.length}`);
}
if (testIds.length !== 32) failures.push(`Số kiểm thử đang áp dụng không khớp: ${testIds.length}`);
if (gateIds.length !== 9) failures.push(`Số cổng Giai đoạn 10 không khớp: ${gateIds.length}`);

const uniqueFunctionIds = new Set(functionIds);
const uniqueTestIds = new Set(testIds);
if (uniqueFunctionIds.size !== functionIds.length) failures.push('Mã chức năng bị lặp trong đặc tả đang áp dụng.');
if (uniqueTestIds.size !== testIds.length) failures.push('Mã kiểm thử bị lặp trong ma trận đang áp dụng.');

const localLinks = [...readme.matchAll(/\]\(\.\/([^)#]+)(?:#[^)]+)?\)/g)].map((match) => match[1]);
for (const link of new Set(localLinks)) {
  if (!existsSync(join(projectRoot, link))) failures.push(`Liên kết README không tồn tại: ${link}`);
}

const webSource = readdirSync(join(projectRoot, 'web', 'src'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(ts|css|html)$/.test(entry.name))
  .map((entry) => readFileSync(join(projectRoot, 'web', 'src', entry.name), 'utf8'))
  .join('\n');
if (/from\s+['"](?:mqtt|better-sqlite3|sqlite3)['"]|mqtt\.(?:connect|subscribe|publish)|new\s+Database\s*\(/i.test(webSource)) {
  failures.push('Web source không được kết nối MQTT/SQLite trực tiếp.');
}

const unoSource = readdirSync(join(projectRoot, 'firmware', 'uno', 'src'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(cpp|hpp|h)$/.test(entry.name))
  .map((entry) => readFileSync(join(projectRoot, 'firmware', 'uno', 'src', entry.name), 'utf8'))
  .join('\n');
if (/ArduinoJson|PubSubClient|WiFi\.h|HTTPClient|\bMQTT\b/.test(unoSource)) failures.push('UNO scaffold không được phụ thuộc MQTT/HTTP/JSON động.');

const privateKeyMarker = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const quotedCredentialAssignment = /(?:password|passwd|token|ssid)\s*[=:]\s*(['"`])([^'"`\r\n]+)\1/gi;
const rawCredentialAssignment = /^(?:password|passwd|token|ssid)\s*=\s*([^\s#;]+)\s*$/gim;
const textFile = /(?:\.md|\.json|\.ts|\.tsx|\.js|\.mjs|\.c|\.cpp|\.h|\.hpp|\.ini|\.env|\.example|\.ya?ml|\.css|\.html)$/i;
for (const relativePath of ['server', 'web', 'firmware', 'shared', 'tools', 'tests']) {
  const base = join(projectRoot, relativePath);
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!/^(?:node_modules|dist|\.pio|\.pio-core|\.pio-venv)$/.test(entry.name)) walk(absolutePath);
      } else if (textFile.test(entry.name)) {
        const content = readFileSync(absolutePath, 'utf8');
        let hasSecret = privateKeyMarker.test(content);
        const relativePath = relative(projectRoot, absolutePath).replaceAll('\\', '/');
        const values = [];
        quotedCredentialAssignment.lastIndex = 0;
        for (const match of content.matchAll(quotedCredentialAssignment)) values.push(match[2]);
        rawCredentialAssignment.lastIndex = 0;
        for (const match of content.matchAll(rawCredentialAssignment)) values.push(match[1]);
        for (const value of values) {
          const isReference = /^(?:SMARTROOM_[A-Z0-9_]+|process\.env\.|import\.meta\.env\.|THAY_BANG_)/.test(value);
          const isDeclaredTestValue = /(?:^|\/)test(?:\/|\.|s\/)/i.test(relativePath) &&
            /^(?:test-only-|Mat-khau-thu-nghiem-)/i.test(value);
          if (value.length >= 12 && !isReference && !isDeclaredTestValue) hasSecret = true;
        }
        if (hasSecret) failures.push(`Có chuỗi giống bí mật trong ${relative(projectRoot, absolutePath)}`);
      }
    }
  };
  walk(base);
}

const result = {
  requiredFiles: requiredFiles.length,
  functions: functionIds.length,
  groups: { A: groupA.length, B: groupB.length, C: groupC.length },
  activeTests: testIds.length,
  stage10Gates: gateIds.length,
  localReadmeLinks: new Set(localLinks).size,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
