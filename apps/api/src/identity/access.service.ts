import { uuidv7 } from '@rerms/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessDateService } from '../common/business-date.service';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CreateRoleDto, UpdateRoleDto, UpdateUserPrivilegesDto } from './access.dto';

@Injectable()
export class AccessService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly authorization: AuthorizationService,
    private readonly businessDate: BusinessDateService,
  ) {}

  listPermissions() {
    return this.database.permission.findMany({ orderBy: { code: 'asc' } });
  }

  listRoles(principal: AuthenticatedPrincipal) {
    return this.database.role.findMany({
      where: { companyId: principal.companyId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async getUserPrivileges(principal: AuthenticatedPrincipal, userId: string) {
    this.authorization.assertCompanyPermission(principal, 'identity.user.privilege.read');
    const businessDate = await this.businessDate.today(principal.companyId);
    const user = await this.database.user.findFirstOrThrow({
      where: { id: userId, employee: { companyId: principal.companyId } },
      include: {
        employee: {
          include: {
            party: { select: { displayName: true } },
            roles: {
              where: {
                effectiveFrom: { lte: businessDate },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: businessDate } }],
                role: { active: true },
              },
              include: { role: { include: { permissions: true } } },
            },
          },
        },
        permissionOverrides: true,
      },
    });
    const inheritedIds = new Set(
      user.employee?.roles.flatMap((assignment) =>
        assignment.role.permissions.map((grant) => grant.permissionId),
      ) ?? [],
    );
    const overrides = new Map(
      user.permissionOverrides.map((override) => [override.permissionId, override.allowed]),
    );
    const permissions = await this.database.permission.findMany({ orderBy: { code: 'asc' } });
    return {
      user: {
        id: user.id,
        email: user.emailNormalized,
        displayName: user.employee?.party.displayName ?? user.emailNormalized,
        employeeNumber: user.employee?.employeeNumber ?? null,
      },
      permissions: permissions.map((permission) => {
        const inherited = inheritedIds.has(permission.id);
        const override = overrides.get(permission.id);
        return {
          ...permission,
          inherited,
          override: override ?? null,
          enabled: override ?? inherited,
        };
      }),
    };
  }

  async replaceUserPrivileges(
    principal: AuthenticatedPrincipal,
    userId: string,
    input: UpdateUserPrivilegesDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'identity.user.privilege.manage');
    const target = await this.database.user.findFirstOrThrow({
      where: { id: userId, employee: { companyId: principal.companyId } },
      select: { id: true, permissionOverrides: true },
    });
    const permissions = await this.database.permission.findMany({
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    });
    const knownIds = new Set(permissions.map((permission) => permission.id));
    if (input.permissionIds.some((permissionId) => !knownIds.has(permissionId)))
      throw new BadRequestException('One or more permissions are invalid.');
    const managePermission = permissions.find(
      (permission) => permission.code === 'identity.user.privilege.manage',
    );
    if (
      target.id === principal.userId &&
      managePermission &&
      !input.permissionIds.includes(managePermission.id)
    )
      throw new BadRequestException('You cannot remove your own privilege-management access.');

    const enabled = new Set(input.permissionIds);
    await this.database.$transaction(async (transaction) => {
      await transaction.userPermissionOverride.deleteMany({ where: { userId } });
      await transaction.userPermissionOverride.createMany({
        data: permissions.map((permission) => ({
          userId,
          permissionId: permission.id,
          allowed: enabled.has(permission.id),
        })),
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.user.privileges-replaced',
        entityType: 'User',
        entityId: userId,
        correlationId,
        reason: input.reason,
        before: {
          overrides: target.permissionOverrides.map((override) => ({
            permissionId: override.permissionId,
            allowed: override.allowed,
          })),
        },
        after: {
          permissionCodes: permissions
            .filter((permission) => enabled.has(permission.id))
            .map((permission) => permission.code),
        },
      });
    });
    return this.getUserPrivileges(principal, userId);
  }

  async createRole(
    principal: AuthenticatedPrincipal,
    input: CreateRoleDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'identity.role.manage');
    return this.database.$transaction(async (transaction) => {
      const role = await transaction.role.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          code: input.code.trim().toUpperCase(),
          name: input.name,
          active: true,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.role.created',
        entityType: 'Role',
        entityId: role.id,
        correlationId,
        after: role,
      });
      return role;
    });
  }

  async updateRole(
    principal: AuthenticatedPrincipal,
    roleId: string,
    input: UpdateRoleDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'identity.role.manage');
    if (input.active === false && !input.reason)
      throw new BadRequestException('A reason is required to deactivate a business role.');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.role.findFirstOrThrow({
        where: { id: roleId, companyId: principal.companyId },
      });
      const after = await transaction.role.update({
        where: { id: roleId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action:
          input.active === false
            ? 'identity.role.deactivated'
            : input.active === true
              ? 'identity.role.activated'
              : 'identity.role.updated',
        entityType: 'Role',
        entityId: roleId,
        correlationId,
        reason: input.reason,
        before: { name: before.name, active: before.active },
        after: { name: after.name, active: after.active },
      });
      return after;
    });
  }

  async grantPermission(
    principal: AuthenticatedPrincipal,
    roleId: string,
    permissionId: string,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'identity.role.manage');
    return this.database.$transaction(async (transaction) => {
      const role = await transaction.role.findFirstOrThrow({
        where: { id: roleId, companyId: principal.companyId },
      });
      const permission = await transaction.permission.findUniqueOrThrow({
        where: { id: permissionId },
      });
      await transaction.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.role.permission-granted',
        entityType: 'Role',
        entityId: role.id,
        correlationId,
        after: { permissionCode: permission.code },
      });
      return { roleId, permissionId };
    });
  }

  async revokePermission(
    principal: AuthenticatedPrincipal,
    roleId: string,
    permissionId: string,
    reason: string,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'identity.role.manage');
    return this.database.$transaction(async (transaction) => {
      const role = await transaction.role.findFirstOrThrow({
        where: { id: roleId, companyId: principal.companyId },
      });
      const permission = await transaction.permission.findUniqueOrThrow({
        where: { id: permissionId },
      });
      await transaction.rolePermission.delete({
        where: { roleId_permissionId: { roleId, permissionId } },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.role.permission-revoked',
        entityType: 'Role',
        entityId: role.id,
        correlationId,
        reason,
        before: { permissionCode: permission.code },
      });
      return { success: true };
    });
  }

  async endEmployeeRole(
    principal: AuthenticatedPrincipal,
    assignmentId: string,
    reason: string,
    correlationId?: string,
  ) {
    return this.database.$transaction(async (transaction) => {
      const assignment = await transaction.employeeRole.findFirstOrThrow({
        where: { id: assignmentId, employee: { companyId: principal.companyId } },
        include: { role: true },
      });
      if (assignment.branchId)
        this.authorization.assertBranchPermission(
          principal,
          'identity.role.manage',
          assignment.branchId,
        );
      else this.authorization.assertCompanyPermission(principal, 'identity.role.manage');
      const businessDate = await this.businessDate.today(principal.companyId);
      const sameDayOrFuture = assignment.effectiveFrom >= businessDate;
      const after = sameDayOrFuture
        ? await transaction.employeeRole.delete({ where: { id: assignmentId } })
        : await transaction.employeeRole.update({
            where: { id: assignmentId },
            data: { effectiveTo: businessDate },
          });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: sameDayOrFuture
          ? 'identity.employee.role-cancelled'
          : 'identity.employee.role-removed',
        entityType: 'Employee',
        entityId: assignment.employeeId,
        branchId: assignment.branchId,
        correlationId,
        reason,
        before: { assignmentId, roleCode: assignment.role.code },
        after: { effectiveTo: sameDayOrFuture ? null : businessDate, cancelled: sameDayOrFuture },
      });
      return { ...after, cancelled: sameDayOrFuture };
    });
  }
}
