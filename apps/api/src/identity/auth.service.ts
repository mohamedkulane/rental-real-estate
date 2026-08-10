import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { BranchAccessMode, UserStatus } from '@prisma/client';
import { API_ENVIRONMENT } from '../config/foundation-config.module';
import type { ApiEnvironment } from '@rerms/config';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { PasswordService } from './password.service';

interface SessionMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  correlationId?: string | undefined;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly authorization: AuthorizationService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private issueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async login(
    email: string,
    password: string,
    metadata: SessionMetadata,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.database.user.findUnique({
      where: { emailNormalized: email.trim().toLowerCase() },
    });
    const valid = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, password)
      : false;
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password.');
    if (user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException('Invalid email or password.');
    const token = this.issueToken();
    const expiresAt = new Date(Date.now() + this.environment.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.database.$transaction(async (transaction) => {
      const session = await transaction.session.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent?.slice(0, 512) ?? null,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: user.id,
        action: 'identity.session.created',
        entityType: 'Session',
        entityId: session.id,
        correlationId: metadata.correlationId,
      });
    });
    return { token, expiresAt };
  }

  async resolveSession(token: string): Promise<AuthenticatedPrincipal> {
    const now = new Date();
    const session = await this.database.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        user: {
          include: {
            employee: {
              include: {
                branchAssignments: true,
                roles: {
                  include: {
                    role: { include: { permissions: { include: { permission: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.user.employee?.active
    ) {
      throw new UnauthorizedException('Session is invalid or expired.');
    }
    const employee = session.user.employee;
    const activeAt = (from: Date, to: Date | null) => from <= now && (!to || now < to);
    const roles = employee.roles.filter(
      (assignment) =>
        activeAt(assignment.effectiveFrom, assignment.effectiveTo) && assignment.role.active,
    );
    const permissions = new Set(
      roles.flatMap((assignment) =>
        assignment.role.permissions.map((grant) => grant.permission.code),
      ),
    );
    const permissionBranchScopes = new Map<string, Set<string | null>>();
    for (const assignment of roles) {
      for (const grant of assignment.role.permissions) {
        const scopes =
          permissionBranchScopes.get(grant.permission.code) ?? new Set<string | null>();
        scopes.add(assignment.branchId);
        permissionBranchScopes.set(grant.permission.code, scopes);
      }
    }
    const branchIds = new Set(
      employee.branchAssignments
        .filter((assignment) => activeAt(assignment.effectiveFrom, assignment.effectiveTo))
        .map((assignment) => assignment.branchId),
    );
    await this.database.session.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });
    return {
      userId: session.userId,
      sessionId: session.id,
      employeeId: employee.id,
      companyId: employee.companyId,
      accessMode: employee.accessMode,
      permissions,
      permissionBranchScopes,
      branchIds,
    };
  }

  async logout(
    principal: AuthenticatedPrincipal,
    reason: string,
    correlationId?: string,
  ): Promise<void> {
    await this.revokeSession(principal.sessionId, principal.userId, reason, correlationId);
  }

  async revokeSessionAsAdministrator(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    reason: string,
    correlationId?: string,
  ): Promise<void> {
    const now = new Date();
    const session = await this.database.session.findUnique({
      where: { id: sessionId },
      select: {
        user: {
          select: {
            employee: {
              select: {
                id: true,
                companyId: true,
                accessMode: true,
                branchAssignments: {
                  where: {
                    effectiveFrom: { lte: now },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
                  },
                  select: { branchId: true },
                },
              },
            },
          },
        },
      },
    });
    const employee = session?.user.employee;
    if (!employee || employee.companyId !== principal.companyId)
      throw new NotFoundException('Session not found.');
    if (
      employee.accessMode === BranchAccessMode.COMPANY_WIDE ||
      !employee.branchAssignments.length
    )
      this.authorization.assertCompanyPermission(principal, 'identity.session.revoke');
    else
      this.authorization.assertPermissionAcrossBranches(
        principal,
        'identity.session.revoke',
        employee.branchAssignments.map((assignment) => assignment.branchId),
      );
    await this.revokeSession(sessionId, principal.userId, reason, correlationId);
  }

  async revokeSession(
    sessionId: string,
    actorUserId: string,
    reason: string,
    correlationId?: string,
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const session = await transaction.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date(), revocationReason: reason },
      });
      await this.audit.write(transaction, {
        actorUserId,
        action: 'identity.session.revoked',
        entityType: 'Session',
        entityId: session.id,
        reason,
        correlationId,
      });
    });
  }

  async changePassword(
    principal: AuthenticatedPrincipal,
    currentPassword: string,
    newPassword: string,
    correlationId?: string,
  ): Promise<void> {
    const user = await this.database.user.findUniqueOrThrow({ where: { id: principal.userId } });
    if (!user.passwordHash || !(await this.passwords.verify(user.passwordHash, currentPassword)))
      throw new BadRequestException('Current password is incorrect.');
    const passwordHash = await this.passwords.hash(newPassword);
    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await transaction.session.updateMany({
        where: { userId: user.id, id: { not: principal.sessionId }, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'Password changed' },
      });
      await this.audit.write(transaction, {
        actorUserId: user.id,
        action: 'identity.password.changed',
        entityType: 'User',
        entityId: user.id,
        correlationId,
      });
    });
  }

  async requestPasswordReset(
    email: string,
  ): Promise<{ accepted: true; developmentToken?: string }> {
    const user = await this.database.user.findUnique({
      where: { emailNormalized: email.trim().toLowerCase() },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return { accepted: true };
    const token = this.issueToken();
    await this.database.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + this.environment.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });
    return this.environment.NODE_ENV === 'production'
      ? { accepted: true }
      : { accepted: true, developmentToken: token };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const reset = await this.database.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date())
      throw new BadRequestException('Reset token is invalid or expired.');
    const passwordHash = await this.passwords.hash(newPassword);
    await this.database.$transaction(async (transaction) => {
      await transaction.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });
      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await transaction.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'Password reset' },
      });
      await this.audit.write(transaction, {
        actorUserId: reset.userId,
        action: 'identity.password.reset',
        entityType: 'User',
        entityId: reset.userId,
      });
    });
  }
}
