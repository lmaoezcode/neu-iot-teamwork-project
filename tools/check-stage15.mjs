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
  'server/migrations/001_initial.sql',
  'server/src/data/sqlite-database.ts',
  'server/src/data/sqlite-repository.ts',
  'server/src/data/repository.ts',
  'server/src/data/memory-repository.ts',
  'server/scripts/database-options.ts',
  'server/scripts/migrate-database.ts',
  'server/scripts/run-retention.ts',
  'server/scripts/backup-database.ts',
  'server/tsconfig.scripts.json',
  'server/test/sqlite-repository.test.ts',
  'infrastructure/database/README.md',
  'docs/17-xay-dung-co-so-du-lieu-v1.0.md'
];
expect(
  'Cây triển khai cơ sở dữ liệu',
  requiredFiles.every((file) => fs.existsSync(path.join(root, file))),
  'thiếu một hoặc nhiều file Giai đoạn 15'
);

const rootPackage = JSON.parse(read('package.json') || '{}');
const serverPackage = JSON.parse(read('server/package.json') || '{}');
const workspace = read('pnpm-workspace.yaml');
expect(
  'Phiên bản chạy và phụ thuộc SQLite đã khóa',
  rootPackage.engines?.node === '>=22' &&
    serverPackage.engines?.node === '>=22' &&
    serverPackage.dependencies?.['better-sqlite3'] === '13.0.3' &&
    typeof serverPackage.devDependencies?.['@types/better-sqlite3'] === 'string' &&
    workspace.includes('better-sqlite3: true'),
  'thiếu Node >=22, better-sqlite3 cố định hoặc quyền build native'
);
expect(
  'Lệnh vận hành G15',
  rootPackage.scripts?.['check:stage15'] === 'node tools/check-stage15.mjs' &&
    ['db:migrate', 'db:retention', 'db:backup'].every((name) => typeof rootPackage.scripts?.[name] === 'string') &&
    ['db:migrate', 'db:retention', 'db:backup'].every((name) => typeof serverPackage.scripts?.[name] === 'string') &&
    serverPackage.scripts?.typecheck?.includes('tsconfig.scripts.json'),
  'thiếu checker hoặc lệnh migration/retention/backup'
);

const migration = read('server/migrations/001_initial.sql');
const requiredTables = [
  'devices', 'device_snapshots', 'sensor_minute_samples', 'state_reports', 'availability_events',
  'configuration_revisions', 'commands', 'system_events', 'alert_causes', 'alert_transitions',
  'users', 'web_sessions', 'audit_log', 'mqtt_inbox', 'mqtt_outbox', 'sync_runs'
];
const migrationTables = matches(migration, /^CREATE TABLE ([a-z_]+) \(/gm);
expect(
  'Đủ 16 bảng nghiệp vụ',
  migrationTables.length === 16 && requiredTables.every((table) => migrationTables.includes(table)),
  `mong đợi 16 bảng; đọc được ${migrationTables.length}`
);
expect(
  'STRICT, khóa ngoại, constraint và chỉ mục',
  (migration.match(/\) STRICT;/g) ?? []).length === 16 &&
    migration.includes('REFERENCES devices(device_id)') &&
    migration.includes('CHECK (json_valid(') &&
    migration.includes('CREATE UNIQUE INDEX') &&
    migration.includes('light_off_pct - light_on_pct >= 5') &&
    !/\bppm\b/i.test(migration),
  'lược đồ thiếu STRICT/FK/CHECK/index/vùng trễ hoặc chứa ppm'
);

const database = read('server/src/data/sqlite-database.ts');
expect(
  'Migration bất biến và cấu hình SQLite an toàn',
  database.includes("createHash('sha256')") &&
    database.includes("foreign_keys = ON") &&
    database.includes("journal_mode = WAL") &&
    database.includes("synchronous = FULL") &&
    database.includes('BEGIN IMMEDIATE') &&
    database.includes('integrity_check') &&
    database.includes('source.backup(destination)'),
  'thiếu checksum/WAL/FK/FULL/transaction/integrity/online backup'
);

const repository = read('server/src/data/sqlite-repository.ts');
const service = read('server/src/services/smart-room-service.ts');
const app = read('server/src/app.ts');
const sessionStore = read('server/src/security/session-store.ts');
expect(
  'SQLite là repository sản phẩm, bộ nhớ chỉ là cổng thay thế',
  app.includes('overrides.repository ?? new SQLiteRepository') &&
    repository.includes("readonly storageMode = 'sqlite'") &&
    read('server/src/data/memory-repository.ts').includes("storageMode = 'volatile_stage14'") &&
    !app.includes('overrides.repository ?? new MemoryRepository'),
  'app chưa dùng SQLite mặc định hoặc mất repository kiểm thử'
);
expect(
  'Giao dịch nghiệp vụ và outbox nguyên tử',
  repository.includes('async saveDesiredConfig') &&
    repository.includes('if (outbox) this.upsertOutbox(outbox)') &&
    repository.includes('async saveCommand') &&
    repository.includes('async saveSyncRequest') &&
    repository.includes('private immediate<T>') &&
    repository.includes("this.database.exec('ROLLBACK')"),
  'desired/command/sync chưa ghép outbox hoặc thiếu rollback'
);
expect(
  'Inbox, outbox và phục hồi kết nối',
  repository.includes('async rememberMessage') &&
    repository.includes('duplicate_count = duplicate_count + 1') &&
    service.includes("topic.suffix !== 'telemetry/sensors'") &&
    service.includes("topic.suffix !== 'diagnostics'") &&
    service.includes('listReadyOutbox') &&
    service.includes('markOutboxFailed') &&
    service.includes('markOutboxExpired') &&
    service.includes("requestSync('server_mqtt_connected')"),
  'thiếu chống lặp, lọc QoS0, retry/hết hạn hoặc đồng bộ lại'
);
expect(
  'Nguồn và phiên bản được giữ bền vững',
  migration.includes('esp_boot_id') && migration.includes('uno_boot_id') && migration.includes('link_session_id') &&
    repository.includes('resultMessageId') &&
    service.includes('completeCommand(result.command_id, result, receivedAt, messageId)'),
  'thiếu boot/session metadata hoặc message_id kết quả thật'
);
expect(
  'Phiên web bền vững không lưu token rõ',
  sessionStore.includes('createHmac') &&
    sessionStore.includes('saveSession') &&
    repository.includes('async getSession') &&
    repository.includes('async revokeSession'),
  'phiên chưa lưu qua repository hoặc thiếu digest HMAC'
);
expect(
  'Retention bảo vệ dữ liệu đang có hiệu lực',
  repository.includes("status <> 'pending'") &&
    repository.includes('a.active = 0') &&
    repository.includes("status IN ('published', 'expired')") &&
    repository.includes("result <> 'pending'") &&
    repository.includes('d.desired_config_version') &&
    repository.includes('d.reported_config_version'),
  'retention có thể xóa pending/active/current'
);

const scripts = [
  read('server/scripts/migrate-database.ts'),
  read('server/scripts/run-retention.ts'),
  read('server/scripts/backup-database.ts')
].join('\n');
expect(
  'Công cụ migration, retention và backup có cổng an toàn',
  scripts.includes('readDatabaseDiagnostics') &&
    scripts.includes('runRetention') &&
    scripts.includes('backupDatabase') &&
    scripts.includes('Tệp sao lưu đã tồn tại, không ghi đè'),
  'công cụ thiếu chẩn đoán, retention, backup hoặc chống ghi đè'
);

const testFiles = fs.readdirSync(path.join(root, 'server/test'))
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => read(path.join('server/test', name)));
const testSources = testFiles.join('\n');
const testCount = matches(testSources, /\bit\(['"`]([^'"`]+)['"`]/g).length +
  matches(testSources, /\btest\(['"`]([^'"`]+)['"`]/g).length;
const sqliteTests = read('server/test/sqlite-repository.test.ts');
const sqliteTestCount = matches(sqliteTests, /\bit\(['"`]([^'"`]+)['"`]/g).length;
expect(
  'Bộ kiểm thử G15',
  testFiles.length >= 6 && testCount >= 22 && sqliteTestCount === 9 &&
    sqliteTests.includes("includes(Buffer.from(created.token))") &&
    sqliteTests.includes('WAL cho phép') &&
    sqliteTests.includes('bản sao lưu nhất quán'),
  `mong đợi ít nhất 6 file/22 test và đúng 9 SQLite; đọc được ${testFiles.length}/${testCount}/${sqliteTestCount}`
);

const specification = read('docs/01-dac-ta-he-thong-v1.2.md');
const groupA = matches(
  sectionBetween(specification, '## 5. A —', '## 6. B —'),
  /^\| ([A-Z]{2}-\d{2}) \|/gm
);
const stageDoc = read('docs/17-xay-dung-co-so-du-lieu-v1.0.md');
expect(
  'Truy vết 16 chức năng nhóm A',
  groupA.length === 16 && groupA.every((id) => stageDoc.includes(id)),
  `mong đợi 16 mã A trong tài liệu; đọc được ${groupA.length}`
);
expect(
  'Giới hạn học thuật và điểm duyệt rõ ràng',
  (stageDoc.includes('**CHỜ DUYỆT**') || stageDoc.includes('**ĐÃ DUYỆT — 28/09/2026**')) &&
    stageDoc.includes('22/22 kiểm thử') &&
    stageDoc.includes('Toàn bộ `KT01–KT39` đang áp dụng vẫn giữ `CHƯA THỰC HIỆN`') &&
    stageDoc.includes('không suy diễn ppm') &&
    !stageDoc.includes('CHỜ LƯỢT KIỂM TRA CUỐI'),
  'tài liệu thiếu trạng thái/giới hạn hoặc còn kết quả chưa chốt'
);

const env = read('server/src/config/env.ts');
expect(
  'DB_FILE tương đối quy về gốc dự án',
  env.includes("new URL('../../../', import.meta.url)") &&
    env.includes('resolveProjectFile') &&
    env.includes("value === ':memory:'") &&
    read('config/env.example').includes('DB_FILE=./data/smartroom.sqlite3'),
  'DB_FILE còn phụ thuộc thư mục gọi lệnh hoặc làm hỏng :memory:'
);

const readme = read('README.md');
const workflow = read('docs/00-quy-trinh-du-an.md');
expect(
  'README và quy trình trỏ đúng điểm G15',
  readme.includes('docs/17-xay-dung-co-so-du-lieu-v1.0.md') &&
    readme.includes('22/22') &&
    (workflow.includes('Giai đoạn 15') || workflow.includes('| 15 | Xây dựng cơ sở dữ liệu |')) &&
    (workflow.includes('Giai đoạn 1–16 đã khóa') || workflow.includes('Giai đoạn 15')),
  'README/quy trình chưa liên kết đầu ra hoặc sai trạng thái'
);

const productionSources = [
  database,
  repository,
  service,
  app,
  sessionStore,
  read('server/src/config/env.ts')
].join('\n');
expect(
  'Không còn mã giả trong triển khai G15',
  !/\bTODO\b|\bFIXME\b/i.test(productionSources),
  'còn TODO/FIXME trong mã nguồn sản phẩm'
);

console.log(`\nTóm tắt G15: ${requiredTables.length} bảng nghiệp vụ; ${groupA.length}/16 chức năng A; ${sqliteTestCount}/9 test SQLite; ${testCount} test hiện tại (mốc G15: 22).`);
console.log(`Tổng: ${passes} đạt, ${failures.length} không đạt.`);
if (failures.length > 0) process.exit(1);
