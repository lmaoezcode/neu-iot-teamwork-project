import { databaseFilename, fail, loadLocalEnvironment } from './database-options.js';
import { openDatabase, readDatabaseDiagnostics } from '../src/data/sqlite-database.js';

async function main(): Promise<void> {
  loadLocalEnvironment();
  const filename = databaseFilename();
  const database = openDatabase(filename);
  try {
    const diagnostics = readDatabaseDiagnostics(database);
    process.stdout.write(`${JSON.stringify({ operation: 'migrate', ...diagnostics }, null, 2)}\n`);
    if (diagnostics.integrity !== 'ok' || !diagnostics.foreignKeys) {
      throw new Error('Cơ sở dữ liệu không vượt qua kiểm tra toàn vẹn/khóa ngoại sau migration.');
    }
  } finally {
    database.close();
  }
}

main().catch(fail);
