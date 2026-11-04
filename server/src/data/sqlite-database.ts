import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

interface MigrationDefinition {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

export interface DatabaseDiagnostics {
  filename: string;
  sqliteVersion: string;
  journalMode: string;
  foreignKeys: boolean;
  integrity: string;
  userVersion: number;
  migrations: Array<{ version: number; name: string; checksum: string; appliedAt: string }>;
}

function migration(version: number, name: string, relativeUrl: string): MigrationDefinition {
  const sql = readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), 'utf8');
  return {
    version,
    name,
    sql,
    checksum: createHash('sha256').update(sql).digest('hex')
  };
}

const migrations = [migration(1, 'initial', '../../migrations/001_initial.sql')];

function resolveFilename(filename: string): string {
  if (filename === ':memory:') return filename;
  const absolute = resolve(filename);
  mkdirSync(dirname(absolute), { recursive: true });
  return absolute;
}

export function configureDatabase(database: Database.Database): void {
  database.pragma('busy_timeout = 5000');
  database.pragma('foreign_keys = ON');
  if (database.name !== ':memory:') database.pragma('journal_mode = WAL');
  database.pragma('synchronous = FULL');
}

export function applyMigrations(database: Database.Database, now: () => Date = () => new Date()): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  const applied = database
    .prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number; name: string; checksum: string }>;
  const byVersion = new Map(applied.map((item) => [item.version, item]));

  for (const item of migrations) {
    const existing = byVersion.get(item.version);
    if (existing) {
      if (existing.name !== item.name || existing.checksum !== item.checksum) {
        throw new Error(`Migration ${item.version} đã áp dụng nhưng checksum/tên không khớp.`);
      }
      continue;
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(item.sql);
      database
        .prepare('INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
        .run(item.version, item.name, item.checksum, now().toISOString());
      database.pragma(`user_version = ${item.version}`);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}

export function openDatabase(filename: string, now: () => Date = () => new Date()): Database.Database {
  const database = new Database(resolveFilename(filename), { timeout: 5000 });
  try {
    configureDatabase(database);
    applyMigrations(database, now);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function readDatabaseDiagnostics(database: Database.Database): DatabaseDiagnostics {
  const sqlite = database.prepare('SELECT sqlite_version() AS version').get() as { version: string };
  const journal = database.pragma('journal_mode', { simple: true }) as string;
  const foreignKeys = Number(database.pragma('foreign_keys', { simple: true })) === 1;
  const integrity = String(database.pragma('integrity_check', { simple: true }));
  const userVersion = Number(database.pragma('user_version', { simple: true }));
  const rows = database
    .prepare('SELECT version, name, checksum, applied_at AS appliedAt FROM schema_migrations ORDER BY version')
    .all() as DatabaseDiagnostics['migrations'];
  return {
    filename: database.name,
    sqliteVersion: sqlite.version,
    journalMode: journal,
    foreignKeys,
    integrity,
    userVersion,
    migrations: rows
  };
}

export async function backupDatabase(sourceFilename: string, destinationFilename: string): Promise<void> {
  if (sourceFilename === ':memory:') throw new Error('Không sao lưu DB :memory: bằng công cụ vận hành.');
  const source = openDatabase(sourceFilename);
  try {
    const destination = resolve(destinationFilename);
    mkdirSync(dirname(destination), { recursive: true });
    await source.backup(destination);
    const restored = openDatabase(destination);
    try {
      const diagnostics = readDatabaseDiagnostics(restored);
      if (diagnostics.integrity !== 'ok') throw new Error(`Bản sao lưu không toàn vẹn: ${diagnostics.integrity}`);
    } finally {
      restored.close();
    }
  } finally {
    source.close();
  }
}
