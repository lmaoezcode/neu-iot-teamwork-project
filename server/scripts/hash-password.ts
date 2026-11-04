import { stdin, stdout } from 'node:process';
import { hashPassword } from '../src/security/password.js';

async function readPassword(): Promise<string> {
  const fromEnvironment = process.env.OWNER_PASSWORD;
  if (fromEnvironment !== undefined) return fromEnvironment;
  if (stdin.isTTY) {
    throw new Error('Không truyền mật khẩu trên dòng lệnh. Hãy dùng infrastructure/server/Initialize-Server.ps1.');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
}

const password = await readPassword();
try {
  const encoded = await hashPassword(password);
  stdout.write(`${encoded}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Không thể tạo mã băm.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
