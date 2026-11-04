import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveProjectFile } from '../src/config/env.js';

export function loadLocalEnvironment(): void {
  const requested = process.env.SERVER_ENV_FILE?.trim();
  const candidates = requested
    ? [resolve(requested)]
    : [resolve(process.cwd(), 'config/server.local.env'), resolve(process.cwd(), '../config/server.local.env')];
  const selected = candidates.find((candidate) => existsSync(candidate));
  if (selected) process.loadEnvFile(selected);
}

export function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Thiếu giá trị cho --${name}.`);
  return value;
}

export function databaseFilename(): string {
  return resolveProjectFile(option('db') ?? process.env.DB_FILE?.trim() ?? './data/smartroom.sqlite3');
}

export function positiveInteger(
  name: string,
  environmentName: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = option(name) ?? process.env[environmentName] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${name} phải là số nguyên trong khoảng ${minimum}..${maximum}.`);
  }
  return value;
}

export function fail(error: unknown): never {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
