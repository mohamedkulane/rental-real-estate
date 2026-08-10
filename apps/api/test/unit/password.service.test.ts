import { describe, expect, it } from 'vitest';
import { PasswordService } from '../../src/identity/password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('stores Argon2id hashes and verifies only the original password', async () => {
    const hash = await passwords.hash('Strong-Phase3-Password!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Strong-Phase3-Password!');
    await expect(passwords.verify(hash, 'Strong-Phase3-Password!')).resolves.toBe(true);
    await expect(passwords.verify(hash, 'Incorrect-Password!')).resolves.toBe(false);
  });

  it('rejects passwords below the policy length', async () => {
    await expect(passwords.hash('short')).rejects.toThrow('between 12 and 128 characters');
  });
});
