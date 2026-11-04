import { databaseFilename, fail, loadLocalEnvironment, positiveInteger } from './database-options.js';
import { SQLiteRepository } from '../src/data/sqlite-repository.js';

async function main(): Promise<void> {
  loadLocalEnvironment();
  const filename = databaseFilename();
  const retentionDays = positiveInteger('retention-days', 'RETENTION_DAYS', 30, 1, 3650);
  const batchSize = positiveInteger('batch-size', 'RETENTION_BATCH_SIZE', 500, 10, 10_000);
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const repository = new SQLiteRepository({ filename, retentionDays });
  try {
    const result = await repository.runRetention(cutoff, batchSize);
    process.stdout.write(`${JSON.stringify({ operation: 'retention', filename, retentionDays, batchSize, ...result }, null, 2)}\n`);
  } finally {
    await repository.close();
  }
}

main().catch(fail);
