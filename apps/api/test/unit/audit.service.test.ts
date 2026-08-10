import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../src/governance/audit.service';

describe('AuditService', () => {
  it('centrally redacts authentication material from snapshots', async () => {
    const create = vi.fn().mockResolvedValue({});
    const database = { auditLog: { create } } as unknown as Prisma.TransactionClient;
    await new AuditService().write(database, {
      action: 'security.test',
      entityType: 'User',
      after: {
        email: 'safe@example.test',
        passwordHash: 'never-store',
        nested: { resetToken: 'never-store' },
      },
    });
    const calls: unknown[][] = create.mock.calls;
    const input = calls[0]?.[0] as { data?: { afterSnapshot?: unknown } } | undefined;
    expect(input?.data?.afterSnapshot).toEqual({
      email: 'safe@example.test',
      passwordHash: '[REDACTED]',
      nested: { resetToken: '[REDACTED]' },
    });
  });
});
