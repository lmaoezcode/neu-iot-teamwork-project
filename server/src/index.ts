import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

function loadLocalEnvironment(): void {
  const requested = process.env.SERVER_ENV_FILE;
  const candidates = requested
    ? [resolve(requested)]
    : [resolve(process.cwd(), 'config/server.local.env'), resolve(process.cwd(), '../config/server.local.env')];
  const selected = candidates.find((candidate) => existsSync(candidate));
  if (selected) process.loadEnvFile(selected);
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  const config = loadConfig();
  const app = await createApp(config);
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Đang dừng máy chủ');
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  await app.listen({ host: config.httpHost, port: config.httpPort });
  app.log.info(
    { address: `http://${config.httpHost}:${config.httpPort}`, device_id: config.deviceId },
    'Máy chủ phòng thông minh đã khởi động'
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Không thể khởi động máy chủ: ${message}\n`);
  process.exitCode = 1;
});
