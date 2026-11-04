import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/password.js';

describe('băm mật khẩu chủ phòng', () => {
  it('xác minh đúng và không chứa mật khẩu rõ', async () => {
    const password = 'Mat-khau-thu-nghiem-2026!';
    const encoded = await hashPassword(password);
    expect(encoded.startsWith('scrypt$')).toBe(true);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('sai-mat-khau', encoded)).resolves.toBe(false);
  });

  it('từ chối định dạng và tham số băm bất thường', async () => {
    await expect(verifyPassword('anything', 'plain-text')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'scrypt$999999999$8$1$AA$AA')).resolves.toBe(false);
  });
});

