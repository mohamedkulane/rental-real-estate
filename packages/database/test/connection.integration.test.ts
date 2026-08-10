import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const database = new PrismaClient();

describe('PostgreSQL connectivity', () => {
  afterAll(async () => database.$disconnect());

  it('connects to PostgreSQL', async () => {
    const result = await database.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`;
    expect(result[0]?.value).toBe(1);
  });
});
