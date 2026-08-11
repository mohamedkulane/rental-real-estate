import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Prisma operational schema boundary', () => {
  it('contains completed Phase 1-4 models and excludes unimplemented future modules', async () => {
    const schema = await readFile(resolve(process.cwd(), '../../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model RentableSpace');
    expect(schema).toContain('model PropertyLifecycleHistory');
    expect(schema).not.toMatch(/model\s+(ServiceEngagement|Lead|Lease|JournalEntry|Payment)\s*\{/);
    expect(schema).not.toMatch(/model\s+Unit\s*\{/);
    expect(schema).not.toMatch(/\bFloat\b/);
  });

  it('preserves future conceptual models outside the production schema', async () => {
    const candidate = await readFile(
      resolve(process.cwd(), '../../docs/database/prisma-design/schema-candidate.prisma'),
      'utf8',
    );
    expect(candidate).toContain('model ServiceEngagement');
    expect(candidate).toContain('model JournalEntry');
  });
});
