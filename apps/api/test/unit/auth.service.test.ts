import { BranchAccessMode, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnvironment } from '@rerms/config';
import { AuthService } from '../../src/identity/auth.service';
import type { PasswordService } from '../../src/identity/password.service';
import type { DatabaseService } from '../../src/database/database.service';
import type { AuditService } from '../../src/governance/audit.service';
import { AuthorizationService } from '../../src/security/authorization.service';

const environment = {
  NODE_ENV: 'test',
  SESSION_TTL_HOURS: 24,
  PASSWORD_RESET_TTL_MINUTES: 30,
  SESSION_ACTIVITY_WRITE_INTERVAL_MINUTES: 5,
  EXPOSE_DEVELOPMENT_RESET_TOKEN: false,
} as unknown as ApiEnvironment;

function fixture(
  status: UserStatus = UserStatus.ACTIVE,
  environmentOverrides: Partial<ApiEnvironment> = {},
) {
  const transaction = {
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-id' }),
      update: vi.fn().mockResolvedValue({ id: 'session-id' }),
    },
  };
  const sessionFindUnique = vi.fn();
  const verifyPassword = vi.fn().mockResolvedValue(true);
  const database = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-id', passwordHash: 'hash', status }),
    },
    session: { findUnique: sessionFindUnique, update: vi.fn() },
    passwordResetToken: { create: vi.fn().mockResolvedValue({ id: 'reset-id' }) },
    $transaction: vi.fn((work: (tx: typeof transaction) => unknown) =>
      Promise.resolve(work(transaction)),
    ),
  } as unknown as DatabaseService;
  const passwords = {
    verify: verifyPassword,
    hash: vi.fn(),
  } as unknown as PasswordService;
  const audit = { write: vi.fn() } as unknown as AuditService;
  return {
    service: new AuthService(database, passwords, audit, new AuthorizationService(), {
      ...environment,
      ...environmentOverrides,
    }),
    database,
    transaction,
    passwords,
    verifyPassword,
    sessionFindUnique,
  };
}

describe('AuthService', () => {
  it('creates a server-controlled session after valid credentials', async () => {
    const { service, transaction } = fixture();
    const result = await service.login('ADMIN@EXAMPLE.TEST', 'Valid-Password!', {});
    expect(result.token).toBeTruthy();
    expect(result.token).not.toBe(transaction.session.create.mock.calls[0]?.[0].data.tokenHash);
    expect(transaction.session.create).toHaveBeenCalledOnce();
  });

  it('uses the same failure for an incorrect password, suspended user, and disabled user', async () => {
    const incorrect = fixture();
    incorrect.verifyPassword.mockResolvedValue(false);
    await expect(incorrect.service.login('a@example.test', 'Wrong-Password!', {})).rejects.toThrow(
      'Invalid email or password.',
    );
    for (const status of [UserStatus.SUSPENDED, UserStatus.DISABLED]) {
      const { service } = fixture(status);
      await expect(service.login('a@example.test', 'Valid-Password!', {})).rejects.toThrow(
        'Invalid email or password.',
      );
    }
  });

  it('aggregates active role permissions with their branch scopes', async () => {
    const { service, sessionFindUnique } = fixture();
    sessionFindUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        status: UserStatus.ACTIVE,
        employee: {
          id: 'employee-id',
          companyId: 'company-id',
          active: true,
          accessMode: BranchAccessMode.MULTI_BRANCH,
          branchAssignments: [
            {
              branchId: 'hodan',
              effectiveFrom: new Date(0),
              effectiveTo: null,
              branch: { id: 'hodan', code: 'HODAN', name: 'Hodan Branch' },
            },
          ],
          roles: [
            {
              branchId: 'hodan',
              effectiveFrom: new Date(0),
              effectiveTo: null,
              role: {
                active: true,
                code: 'RECEPTIONIST',
                name: 'Receptionist',
                permissions: [{ permission: { code: 'organization.branch.read' } }],
              },
            },
          ],
        },
      },
    });
    const principal = await service.resolveSession('opaque-token');
    expect(principal.permissions).toEqual(new Set(['organization.branch.read']));
    expect(principal.permissionBranchScopes.get('organization.branch.read')).toEqual(
      new Set(['hodan']),
    );
    expect(principal.branchIds).toEqual(new Set(['hodan']));
    expect(principal.branches).toEqual([{ id: 'hodan', code: 'HODAN', name: 'Hodan Branch' }]);
    expect(principal.roles).toEqual([
      { code: 'RECEPTIONIST', name: 'Receptionist', branchId: 'hodan' },
    ]);
  });

  it('records a server-side revocation', async () => {
    const { service, transaction } = fixture();
    await service.revokeSession('session-id', 'actor-id', 'Administrative revocation');
    expect(transaction.session.update).toHaveBeenCalledOnce();
    const calls: unknown[][] = transaction.session.update.mock.calls;
    const updateInput = calls[0]?.[0] as { data?: { revocationReason?: string } } | undefined;
    expect(updateInput?.data?.revocationReason).toBe('Administrative revocation');
  });
  it('exposes a password-reset token only under the explicit non-production test switch', async () => {
    const defaultDevelopment = fixture(UserStatus.ACTIVE, { NODE_ENV: 'development' });
    expect(await defaultDevelopment.service.requestPasswordReset('a@example.test')).toEqual({
      accepted: true,
    });

    const explicitTest = fixture(UserStatus.ACTIVE, {
      NODE_ENV: 'test',
      EXPOSE_DEVELOPMENT_RESET_TOKEN: true,
    });
    expect(await explicitTest.service.requestPasswordReset('a@example.test')).toHaveProperty(
      'developmentToken',
    );

    const production = fixture(UserStatus.ACTIVE, {
      NODE_ENV: 'production',
      EXPOSE_DEVELOPMENT_RESET_TOKEN: true,
    });
    expect(await production.service.requestPasswordReset('a@example.test')).toEqual({
      accepted: true,
    });
  });
});
