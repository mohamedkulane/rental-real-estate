import { uuidv7 } from '@rerms/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessDateService } from '../common/business-date.service';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CreateRoleDto, UpdateRoleDto } from './access.dto';

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
