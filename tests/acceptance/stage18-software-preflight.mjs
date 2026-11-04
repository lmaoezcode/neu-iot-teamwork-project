/**
 * Tiền kiểm Giai đoạn 18 khi G17 còn mở.
 *
 * Chỉ tái chạy bao phủ phần mềm cho KT19, KT20 và KT21. Kết quả PASS ở đây
 * không được dùng để đổi trạng thái chấp nhận trong Ma trận 1.2.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reportPath = path.join(root, 'data', 'logs', 'stage18-software-preflight.json');
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli || !path.basename(pnpmCli).toLowerCase().includes('pnpm')) {
  throw new Error('Hãy chạy tiền kiểm qua `pnpm preflight:stage18` để xác định pnpm CLI an toàn.');
}
const stripAnsi = (value) => value.replaceAll(/\u001b\[[0-9;]*m/g, '');

const suites = [
  {
    id: 'build',
    command: process.execPath,
    args: [pnpmCli, 'build'],
    supports: ['KT19', 'KT20', 'KT21']
  },
  {
    id: 'server-targeted',
    command: process.execPath,
    args: [
      pnpmCli, '--dir', 'server', 'exec', 'vitest', 'run',
      'test/api.test.ts', 'test/password.test.ts', 'test/sqlite-repository.test.ts',
      '--pool=threads', '--poolOptions.threads.singleThread=true'
    ],
    supports: ['KT19', 'KT20', 'KT21']
  },
  {
    id: 'web-targeted',
    command: process.execPath,
    args: [
      pnpmCli, '--dir', 'web', 'exec', 'vitest', 'run',
      'src/router.test.ts', 'src/api/client.test.ts', 'src/domain/history.test.ts'
    ],
    supports: ['KT19', 'KT20', 'KT21']
  },
  {
    id: 'loopback-integration',
    command: process.execPath,
    args: ['tests/integration/stage17-software-chain.mjs'],
    supports: ['KT21']
  }
];

function runSuite(suite) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(suite.command, suite.args, {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const collect = (chunk, destination) => {
      const text = chunk.toString();
      output += text;
      destination.write(text);
    };
    child.stdout.on('data', (chunk) => collect(chunk, process.stdout));
    child.stderr.on('data', (chunk) => collect(chunk, process.stderr));
    child.once('error', (error) => {
      resolve({
        id: suite.id,
        supports: suite.supports,
        result: 'FAIL',
        exit_code: null,
        duration_ms: Date.now() - startedAt,
        output_tail: error.message
      });
    });
    child.once('exit', (code) => {
      const clean = stripAnsi(output).trim();
      resolve({
        id: suite.id,
        supports: suite.supports,
        result: code === 0 ? 'PREFLIGHT_PASS' : 'FAIL',
        exit_code: code,
        duration_ms: Date.now() - startedAt,
        output_tail: clean.slice(-4000)
      });
    });
  });
}

async function main() {
  const results = [];
  for (const suite of suites) {
    process.stdout.write(`\n[TIỀN KIỂM] ${suite.id}\n`);
    const result = await runSuite(suite);
    results.push(result);
    if (result.result !== 'PREFLIGHT_PASS') break;
  }

  const cases = ['KT19', 'KT20', 'KT21'].map((id) => {
    const required = suites.filter((suite) => suite.supports.includes(id)).map((suite) => suite.id);
    const completed = results.filter((result) => required.includes(result.id));
    const passed = completed.length === required.length && completed.every((result) => result.result === 'PREFLIGHT_PASS');
    return {
      id,
      preflight_result: passed ? 'PREFLIGHT_PASS' : 'FAIL',
      acceptance_result: 'CHƯA THỰC HIỆN',
      suites: required
    };
  });

  const report = {
    schema: 'smartroom.stage18-software-preflight',
    schema_version: 1,
    executed_at: new Date().toISOString(),
    scope: 'TIỀN KIỂM PHẦN MỀM/MÔ PHỎNG — G17 CHƯA ĐÓNG',
    acceptance_updates_allowed: false,
    hardware_evidence: false,
    result: results.length === suites.length && results.every((item) => item.result === 'PREFLIGHT_PASS')
      ? 'PREFLIGHT_PASS'
      : 'FAIL',
    suites: results,
    cases
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nBiên bản tiền kiểm: ${reportPath}\n`);
  process.stdout.write('Trạng thái KT19/KT20/KT21 vẫn là CHƯA THỰC HIỆN.\n');
  if (report.result !== 'PREFLIGHT_PASS') process.exit(1);
}

await main();
