import { existsSync } from 'node:fs';
import { dirname, extname, join, parse } from 'node:path';
import { backupDatabase, openDatabase, readDatabaseDiagnostics } from '../src/data/sqlite-database.js';
import { databaseFilename, fail, loadLocalEnvironment, option } from './database-options.js';
import { resolveProjectFile } from '../src/config/env.js';

function timestamp(): string {
  return new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');
}

function defaultDestination(source: string): string {
  const info = parse(source);
  const extension = extname(source) || '.sqlite3';
  return join(dirname(source), 'backups', `${info.name}-${timestamp()}${extension}`);
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  const source = databaseFilename();
  const requested = option('output');
  const destination = requested ? resolveProjectFile(requested) : defaultDestination(source);
  if (source === destination) throw new Error('Đích sao lưu phải khác tệp cơ sở dữ liệu nguồn.');
  if (existsSync(destination)) throw new Error(`Tệp sao lưu đã tồn tại, không ghi đè: ${destination}`);
  await backupDatabase(source, destination);
  const restored = openDatabase(destination);
  try {
    const diagnostics = readDatabaseDiagnostics(restored);
    process.stdout.write(`${JSON.stringify({ operation: 'backup', source, destination, ...diagnostics }, null, 2)}\n`);
  } finally {
    restored.close();
  }
}

main().catch(fail);
