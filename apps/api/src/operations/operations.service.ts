import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DefectStatus,
  ExpenseResponsibility,
  ExpenseStatus,
  InspectionStatus,
  MaintenancePriority,
  MaintenanceRequestStatus,
  Prisma,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { replayIdempotentRecord } from '../finance/finance.policy';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  CreateDefectDto,
  CreateDefectMaintenanceDto,
  CreateInspectionDto,
  CreateMaintenanceRequestDto,
  CreateVendorDto,
  CreateWorkOrderDto,
  DefectTransitionDto,
  InspectionQueryDto,
  InspectionTransitionDto,
  MaintenanceQueryDto,
  MaintenanceTransitionDto,
  OperationsQueryDto,
  UpdateVendorDto,
  VendorQueryDto,
  WorkOrderQueryDto,
  WorkOrderTransitionDto,
} from './operations.dto';
import {
  assertLifecycleTransition,
  canPostWorkOrderExpense,
  defectTransitions,
  inspectionTransitions,
  maintenanceRequestTransitions,
  workOrderExpenseIdempotencyKey,
  workOrderTransitions,
} from './operations.policy';

const vendorInclude = {
  party: { select: { id: true, partyNumber: true, displayName: true, kind: true, active: true } },
  services: true,
  branches: { include: { branch: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.VendorProfileInclude;

const requestInclude = {
  property: { select: { id: true, propertyCode: true, name: true } },
  rentableSpace: { select: { id: true, spaceCode: true, name: true } },
  tenant: { select: { id: true, displayName: true } },
  assignedEmployee: { select: { id: true, employeeNumber: true } },
  assignedVendor: { include: { party: { select: { displayName: true } } } },
  activities: { orderBy: { occurredAt: 'desc' }, take: 50 },
  workOrders: { select: { id: true, workOrderNumber: true, status: true } },
} satisfies Prisma.MaintenanceRequestInclude;

const workOrderInclude = {
  property: { select: { id: true, propertyCode: true, name: true } },
  rentableSpace: { select: { id: true, spaceCode: true, name: true } },
  request: { select: { id: true, requestNumber: true, title: true, status: true } },
  vendor: { include: { party: { select: { displayName: true } } } },
  assignedEmployee: { select: { id: true, employeeNumber: true } },
  events: { orderBy: { occurredAt: 'asc' } },
  expenses: { select: { id: true, expenseNumber: true, status: true, amount: true, currency: true } },
} satisfies Prisma.WorkOrderInclude;

const inspectionInclude = {
  property: { select: { id: true, propertyCode: true, name: true } },
  rentableSpace: { select: { id: true, spaceCode: true, name: true } },
  tenant: { select: { id: true, displayName: true } },
  inspector: { select: { id: true, employeeNumber: true } },
  items: true,
  defects: { select: { id: true, defectNumber: true, title: true, status: true } },
  maintenanceRequests: { select: { id: true, requestNumber: true, title: true, status: true } },
} satisfies Prisma.InspectionInclude;

@Injectable()
export class OperationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  private async assertPropertyBranch(
    companyId: string,
    propertyId: string,
    branchId: string,
    spaceId?: string,
  ) {
    const property = await this.db.property.findFirst({
      where: { id: propertyId, companyId },
      include: { branchAssignments: true },
    });
    if (!property) throw new NotFoundException('Property not found.');
    const assigned = property.branchAssignments.some((row) => row.branchId === branchId);
    if (!assigned) throw new BadRequestException('Property is not assigned to the requested branch.');
    if (spaceId) {
      const space = await this.db.rentableSpace.findFirst({ where: { id: spaceId, propertyId } });
      if (!space) throw new BadRequestException('Rentable space does not belong to the property.');
    }
  }

  async overview(principal: AuthenticatedPrincipal) {
    const companyId = principal.companyId;
    const now = new Date();
    const openStatuses: MaintenanceRequestStatus[] = [
      MaintenanceRequestStatus.NEW,
      MaintenanceRequestStatus.TRIAGED,
      MaintenanceRequestStatus.ASSIGNED,
      MaintenanceRequestStatus.IN_PROGRESS,
      MaintenanceRequestStatus.ON_HOLD,
    ];
    const [openMaintenance, highPriority, workOrdersInProgress, upcomingInspections, overdueTasks] =
      await Promise.all([
        this.db.maintenanceRequest.count({
          where: {
            companyId,
            status: { in: openStatuses },
            ...this.branchWhere(principal, 'maintenance.read'),
          },
        }),
        this.db.maintenanceRequest.count({
          where: {
            companyId,
            status: { in: openStatuses },
            priority: { in: [MaintenancePriority.HIGH, MaintenancePriority.URGENT] },
            ...this.branchWhere(principal, 'maintenance.read'),
          },
        }),
        this.db.workOrder.count({
          where: {
            companyId,
            status: WorkOrderStatus.IN_PROGRESS,
            ...this.branchWhere(principal, 'work-order.read'),
          },
        }),
        this.db.inspection.count({
          where: {
            companyId,
            status: { in: [InspectionStatus.SCHEDULED, InspectionStatus.IN_PROGRESS] },
            scheduledAt: { gte: now },
            ...this.branchWhere(principal, 'inspection.read'),
          },
        }),
        this.db.inspection.count({
          where: {
            companyId,
            status: InspectionStatus.SCHEDULED,
            scheduledAt: { lt: now },
            ...this.branchWhere(principal, 'inspection.read'),
          },
        }),
      ]);
    return {
      openMaintenance,
      highPriorityIssues: highPriority,
      workOrdersInProgress,
      upcomingInspections,
      overdueTasks,
    };
  }

  private branchWhere(principal: AuthenticatedPrincipal, permission: string) {
    const ids = this.auth.authorizedBranchIds(principal, permission);
    return ids === null ? {} : { branchId: { in: [...ids] } };
  }

  async listVendors(principal: AuthenticatedPrincipal, query: VendorQueryDto) {
    const branchIds = this.branches(principal, 'vendor.read', query.branchId);
    const rows = await this.db.vendorProfile.findMany({
      where: {
        party: { companyId: principal.companyId },
        ...(query.active === undefined ? {} : { active: query.active }),
        ...(query.search
          ? { party: { displayName: { contains: query.search, mode: 'insensitive' }, companyId: principal.companyId } }
          : {}),
        ...(branchIds === null
          ? {}
          : { branches: { some: { branchId: { in: branchIds }, active: true } } }),
      },
      include: vendorInclude,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { partyId: query.cursor }, skip: 1 } : {}),
      orderBy: { partyId: 'desc' },
    });
    return cursorPage(rows, query.limit, (row) => row.partyId);
  }

  async getVendor(principal: AuthenticatedPrincipal, partyId: string) {
    const vendor = await this.db.vendorProfile.findFirst({
      where: { partyId, party: { companyId: principal.companyId } },
      include: {
        ...vendorInclude,
        workOrders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: { id: true, workOrderNumber: true, status: true, completedAt: true },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found.');
    const branchIds = vendor.branches.map((row) => row.branchId);
    const allowed = this.auth.authorizedBranchIds(principal, 'vendor.read');
    if (allowed !== null && (!branchIds.length || !branchIds.some((id) => allowed.has(id)))) {
      throw new NotFoundException('Vendor not found.');
    }
    return vendor;
  }

  async createVendor(principal: AuthenticatedPrincipal, input: CreateVendorDto, correlationId?: string) {
    for (const branchId of input.branchIds) {
      this.auth.assertBranchPermission(principal, 'vendor.manage', branchId);
    }
    return this.db.$transaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          partyNumber: await nextRecordNumber(tx, 'PARTY'),
          kind: input.kind,
          displayName: input.displayName.trim(),
        },
      });
      const vendor = await tx.vendorProfile.create({
        data: {
          partyId: party.id,
          notes: input.notes?.trim() || null,
          services: {
            create: (input.services ?? []).map((service) => ({
              id: uuidv7(),
              categoryCode: service.categoryCode.trim().toUpperCase(),
              name: service.name.trim(),
            })),
          },
          branches: {
            create: input.branchIds.map((branchId) => ({ id: uuidv7(), branchId })),
          },
        },
        include: vendorInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'vendor.created',
        entityType: 'VendorProfile',
        entityId: party.id,
        branchId: input.branchIds[0],
        correlationId,
        after: { displayName: party.displayName },
      });
      return vendor;
    });
  }

  async updateVendor(
    principal: AuthenticatedPrincipal,
    partyId: string,
    input: UpdateVendorDto,
    correlationId?: string,
  ) {
    const current = await this.getVendor(principal, partyId);
    this.auth.assertBranchPermission(
      principal,
      'vendor.manage',
      current.branches[0]?.branchId ?? '',
    );
    return this.db.$transaction(async (tx) => {
      if (input.services) {
        await tx.vendorService.deleteMany({ where: { vendorPartyId: partyId } });
        if (input.services.length) {
          await tx.vendorService.createMany({
            data: input.services.map((service) => ({
              id: uuidv7(),
              vendorPartyId: partyId,
              categoryCode: service.categoryCode.trim().toUpperCase(),
              name: service.name.trim(),
            })),
          });
        }
      }
      if (input.branchIds) {
        for (const branchId of input.branchIds) {
          this.auth.assertBranchPermission(principal, 'vendor.manage', branchId);
        }
        await tx.vendorBranchAvailability.deleteMany({ where: { vendorPartyId: partyId } });
        await tx.vendorBranchAvailability.createMany({
          data: input.branchIds.map((branchId) => ({ id: uuidv7(), vendorPartyId: partyId, branchId })),
        });
      }
      const vendor = await tx.vendorProfile.update({
        where: { partyId },
        data: {
          ...(input.notes === undefined ? {} : { notes: input.notes.trim() || null }),
          ...(input.active === undefined ? {} : { active: input.active }),
        },
        include: vendorInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'vendor.updated',
        entityType: 'VendorProfile',
        entityId: partyId,
        branchId: current.branches[0]?.branchId,
        correlationId,
      });
      return vendor;
    });
  }

  async listMaintenance(principal: AuthenticatedPrincipal, query: MaintenanceQueryDto) {
    const branchIds = this.branches(principal, 'maintenance.read', query.branchId);
    const rows = await this.db.maintenanceRequest.findMany({
      where: {
        companyId: principal.companyId,
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.search
          ? {
              OR: [
                { requestNumber: { contains: query.search, mode: 'insensitive' } },
                { title: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        property: { select: { id: true, propertyCode: true, name: true } },
        rentableSpace: { select: { id: true, spaceCode: true, name: true } },
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async getMaintenance(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.db.maintenanceRequest.findFirst({
      where: { id, companyId: principal.companyId },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('Maintenance request not found.');
    this.auth.assertBranchPermission(principal, 'maintenance.read', row.branchId);
    return row;
  }

  async createMaintenance(
    principal: AuthenticatedPrincipal,
    input: CreateMaintenanceRequestDto,
    correlationId?: string,
  ) {
    this.auth.assertBranchPermission(principal, 'maintenance.manage', input.branchId);
    await this.assertPropertyBranch(
      principal.companyId,
      input.propertyId,
      input.branchId,
      input.rentableSpaceId,
    );
    const reportedAt = input.reportedAt ? new Date(input.reportedAt) : new Date();
    const assigned = Boolean(input.assignedEmployeeId || input.assignedVendorPartyId);
    const status = assigned ? MaintenanceRequestStatus.ASSIGNED : MaintenanceRequestStatus.NEW;
    return this.db.$transaction(async (tx) => {
      const row = await tx.maintenanceRequest.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          requestNumber: await nextRecordNumber(tx, 'MAINTENANCE_REQUEST'),
          propertyId: input.propertyId,
          rentableSpaceId: input.rentableSpaceId ?? null,
          tenantPartyId: input.tenantPartyId ?? null,
          reportedByPartyId: input.reportedByPartyId ?? null,
          title: input.title.trim(),
          description: input.description.trim(),
          categoryCode: input.categoryCode.trim().toUpperCase(),
          priority: input.priority ?? MaintenancePriority.MEDIUM,
          status,
          reportedAt,
          assignedEmployeeId: input.assignedEmployeeId ?? null,
          assignedVendorPartyId: input.assignedVendorPartyId ?? null,
          serviceEngagementId: input.serviceEngagementId ?? null,
          sourceInspectionId: input.sourceInspectionId ?? null,
          sourceDefectId: input.sourceDefectId ?? null,
          activities: {
            create: {
              id: uuidv7(),
              action: 'created',
              toStatus: status,
              notes: 'Request opened.',
              actorUserId: principal.userId,
            },
          },
        },
        include: requestInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'maintenance-request.created',
        entityType: 'MaintenanceRequest',
        entityId: row.id,
        branchId: row.branchId,
        correlationId,
        after: { requestNumber: row.requestNumber, status: row.status },
      });
      return row;
    });
  }

  async transitionMaintenance(
    principal: AuthenticatedPrincipal,
    id: string,
    input: MaintenanceTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.getMaintenance(principal, id);
    this.auth.assertBranchPermission(principal, 'maintenance.manage', current.branchId);
    assertLifecycleTransition(maintenanceRequestTransitions, current.status, input.status, 'Maintenance request');
    return this.db.$transaction(async (tx) => {
      const row = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: input.status,
          assignedEmployeeId: input.assignedEmployeeId ?? current.assignedEmployeeId,
          assignedVendorPartyId: input.assignedVendorPartyId ?? current.assignedVendorPartyId,
          activities: {
            create: {
              id: uuidv7(),
              action: 'transitioned',
              fromStatus: current.status,
              toStatus: input.status,
              notes: input.notes?.trim() || null,
              actorUserId: principal.userId,
            },
          },
        },
        include: requestInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'maintenance-request.transitioned',
        entityType: 'MaintenanceRequest',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async listWorkOrders(principal: AuthenticatedPrincipal, query: WorkOrderQueryDto) {
    const branchIds = this.branches(principal, 'work-order.read', query.branchId);
    const rows = await this.db.workOrder.findMany({
      where: {
        companyId: principal.companyId,
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.search
          ? { workOrderNumber: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: {
        property: { select: { id: true, propertyCode: true, name: true } },
        request: { select: { requestNumber: true, title: true } },
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async getWorkOrder(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.db.workOrder.findFirst({
      where: { id, companyId: principal.companyId },
      include: workOrderInclude,
    });
    if (!row) throw new NotFoundException('Work order not found.');
    this.auth.assertBranchPermission(principal, 'work-order.read', row.branchId);
    return row;
  }

  async createWorkOrder(principal: AuthenticatedPrincipal, input: CreateWorkOrderDto, correlationId?: string) {
    this.auth.assertBranchPermission(principal, 'work-order.manage', input.branchId);
    let propertyId = input.propertyId;
    let rentableSpaceId = input.rentableSpaceId ?? null;
    let branchId = input.branchId;
    if (input.maintenanceRequestId) {
      const request = await this.getMaintenance(principal, input.maintenanceRequestId);
      propertyId = request.propertyId;
      rentableSpaceId = request.rentableSpaceId;
      branchId = request.branchId;
      this.auth.assertBranchPermission(principal, 'work-order.manage', branchId);
    }
    await this.assertPropertyBranch(principal.companyId, propertyId, branchId, rentableSpaceId ?? undefined);
    return this.db.$transaction(async (tx) => {
      const row = await tx.workOrder.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId,
          workOrderNumber: await nextRecordNumber(tx, 'WORK_ORDER'),
          maintenanceRequestId: input.maintenanceRequestId ?? null,
          propertyId,
          rentableSpaceId,
          assignedEmployeeId: input.assignedEmployeeId ?? null,
          vendorPartyId: input.vendorPartyId ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          laborNotes: input.laborNotes?.trim() || null,
          materialNotes: input.materialNotes?.trim() || null,
          estimatedCost: input.estimatedCost ? new Prisma.Decimal(input.estimatedCost) : null,
          currency: input.currency.toUpperCase(),
          approvalStatus: input.approvalStatus ?? WorkOrderApprovalStatus.NOT_REQUIRED,
          events: {
            create: {
              id: uuidv7(),
              action: 'created',
              toStatus: WorkOrderStatus.DRAFT,
              actorUserId: principal.userId,
            },
          },
        },
        include: workOrderInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'work-order.created',
        entityType: 'WorkOrder',
        entityId: row.id,
        branchId: row.branchId,
        correlationId,
        after: { workOrderNumber: row.workOrderNumber },
      });
      return row;
    });
  }

  async transitionWorkOrder(
    principal: AuthenticatedPrincipal,
    id: string,
    input: WorkOrderTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.getWorkOrder(principal, id);
    this.auth.assertBranchPermission(principal, 'work-order.manage', current.branchId);
    assertLifecycleTransition(workOrderTransitions, current.status, input.status, 'Work order');
    if (current.status === WorkOrderStatus.COMPLETED) {
      throw new ConflictException('Completed work orders are immutable.');
    }
    const nextStatus = input.status;
    return this.db.$transaction(async (tx) => {
      const row = await tx.workOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          approvalStatus: input.approvalStatus ?? current.approvalStatus,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : current.scheduledAt,
          startedAt:
            nextStatus === WorkOrderStatus.IN_PROGRESS
              ? input.startedAt
                ? new Date(input.startedAt)
                : (current.startedAt ?? new Date())
              : current.startedAt,
          completedAt:
            nextStatus === WorkOrderStatus.COMPLETED
              ? input.completedAt
                ? new Date(input.completedAt)
                : new Date()
              : current.completedAt,
          laborNotes: input.laborNotes ?? current.laborNotes,
          materialNotes: input.materialNotes ?? current.materialNotes,
          actualCost: input.actualCost ? new Prisma.Decimal(input.actualCost) : current.actualCost,
          events: {
            create: {
              id: uuidv7(),
              action: nextStatus === WorkOrderStatus.COMPLETED ? 'completed' : 'transitioned',
              fromStatus: current.status,
              toStatus: nextStatus,
              notes: input.notes?.trim() || null,
              actorUserId: principal.userId,
            },
          },
        },
        include: workOrderInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action:
          nextStatus === WorkOrderStatus.COMPLETED ? 'work-order.completed' : 'work-order.transitioned',
        entityType: 'WorkOrder',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        before: { status: current.status },
        after: { status: row.status, completedAt: row.completedAt },
      });
      return row;
    });
  }

  async createWorkOrderExpense(
    principal: AuthenticatedPrincipal,
    workOrderId: string,
    correlationId?: string,
  ) {
    const workOrder = await this.getWorkOrder(principal, workOrderId);
    this.auth.assertBranchPermission(principal, 'expense.manage', workOrder.branchId);
    if (!canPostWorkOrderExpense(workOrder)) {
      throw new ConflictException('Only approved completed work orders can create an expense.');
    }
    const actualCost = workOrder.actualCost;
    if (!actualCost || actualCost.lte(0)) {
      throw new BadRequestException('Actual cost is required before creating a maintenance expense.');
    }
    const idempotencyKey = workOrderExpenseIdempotencyKey(workOrder.id);
    const existing = await this.db.expense.findFirst({
      where: { OR: [{ workOrderId: workOrder.id }, { idempotencyKey }] },
    });
    const replay = replayIdempotentRecord(existing, principal.companyId);
    if (replay) return replay;
    const request = workOrder.maintenanceRequestId
      ? await this.db.maintenanceRequest.findFirst({
          where: { id: workOrder.maintenanceRequestId, companyId: principal.companyId },
        })
      : null;
    return this.db.$transaction(async (tx) => {
      const duplicate = await tx.expense.findFirst({
        where: { OR: [{ workOrderId: workOrder.id }, { idempotencyKey }] },
      });
      const locked = replayIdempotentRecord(duplicate, principal.companyId);
      if (locked) return locked;
      const expense = await tx.expense.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: workOrder.branchId,
          expenseNumber: await nextRecordNumber(tx, 'EXPENSE'),
          vendorPartyId: workOrder.vendorPartyId,
          propertyId: workOrder.propertyId,
          rentableSpaceId: workOrder.rentableSpaceId,
          ownerPartyId: null,
          serviceEngagementId: request?.serviceEngagementId ?? null,
          categoryCode: 'MAINTENANCE',
          currency: workOrder.currency,
          amount: actualCost,
          responsibility: ExpenseResponsibility.OWNER,
          businessDate: workOrder.completedAt ?? new Date(),
          description: `Maintenance work order ${workOrder.workOrderNumber}`,
          workOrderId: workOrder.id,
          idempotencyKey,
          status: ExpenseStatus.APPROVED,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'expense.created',
        entityType: 'Expense',
        entityId: expense.id,
        branchId: expense.branchId,
        correlationId,
        after: { expenseNumber: expense.expenseNumber, workOrderId: workOrder.id },
      });
      return expense;
    });
  }

  async listInspections(principal: AuthenticatedPrincipal, query: InspectionQueryDto) {
    const branchIds = this.branches(principal, 'inspection.read', query.branchId);
    const rows = await this.db.inspection.findMany({
      where: {
        companyId: principal.companyId,
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.search
          ? { inspectionNumber: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: { property: { select: { id: true, propertyCode: true, name: true } } },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async getInspection(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.db.inspection.findFirst({
      where: { id, companyId: principal.companyId },
      include: inspectionInclude,
    });
    if (!row) throw new NotFoundException('Inspection not found.');
    this.auth.assertBranchPermission(principal, 'inspection.read', row.branchId);
    return row;
  }

  async createInspection(principal: AuthenticatedPrincipal, input: CreateInspectionDto, correlationId?: string) {
    this.auth.assertBranchPermission(principal, 'inspection.manage', input.branchId);
    await this.assertPropertyBranch(
      principal.companyId,
      input.propertyId,
      input.branchId,
      input.rentableSpaceId,
    );
    return this.db.$transaction(async (tx) => {
      const row = await tx.inspection.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          inspectionNumber: await nextRecordNumber(tx, 'INSPECTION'),
          type: input.type,
          propertyId: input.propertyId,
          rentableSpaceId: input.rentableSpaceId ?? null,
          tenantPartyId: input.tenantPartyId ?? null,
          inspectorEmployeeId: input.inspectorEmployeeId ?? null,
          scheduledAt: new Date(input.scheduledAt),
          notes: input.notes?.trim() || null,
          items: {
            create: (input.items ?? []).map((item) => ({
              id: uuidv7(),
              area: item.area.trim(),
              item: item.item.trim(),
              condition: item.condition,
              notes: item.notes?.trim() || null,
              severity: item.severity?.trim() || null,
              photoDocumentId: item.photoDocumentId ?? null,
            })),
          },
        },
        include: inspectionInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'inspection.created',
        entityType: 'Inspection',
        entityId: row.id,
        branchId: row.branchId,
        correlationId,
        after: { inspectionNumber: row.inspectionNumber, type: row.type },
      });
      return row;
    });
  }

  async transitionInspection(
    principal: AuthenticatedPrincipal,
    id: string,
    input: InspectionTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.getInspection(principal, id);
    this.auth.assertBranchPermission(principal, 'inspection.manage', current.branchId);
    assertLifecycleTransition(inspectionTransitions, current.status, input.status, 'Inspection');
    return this.db.$transaction(async (tx) => {
      if (input.items?.length) {
        await tx.inspectionItem.deleteMany({ where: { inspectionId: id } });
        await tx.inspectionItem.createMany({
          data: input.items.map((item) => ({
            id: uuidv7(),
            inspectionId: id,
            area: item.area.trim(),
            item: item.item.trim(),
            condition: item.condition,
            notes: item.notes?.trim() || null,
            severity: item.severity?.trim() || null,
            photoDocumentId: item.photoDocumentId ?? null,
          })),
        });
      }
      const row = await tx.inspection.update({
        where: { id },
        data: {
          status: input.status,
          notes: input.notes ?? current.notes,
          completedAt: input.status === InspectionStatus.COMPLETED ? new Date() : current.completedAt,
        },
        include: inspectionInclude,
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'inspection.transitioned',
        entityType: 'Inspection',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async createDefect(principal: AuthenticatedPrincipal, input: CreateDefectDto, correlationId?: string) {
    this.auth.assertBranchPermission(principal, 'defect.manage', input.branchId);
    await this.assertPropertyBranch(
      principal.companyId,
      input.propertyId,
      input.branchId,
      input.rentableSpaceId,
    );
    if (input.inspectionId) {
      const inspection = await this.getInspection(principal, input.inspectionId);
      if (inspection.propertyId !== input.propertyId) {
        throw new BadRequestException('Defect property must match the source inspection.');
      }
    }
    return this.db.$transaction(async (tx) => {
      const row = await tx.defectIssue.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          defectNumber: await nextRecordNumber(tx, 'DEFECT'),
          propertyId: input.propertyId,
          rentableSpaceId: input.rentableSpaceId ?? null,
          inspectionId: input.inspectionId ?? null,
          inspectionItemId: input.inspectionItemId ?? null,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          severity: input.severity.trim().toUpperCase(),
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'defect.created',
        entityType: 'DefectIssue',
        entityId: row.id,
        branchId: row.branchId,
        correlationId,
        after: { defectNumber: row.defectNumber, inspectionId: row.inspectionId },
      });
      return row;
    });
  }

  async transitionDefect(
    principal: AuthenticatedPrincipal,
    id: string,
    input: DefectTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.defectIssue.findFirst({
      where: { id, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Defect not found.');
    this.auth.assertBranchPermission(principal, 'defect.manage', current.branchId);
    assertLifecycleTransition(defectTransitions, current.status, input.status, 'Defect');
    const row = await this.db.defectIssue.update({ where: { id }, data: { status: input.status } });
    await this.db.$transaction(async (tx) => {
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'defect.transitioned',
        entityType: 'DefectIssue',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        before: { status: current.status },
        after: { status: row.status },
      });
    });
    return row;
  }

  async createMaintenanceFromDefect(
    principal: AuthenticatedPrincipal,
    defectId: string,
    input: CreateDefectMaintenanceDto,
    correlationId?: string,
  ) {
    const defect = await this.db.defectIssue.findFirst({
      where: { id: defectId, companyId: principal.companyId },
    });
    if (!defect) throw new NotFoundException('Defect not found.');
    const created = await this.createMaintenance(
      principal,
      {
        branchId: defect.branchId,
        propertyId: defect.propertyId,
        ...(defect.rentableSpaceId ? { rentableSpaceId: defect.rentableSpaceId } : {}),
        title: input.title,
        description: input.description,
        categoryCode: input.categoryCode,
        priority: input.priority ?? MaintenancePriority.HIGH,
        ...(defect.inspectionId ? { sourceInspectionId: defect.inspectionId } : {}),
        sourceDefectId: defect.id,
      },
      correlationId,
    );
    await this.db.defectIssue.update({
      where: { id: defect.id },
      data: { maintenanceRequestId: created.id, status: DefectStatus.IN_PROGRESS },
    });
    return created;
  }

  async propertyConditionHistory(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    query: OperationsQueryDto,
  ) {
    const property = await this.db.property.findFirst({
      where: { id: propertyId, companyId: principal.companyId },
    });
    if (!property) throw new NotFoundException('Property not found.');
    const scoped = {
      ...this.branchWhere(principal, 'maintenance.read'),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };
    const [inspections, requests, defects, workOrders] = await Promise.all([
      this.db.inspection.findMany({
        where: { companyId: principal.companyId, propertyId, ...scoped },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      }),
      this.db.maintenanceRequest.findMany({
        where: { companyId: principal.companyId, propertyId, ...scoped },
        orderBy: { reportedAt: 'desc' },
        take: 50,
      }),
      this.db.defectIssue.findMany({
        where: { companyId: principal.companyId, propertyId, ...scoped },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.db.workOrder.findMany({
        where: { companyId: principal.companyId, propertyId, ...scoped },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const events = [
      ...inspections.map((row) => ({
        kind: 'inspection' as const,
        id: row.id,
        number: row.inspectionNumber,
        status: row.status,
        occurredAt: row.completedAt ?? row.scheduledAt,
        title: row.type,
      })),
      ...requests.map((row) => ({
        kind: 'maintenance' as const,
        id: row.id,
        number: row.requestNumber,
        status: row.status,
        occurredAt: row.reportedAt,
        title: row.title,
      })),
      ...defects.map((row) => ({
        kind: 'defect' as const,
        id: row.id,
        number: row.defectNumber,
        status: row.status,
        occurredAt: row.createdAt,
        title: row.title,
      })),
      ...workOrders.map((row) => ({
        kind: 'work-order' as const,
        id: row.id,
        number: row.workOrderNumber,
        status: row.status,
        occurredAt: row.completedAt ?? row.createdAt,
        title: row.workOrderNumber,
      })),
    ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
    return { propertyId, events };
  }
}
