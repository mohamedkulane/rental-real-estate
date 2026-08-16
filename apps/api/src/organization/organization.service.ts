import { uuidv7 } from '@rerms/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BranchAccessMode, PartyKind, UserStatus, type Prisma } from '@prisma/client';
import { BusinessDateService } from '../common/business-date.service';
import { cursorPage, type CursorPageQueryDto } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { EffectiveDatingService } from '../common/effective-dating.service';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { PasswordService } from '../identity/password.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  AssignBranchDto,
  AssignRoleDto,
  ChangeEmployeeStatusDto,
  ChangeUserStatusDto,
  CreateBranchDto,
  CreateEmployeeDto,
  CreateUserDto,
  UpdateBranchDto,
  UpdateCompanyDto,
  UpdateEmployeeDto,
} from './organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessDate: BusinessDateService,
    private readonly effectiveDating: EffectiveDatingService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly authorization: AuthorizationService,
  ) {}

  getCompany() {
    return this.database.company.findUniqueOrThrow({ where: { singletonKey: true } });
  }

  async updateCompany(
    principal: AuthenticatedPrincipal,
    input: UpdateCompanyDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'organization.company.update');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.company.findUniqueOrThrow({ where: { singletonKey: true } });
      const after = await transaction.company.update({
        where: { id: before.id },
        data: input as Prisma.CompanyUpdateInput,
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'organization.company.updated',
        entityType: 'Company',
        entityId: after.id,
        correlationId,
        before: before,
        after: after,
      });
      return after;
    });
  }

  async listBranches(principal: AuthenticatedPrincipal) {
    const branchIds = this.authorization.authorizedBranchIds(principal, 'organization.branch.read');
    return this.database.branch.findMany({
      where: {
        companyId: principal.companyId,
        ...(branchIds === null ? {} : { id: { in: [...branchIds] } }),
      },
      orderBy: { code: 'asc' },
    });
  }

  async getBranch(principal: AuthenticatedPrincipal, branchId: string) {
    this.authorization.assertBranchPermission(principal, 'organization.branch.read', branchId);
    return this.database.branch.findFirstOrThrow({
      where: { id: branchId, companyId: principal.companyId },
    });
  }

  async createBranch(
    principal: AuthenticatedPrincipal,
    input: CreateBranchDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'organization.branch.create');
    return this.database.$transaction(async (transaction) => {
      const branch = await transaction.branch.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          code: input.code?.trim().toUpperCase() ?? (await nextRecordNumber(transaction, 'BRANCH')),
          name: input.name,
          address: input.address as Prisma.InputJsonValue,
          phone: input.phone ?? null,
          email: input.email?.toLowerCase() ?? null,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'organization.branch.created',
        entityType: 'Branch',
        entityId: branch.id,
        branchId: branch.id,
        correlationId,
        after: branch,
      });
      return branch;
    });
  }

  async updateBranch(
    principal: AuthenticatedPrincipal,
    branchId: string,
    input: UpdateBranchDto,
    correlationId?: string,
  ) {
    this.authorization.assertBranchPermission(principal, 'organization.branch.update', branchId);
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.branch.findFirstOrThrow({
        where: { id: branchId, companyId: principal.companyId },
      });
      const after = await transaction.branch.update({
        where: { id: branchId },
        data: input as Prisma.BranchUpdateInput,
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'organization.branch.updated',
        entityType: 'Branch',
        entityId: branchId,
        branchId,
        correlationId,
        before: before,
        after: after,
      });
      return after;
    });
  }

  private async assertEmployeePermission(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    permission: string,
  ) {
    const at = await this.businessDate.today(principal.companyId);
    const employee = await this.database.employee.findFirst({
      where: { id: employeeId, companyId: principal.companyId },
      include: {
        branchAssignments: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    if (
      employee.accessMode === BranchAccessMode.COMPANY_WIDE ||
      !employee.branchAssignments.length
    ) {
      this.authorization.assertCompanyPermission(principal, permission);
      return employee;
    }
    for (const assignment of employee.branchAssignments)
      this.authorization.assertBranchPermission(principal, permission, assignment.branchId);
    return employee;
  }

  async getEmployee(principal: AuthenticatedPrincipal, employeeId: string) {
    await this.assertEmployeePermission(principal, employeeId, 'identity.employee.read');
    const employee = await this.database.employee.findFirstOrThrow({
      where: { id: employeeId, companyId: principal.companyId },
      include: {
        party: { select: { displayName: true } },
        user: {
          select: {
            id: true,
            emailNormalized: true,
            status: true,
            sessions: {
              select: { id: true, createdAt: true, expiresAt: true, revokedAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        branchAssignments: { include: { branch: true }, orderBy: { effectiveFrom: 'desc' } },
        roles: { include: { role: true }, orderBy: { effectiveFrom: 'desc' } },
      },
    });
    const { party, ...record } = employee;
    return { ...record, displayName: party.displayName };
  }

  async listEmployees(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    const at = await this.businessDate.today(principal.companyId);
    const branchIds = this.authorization.authorizedBranchIds(principal, 'identity.employee.read');
    const branchFilter: Prisma.EmployeeWhereInput =
      branchIds === null
        ? {}
        : {
            accessMode: { not: BranchAccessMode.COMPANY_WIDE },
            branchAssignments: {
              some: {
                branchId: { in: [...branchIds] },
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
            },
          };
    const rows = await this.database.employee.findMany({
      where: {
        companyId: principal.companyId,
        ...branchFilter,
        ...(query.search
          ? {
              OR: [
                { employeeNumber: { contains: query.search, mode: 'insensitive' } },
                { jobTitle: { contains: query.search, mode: 'insensitive' } },
                { party: { displayName: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        party: { select: { displayName: true } },
        user: { select: { id: true, emailNormalized: true, status: true } },
        branchAssignments: true,
        roles: { include: { role: true } },
      },
      orderBy: { id: 'asc' },
    });
    return cursorPage(
      rows.map(({ party, ...employee }) => ({ ...employee, displayName: party.displayName })),
      query.limit,
      (employee) => employee.id,
    );
  }
  async createEmployee(
    principal: AuthenticatedPrincipal,
    input: CreateEmployeeDto,
    correlationId?: string,
  ) {
    this.authorization.assertBranchPermission(
      principal,
      'identity.employee.create',
      input.branchId,
    );
    if (input.accessMode === BranchAccessMode.COMPANY_WIDE)
      this.authorization.assertCompanyPermission(principal, 'identity.employee.create');
    if ((input.email && !input.password) || (!input.email && input.password))
      throw new BadRequestException('Email and password must be supplied together.');
    const passwordHash = input.password ? await this.passwords.hash(input.password) : undefined;
    const effectiveFrom = await this.businessDate.today(principal.companyId);
    return this.database.$transaction(async (transaction) => {
      const employeeNumber =
        input.employeeNumber?.trim().toUpperCase() ??
        (await nextRecordNumber(transaction, 'EMPLOYEE'));
      const employeeId = uuidv7();
      const partyId = uuidv7();
      const party = await transaction.party.create({
        data: {
          id: partyId,
          companyId: principal.companyId,
          // Staff keeps an internal Party identity for shared naming and audit links,
          // but it does not consume the business Party number sequence.
          partyNumber: `STF-${employeeId}`,
          kind: PartyKind.PERSON,
          displayName: input.displayName,
          branchAssignments: {
            create: {
              id: uuidv7(),
              branchId: input.branchId,
              effectiveFrom,
            },
          },
        },
      });
      const user = input.email
        ? await transaction.user.create({
            data: {
              id: uuidv7(),
              emailNormalized: input.email.trim().toLowerCase(),
              passwordHash: passwordHash ?? null,
              status: UserStatus.ACTIVE,
            },
          })
        : null;
      const employee = await transaction.employee.create({
        data: {
          id: employeeId,
          companyId: principal.companyId,
          partyId: party.id,
          userId: user?.id ?? null,
          employeeNumber,
          accessMode: input.accessMode,
          jobTitle: input.jobTitle ?? null,
          hireDate: input.hireDate ? new Date(input.hireDate) : null,
        },
      });
      await transaction.employeeBranchAssignment.create({
        data: {
          id: uuidv7(),
          employeeId: employee.id,
          branchId: input.branchId ?? null,
          effectiveFrom,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.employee.created',
        entityType: 'Employee',
        entityId: employee.id,
        branchId: input.branchId ?? null,
        correlationId,
        after: {
          employeeNumber: employee.employeeNumber,
          accessMode: employee.accessMode,
          userId: employee.userId,
        },
      });
      return {
        ...employee,
        displayName: party.displayName,
        user: user
          ? { id: user.id, emailNormalized: user.emailNormalized, status: user.status }
          : null,
      };
    });
  }

  async updateEmployee(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: UpdateEmployeeDto,
    correlationId?: string,
  ) {
    await this.assertEmployeePermission(principal, employeeId, 'identity.employee.update');
    if (input.accessMode === BranchAccessMode.COMPANY_WIDE)
      this.authorization.assertCompanyPermission(principal, 'identity.employee.update');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.employee.findFirstOrThrow({
        where: { id: employeeId, companyId: principal.companyId },
        include: { party: { select: { displayName: true } } },
      });
      if (input.displayName)
        await transaction.party.update({
          where: { id: before.partyId },
          data: { displayName: input.displayName },
        });
      const changes: Prisma.EmployeeUpdateInput = {};
      if (input.accessMode !== undefined) changes.accessMode = input.accessMode;
      if (input.jobTitle !== undefined) changes.jobTitle = input.jobTitle;
      if (input.hireDate !== undefined) changes.hireDate = new Date(input.hireDate);
      const after = await transaction.employee.update({
        where: { id: employeeId },
        data: changes,
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.employee.updated',
        entityType: 'Employee',
        entityId: employeeId,
        correlationId,
        before: {
          displayName: before.party.displayName,
          accessMode: before.accessMode,
          jobTitle: before.jobTitle,
          hireDate: before.hireDate,
        },
        after: {
          displayName: input.displayName ?? before.party.displayName,
          accessMode: after.accessMode,
          jobTitle: after.jobTitle,
          hireDate: after.hireDate,
        },
      });
      return { ...after, displayName: input.displayName ?? before.party.displayName };
    });
  }

  async changeEmployeeStatus(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: ChangeEmployeeStatusDto,
    correlationId?: string,
  ) {
    await this.assertEmployeePermission(principal, employeeId, 'identity.employee.update');
    if (employeeId === principal.employeeId && !input.active)
      throw new BadRequestException('You cannot deactivate your own employee record.');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.employee.findFirstOrThrow({
        where: { id: employeeId, companyId: principal.companyId },
        include: { user: { select: { id: true, status: true } } },
      });
      const after = await transaction.employee.update({
        where: { id: employeeId },
        data: { active: input.active },
      });
      if (!input.active && before.user) {
        await transaction.user.update({
          where: { id: before.user.id },
          data: { status: UserStatus.DISABLED },
        });
        await transaction.session.updateMany({
          where: { userId: before.user.id, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: 'Employee deactivated' },
        });
      }
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: input.active ? 'identity.employee.activated' : 'identity.employee.deactivated',
        entityType: 'Employee',
        entityId: employeeId,
        correlationId,
        reason: input.reason,
        before: { active: before.active, userStatus: before.user?.status ?? null },
        after: {
          active: after.active,
          userStatus:
            !input.active && before.user ? UserStatus.DISABLED : (before.user?.status ?? null),
        },
      });
      return { id: after.id, employeeNumber: after.employeeNumber, active: after.active };
    });
  }

  async assignBranch(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: AssignBranchDto,
    correlationId?: string,
  ) {
    await this.assertEmployeePermission(principal, employeeId, 'identity.employee.update');
    this.authorization.assertBranchPermission(
      principal,
      'identity.employee.update',
      input.branchId,
    );
    return this.database.$transaction(async (transaction) => {
      const employee = await transaction.employee.findFirstOrThrow({
        where: { id: employeeId, companyId: principal.companyId },
      });
      const effectiveFrom = await this.effectiveDating.scheduledDate(
        principal.companyId,
        input.effectiveFrom,
      );
      const effectiveTo = input.effectiveTo
        ? await this.effectiveDating.scheduledDate(principal.companyId, input.effectiveTo)
        : null;
      const scheduledAssignments = await transaction.employeeBranchAssignment.findMany({
        where: { employeeId, branchId: input.branchId, effectiveFrom: { gte: effectiveFrom } },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveFrom, scheduledAssignments);
      const assignment = await transaction.employeeBranchAssignment.create({
        data: {
          id: uuidv7(),
          employeeId,
          branchId: input.branchId,
          effectiveFrom,
          effectiveTo,
        },
      });
      await transaction.partyBranchAssignment.upsert({
        where: {
          partyId_branchId_effectiveFrom: {
            partyId: employee.partyId,
            branchId: input.branchId,
            effectiveFrom,
          },
        },
        update: { effectiveTo },
        create: {
          id: uuidv7(),
          partyId: employee.partyId,
          branchId: input.branchId,
          effectiveFrom,
          effectiveTo,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.employee.branch-assigned',
        entityType: 'Employee',
        entityId: employee.id,
        branchId: input.branchId ?? null,
        correlationId,
        after: {
          assignmentId: assignment.id,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo ?? null,
        },
      });
      return assignment;
    });
  }

  async assignRole(
    principal: AuthenticatedPrincipal,
    employeeId: string,
    input: AssignRoleDto,
    correlationId?: string,
  ) {
    await this.assertEmployeePermission(principal, employeeId, 'identity.role.manage');
    if (employeeId === principal.employeeId)
      throw new BadRequestException('You cannot assign a role to your own employee record.');
    if (input.branchId)
      this.authorization.assertBranchPermission(principal, 'identity.role.manage', input.branchId);
    else this.authorization.assertCompanyPermission(principal, 'identity.role.manage');
    return this.database.$transaction(async (transaction) => {
      const employee = await transaction.employee.findFirstOrThrow({
        where: { id: employeeId, companyId: principal.companyId },
      });
      const role = await transaction.role.findFirstOrThrow({
        where: { id: input.roleId, companyId: principal.companyId, active: true },
      });
      const effectiveFrom = await this.effectiveDating.scheduledDate(
        principal.companyId,
        input.effectiveFrom,
      );
      const effectiveTo = input.effectiveTo
        ? await this.effectiveDating.scheduledDate(principal.companyId, input.effectiveTo)
        : null;
      const scheduledRoles = await transaction.employeeRole.findMany({
        where: {
          employeeId,
          roleId: input.roleId,
          branchId: input.branchId ?? null,
          effectiveFrom: { gte: effectiveFrom },
        },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveFrom, scheduledRoles);
      if (input.branchId) {
        const coveringBranchAssignment = await transaction.employeeBranchAssignment.findFirst({
          where: {
            employeeId,
            branchId: input.branchId,
            effectiveFrom: { lte: effectiveFrom },
            OR: effectiveTo
              ? [{ effectiveTo: null }, { effectiveTo: { gte: effectiveTo } }]
              : [{ effectiveTo: null }],
          },
        });
        if (!coveringBranchAssignment)
          throw new BadRequestException(
            'Assign the employee to this branch for the full role period before granting the branch role.',
          );
      }
      const assignment = await transaction.employeeRole.create({
        data: {
          id: uuidv7(),
          employeeId,
          roleId: role.id,
          branchId: input.branchId ?? null,
          effectiveFrom,
          effectiveTo,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.employee.role-assigned',
        entityType: 'Employee',
        entityId: employee.id,
        branchId: input.branchId ?? null,
        correlationId,
        after: { assignmentId: assignment.id, roleCode: role.code },
      });
      return assignment;
    });
  }

  async listUsers(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    const at = await this.businessDate.today(principal.companyId);
    const branchIds = this.authorization.authorizedBranchIds(principal, 'identity.user.read');
    const employeeScope: Prisma.EmployeeWhereInput =
      branchIds === null
        ? { companyId: principal.companyId }
        : {
            companyId: principal.companyId,
            accessMode: { not: BranchAccessMode.COMPANY_WIDE },
            branchAssignments: {
              some: {
                branchId: { in: [...branchIds] },
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
            },
          };
    const rows = await this.database.user.findMany({
      where: {
        employee: employeeScope,
        ...(query.search
          ? {
              OR: [
                { emailNormalized: { contains: query.search, mode: 'insensitive' } },
                {
                  employee: {
                    ...employeeScope,
                    party: { displayName: { contains: query.search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      select: {
        id: true,
        emailNormalized: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            accessMode: true,
            party: { select: { displayName: true } },
            branchAssignments: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              select: { branchId: true },
            },
          },
        },
        sessions: {
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
            revocationReason: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    return cursorPage(rows, query.limit, (user) => user.id);
  }
  async createUser(
    principal: AuthenticatedPrincipal,
    input: CreateUserDto,
    correlationId?: string,
  ) {
    await this.assertEmployeePermission(principal, input.employeeId, 'identity.user.create');
    const passwordHash = await this.passwords.hash(input.password);
    return this.database.$transaction(async (transaction) => {
      const employee = await transaction.employee.findFirstOrThrow({
        where: { id: input.employeeId, companyId: principal.companyId },
      });
      if (employee.userId) throw new BadRequestException('Employee already has user access.');
      const user = await transaction.user.create({
        data: {
          id: uuidv7(),
          emailNormalized: input.email.trim().toLowerCase(),
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });
      await transaction.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'identity.user.created',
        entityType: 'User',
        entityId: user.id,
        correlationId,
        after: {
          emailNormalized: user.emailNormalized,
          status: user.status,
          employeeId: employee.id,
        },
      });
      return {
        id: user.id,
        emailNormalized: user.emailNormalized,
        status: user.status,
        employeeId: employee.id,
      };
    });
  }

  async changeUserStatus(
    principal: AuthenticatedPrincipal,
    userId: string,
    input: ChangeUserStatusDto,
    correlationId?: string,
  ) {
    if (principal.userId === userId && input.status !== UserStatus.ACTIVE)
      throw new BadRequestException('Users cannot deactivate their own account.');
    const target = await this.database.user.findFirst({
      where: { id: userId, employee: { companyId: principal.companyId } },
      select: { employee: { select: { id: true } } },
    });
    if (!target?.employee) throw new NotFoundException('User not found.');
    await this.assertEmployeePermission(principal, target.employee.id, 'identity.user.suspend');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.user.findFirst({
        where: { id: userId, employee: { companyId: principal.companyId } },
        select: { id: true, status: true },
      });
      if (!before) throw new NotFoundException('User not found.');
      const after = await transaction.user.update({
        where: { id: userId },
        data: { status: input.status },
      });
      if (input.status !== UserStatus.ACTIVE)
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revocationReason: `Account ${input.status.toLowerCase()}`,
          },
        });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: `identity.user.${input.status.toLowerCase()}`,
        entityType: 'User',
        entityId: userId,
        correlationId,
        reason: input.reason,
        before: { status: before.status },
        after: { status: after.status },
      });
      return { id: after.id, emailNormalized: after.emailNormalized, status: after.status };
    });
  }
}
