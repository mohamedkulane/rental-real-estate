import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { parseApiEnvironment } from '@rerms/config';

loadEnvFile(resolve(__dirname, '../.env'));
const environment = parseApiEnvironment(process.env);
const apply = process.argv.includes('--apply');
const keys = new Map<string, Buffer>([
  [
    environment.PARTY_DATA_ENCRYPTION_KEY_VERSION,
    Buffer.from(environment.PARTY_DATA_ENCRYPTION_KEY, 'hex'),
  ],
]);
for (const entry of environment.PARTY_DATA_DECRYPTION_KEYS.split(',')
  .map((value) => value.trim())
  .filter(Boolean)) {
  const separator = entry.indexOf(':');
  const version = entry.slice(0, separator);
  const key = entry.slice(separator + 1);
  if (!/^v[1-9][0-9]*$/.test(version) || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('PARTY_DATA_DECRYPTION_KEYS contains an invalid version:key entry.');
  }
  keys.set(version, Buffer.from(key, 'hex'));
}
const currentKey = keys.get(environment.PARTY_DATA_ENCRYPTION_KEY_VERSION)!;
const lookupKey = Buffer.from(environment.PARTY_CONTACT_LOOKUP_KEY, 'hex');

function decrypt(value: string): string {
  const parts = value.split('.');
  const versioned = /^v[1-9][0-9]*$/.test(parts[0] ?? '');
  const version = versioned ? parts[0]! : environment.PARTY_DATA_ENCRYPTION_KEY_VERSION;
  const [iv, tag, ciphertext] = versioned ? parts.slice(1) : parts;
  const key = keys.get(version);
  if (!key || !iv || !tag || !ciphertext)
    throw new Error(`Cannot decrypt contact encrypted with ${version}.`);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', currentKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${environment.PARTY_DATA_ENCRYPTION_KEY_VERSION}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function lookup(value: string): string {
  return createHmac('sha256', lookupKey)
    .update('party-contact-search:v1\0')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

async function main(): Promise<void> {
  const database = new PrismaClient({ datasourceUrl: environment.DATABASE_URL });
  try {
    const contacts = await database.contactPoint.findMany({
      select: { id: true, valueEncrypted: true },
      orderBy: { id: 'asc' },
    });
    const replacements = contacts.map((contact) => {
      const plaintext = decrypt(contact.valueEncrypted);
      return {
        id: contact.id,
        valueEncrypted: encrypt(plaintext),
        normalizedHash: lookup(plaintext),
      };
    });
    if (!apply) {
      console.log(
        `Dry run passed for ${replacements.length} contacts. Re-run with --apply inside an approved maintenance window.`,
      );
    } else {
      for (let offset = 0; offset < replacements.length; offset += 100) {
        const batch = replacements.slice(offset, offset + 100);
        await database.$transaction(
          batch.map((contact) =>
            database.contactPoint.update({ where: { id: contact.id }, data: contact }),
          ),
        );
      }
      console.log(
        `Re-encrypted and re-indexed ${replacements.length} contacts with ${environment.PARTY_DATA_ENCRYPTION_KEY_VERSION}.`,
      );
    }
  } finally {
    await database.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Party contact key rotation failed.');
  process.exitCode = 1;
});
