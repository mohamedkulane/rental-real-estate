import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Prisma foundation schema', () => {
  it('preserves Phase 1 canonical decisions', async () => {
    const schema = await readFile(resolve(process.cwd(), '../../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model RentableSpace');
    expect(schema).toContain('model ServiceEngagement');
    expect(schema).toContain('model JournalEntry');
    expect(schema).not.toMatch(/model\s+Unit\s*\{/);
    expect(schema).not.toMatch(/\bFloat\b/);
  });
});
