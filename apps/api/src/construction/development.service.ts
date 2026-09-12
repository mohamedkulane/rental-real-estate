import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AreaUnit,
  ConstructionEconomicModel,
  DevelopmentPlotStatus,
  DevelopmentProjectStatus,
  ExpenseResponsibility,
  ExpenseStatus,
  ListingStatus,
  Prisma,
  PropertyStatus,
  PropertyType,
  ServiceEngagementStatus,
  ServiceModel,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { replayIdempotentRecord } from '../finance/finance.policy';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { assertSaleablePlotHasProperty } from './construction.policy';
import { ConstructionService } from './construction.service';
import type {
  AttachDevelopmentConstructionDto,
  ConvertDevelopmentPlotDto,
  CreateDevelopmentBlockDto,
  CreateDevelopmentPlotDto,
  CreateDevelopmentProjectDto,
  DevelopmentPlotTransitionDto,
  DevelopmentProjectQueryDto,
  DevelopmentProjectTransitionDto,
  RecordDevelopmentCostDto,
  UpsertDevelopmentBudgetLineDto,
} from './construction.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

const developmentTransitions: Record<DevelopmentProjectStatus, readonly DevelopmentProjectStatus[]> = {
  PLANNING: [DevelopmentProjectStatus.APPROVED, DevelopmentProjectStatus.CANCELLED],
  APPROVED: [DevelopmentProjectStatus.ACTIVE, DevelopmentProjectStatus.ON_HOLD, DevelopmentProjectStatus.CANCELLED],
  ACTIVE: [DevelopmentProjectStatus.ON_HOLD, DevelopmentProjectStatus.COMPLETED, DevelopmentProjectStatus.CANCELLED],
  ON_HOLD: [DevelopmentProjectStatus.ACTIVE, DevelopmentProjectStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class DevelopmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
    private readonly construction: ConstructionService,
  ) {}

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  async overview(principal: AuthenticatedPrincipal) {
    const branchIds = this.branches(principal, 'development.read');
    const scope = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    };
    const [activeDevelopments, plots, completedAssets, saleReady, costs, area] = await Promise.all([
      this.db.developmentProject.count({ where: { ...scope, status: DevelopmentProjectStatus.ACTIVE } }),
      this.db.developmentPlot.count({ where: { project: scope } }),
      this.db.developmentOutputAsset.count({ where: { project: scope } }),
      this.db.developmentOutputAsset.count({ where: { project: scope, saleReady: true } }),
      this.db.developmentCost.aggregate({ where: { project: scope }, _sum: { amount: true } }),
      this.db.developmentProject.aggregate({ where: scope, _sum: { totalArea: true } }),
    ]);
    const construction = await this.db.constructionProject.aggregate({
      where: {
        companyId: principal.companyId,
        economicModel: ConstructionEconomicModel.COMPANY_DEVELOPMENT,
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      },
      _avg: { actualPercent: true },
    });
    return {
      widgets: {
        activeDevelopments,
        totalPlannedArea: area._sum.totalArea?.toString() ?? '0',
        plots,
        completedAssets,
        constructionProgress: Number(construction._avg.actualPercent ?? 0),
        totalDevelopmentCost: costs._sum.amount?.toString() ?? '0',
        saleReadyAssets: saleReady,
      },
    };
  }

  async listProjects(principal: AuthenticatedPrincipal, query: DevelopmentProjectQueryDto) {
    const branchIds = this.branches(principal, 'development.read', query.branchId);
    const rows = await this.db.developmentProject.findMany({
      where: {
        companyId: principal.companyId,
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { projectNumber: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { sourceProperty: { select: { id: true, name: true, propertyCode: true } } },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async getProject(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.db.developmentProject.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        sourceProperty: { select: { id: true, name: true, propertyCode: true, city: true } },
        constructionProject: true,
        blocks: { include: { plots: true } },
        plots: true,
        budgetLines: true,
        costs: { orderBy: { businessDate: 'desc' }, take: 25 },
        outputAssets: { include: { property: true, saleListing: true, plot: true } },
      },
    });
    if (!project) throw new NotFoundException('Development project not found.');
    this.auth.assertBranchPermission(principal, 'development.read', project.branchId);
    return project;
  }

  async createProject(
    principal: AuthenticatedPrincipal,
    input: CreateDevelopmentProjectDto,
    correlationId?: string,
  ) {
    this.auth.assertBranchPermission(principal, 'development.manage', input.branchId);
    const property = await this.db.property.findFirst({
      where: { id: input.sourcePropertyId, companyId: principal.companyId },
    });
    if (!property) throw new NotFoundException('Source property not found.');
    return this.db.$transaction(async (tx) => {
      const project = await tx.developmentProject.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          projectNumber: await nextRecordNumber(tx, 'DEVELOPMENT_PROJECT'),
          name: input.name.trim(),
          sourcePropertyId: property.id,
          projectManagerEmployeeId: input.projectManagerEmployeeId ?? null,
          developmentType: input.developmentType,
          plannedStart: input.plannedStart ? isoDate(input.plannedStart) : null,
          plannedCompletion: input.plannedCompletion ? isoDate(input.plannedCompletion) : null,
          totalArea: input.totalArea ? new Prisma.Decimal(input.totalArea) : property.plotArea,
          areaUnit: input.areaUnit ?? property.plotAreaUnit ?? null,
          budgetAmount: input.budgetAmount ? new Prisma.Decimal(input.budgetAmount) : null,
          currency: (input.currency ?? 'USD').toUpperCase(),
          notes: input.notes?.trim() || null,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'development.project.created',
        entityType: 'DevelopmentProject',
        entityId: project.id,
        branchId: project.branchId,
        correlationId,
        after: { projectNumber: project.projectNumber, sourcePropertyId: property.id },
      });
      return project;
    });
  }

  async transitionProject(
    principal: AuthenticatedPrincipal,
    id: string,
    input: DevelopmentProjectTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.developmentProject.findFirst({
      where: { id, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Development project not found.');
    this.auth.assertBranchPermission(principal, 'development.manage', current.branchId);
    if (!developmentTransitions[current.status].includes(input.status)) {
      throw new ConflictException(`Development cannot transition from ${current.status} to ${input.status}.`);
    }
    const row = await this.db.developmentProject.update({
      where: { id },
      data: {
        status: input.status,
        actualCompletion:
          input.status === DevelopmentProjectStatus.COMPLETED
            ? new Date(`${principal.businessDate}T00:00:00.000Z`)
            : current.actualCompletion,
      },
    });
    await this.audit.write(this.db, {
      actorUserId: principal.userId,
      action:
        input.status === DevelopmentProjectStatus.COMPLETED
          ? 'development.project.completed'
          : 'development.project.transitioned',
      entityType: 'DevelopmentProject',
      entityId: id,
      branchId: current.branchId,
      correlationId,
      before: { status: current.status },
      after: { status: row.status },
    });
    return row;
  }

  async createBlock(principal: AuthenticatedPrincipal, input: CreateDevelopmentBlockDto) {
    const project = await this.getProject(principal, input.developmentProjectId);
    this.auth.assertBranchPermission(principal, 'development.manage', project.branchId);
    return this.db.developmentBlock.create({
      data: {
        id: uuidv7(),
        developmentProjectId: project.id,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        area: input.area ? new Prisma.Decimal(input.area) : null,
        purpose: input.purpose?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  }

  async createPlot(principal: AuthenticatedPrincipal, input: CreateDevelopmentPlotDto) {
    const project = await this.getProject(principal, input.developmentProjectId);
    this.auth.assertBranchPermission(principal, 'development.manage', project.branchId);
    return this.db.developmentPlot.create({
      data: {
        id: uuidv7(),
        developmentProjectId: project.id,
        blockId: input.blockId ?? null,
        plotNumber: input.plotNumber.trim(),
        plannedArea: input.plannedArea ? new Prisma.Decimal(input.plannedArea) : null,
        useType: input.useType?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  }

  async transitionPlot(
    principal: AuthenticatedPrincipal,
    plotId: string,
    input: DevelopmentPlotTransitionDto,
  ) {
    const plot = await this.db.developmentPlot.findFirst({
      where: { id: plotId, project: { companyId: principal.companyId } },
      include: { project: true, outputAsset: true },
    });
    if (!plot) throw new NotFoundException('Development plot not found.');
    this.auth.assertBranchPermission(principal, 'development.manage', plot.project.branchId);
    assertSaleablePlotHasProperty(input.status, Boolean(plot.outputAsset));
    return this.db.developmentPlot.update({ where: { id: plotId }, data: { status: input.status } });
  }

  async upsertBudgetLine(principal: AuthenticatedPrincipal, input: UpsertDevelopmentBudgetLineDto) {
    const project = await this.getProject(principal, input.developmentProjectId);
    this.auth.assertBranchPermission(principal, 'development.manage', project.branchId);
    return this.db.developmentBudgetLine.create({
      data: {
        id: uuidv7(),
        developmentProjectId: project.id,
        category: input.category,
        label: input.label.trim(),
        budgetAmount: new Prisma.Decimal(input.budgetAmount),
      },
    });
  }

  async recordCost(
    principal: AuthenticatedPrincipal,
    input: RecordDevelopmentCostDto,
    correlationId?: string,
  ) {
    const project = await this.getProject(principal, input.developmentProjectId);
    this.auth.assertBranchPermission(principal, 'expense.manage', project.branchId);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Development cost must be positive.');
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `development-cost:${project.id}:${input.category}:${input.businessDate}:${amount.toString()}`;
    const existing = await this.db.developmentCost.findUnique({ where: { idempotencyKey } });
    const replay = replayIdempotentRecord(existing, principal.companyId);
    if (replay) return replay;
    return this.db.$transaction(async (tx) => {
      const locked = await tx.developmentCost.findUnique({ where: { idempotencyKey } });
      const again = replayIdempotentRecord(locked, principal.companyId);
      if (again) return again;
      const expense = await tx.expense.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: project.branchId,
          expenseNumber: await nextRecordNumber(tx, 'EXPENSE'),
          vendorPartyId: input.vendorPartyId ?? null,
          propertyId: project.sourcePropertyId,
          categoryCode: input.category,
          currency: project.currency,
          amount,
          responsibility: ExpenseResponsibility.COMPANY,
          businessDate: isoDate(input.businessDate),
          description: input.allocationNotes?.trim() || `Development cost ${project.projectNumber}`,
          idempotencyKey,
          status: ExpenseStatus.APPROVED,
        },
      });
      const cost = await tx.developmentCost.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          developmentProjectId: project.id,
          expenseId: expense.id,
          vendorPartyId: input.vendorPartyId ?? null,
          category: input.category,
          amount,
          currency: project.currency,
          businessDate: isoDate(input.businessDate),
          allocationNotes: input.allocationNotes?.trim() || null,
          idempotencyKey,
        },
      });
      await tx.developmentBudgetLine.updateMany({
        where: { developmentProjectId: project.id, category: input.category },
        data: { actualAmount: { increment: amount } },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'development.cost.posted',
        entityType: 'DevelopmentCost',
        entityId: cost.id,
        branchId: project.branchId,
        correlationId,
        after: { expenseId: expense.id, amount: amount.toString(), category: input.category },
      });
      return cost;
    });
  }

  async attachConstruction(
    principal: AuthenticatedPrincipal,
    input: AttachDevelopmentConstructionDto,
    correlationId?: string,
  ) {
    const project = await this.getProject(principal, input.developmentProjectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    if (project.constructionProject) {
      throw new ConflictException('This development already has a linked construction project.');
    }
    return this.construction.createProject(
      principal,
      {
        branchId: project.branchId,
        name: input.name,
        economicModel: ConstructionEconomicModel.COMPANY_DEVELOPMENT,
        propertyId: project.sourcePropertyId,
        developmentProjectId: project.id,
      },
      correlationId,
    );
  }

  async convertPlot(
    principal: AuthenticatedPrincipal,
    input: ConvertDevelopmentPlotDto,
    correlationId?: string,
  ) {
    const plot = await this.db.developmentPlot.findFirst({
      where: { id: input.plotId, project: { companyId: principal.companyId } },
      include: { project: { include: { sourceProperty: true } }, outputAsset: true },
    });
    if (!plot) throw new NotFoundException('Development plot not found.');
    this.auth.assertBranchPermission(principal, 'portfolio.property.create', plot.project.branchId);
    if (plot.outputAsset) throw new ConflictException('This plot already has a canonical Property.');
    const company = await this.db.company.findFirstOrThrow({
      where: { id: principal.companyId },
      select: { legalPartyId: true },
    });
    if (!company.legalPartyId) throw new ConflictException('Company legal party is required for development ownership.');
    const effectiveFrom = new Date(`${principal.businessDate}T00:00:00.000Z`);
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          propertyCode: await nextRecordNumber(tx, 'PROPERTY'),
          name: input.propertyName.trim(),
          propertyType: PropertyType.HOUSE,
          status: PropertyStatus.ACTIVE,
          city: input.city?.trim() || plot.project.sourceProperty.city || 'Unknown',
          plotArea: plot.plannedArea,
          plotAreaUnit: plot.plannedArea
            ? plot.project.sourceProperty.plotAreaUnit ?? AreaUnit.SQM
            : null,
          propertyLifecycleHistories: {
            create: {
              id: uuidv7(),
              status: PropertyStatus.ACTIVE,
              effectiveFrom,
              reason: `Converted from development plot ${plot.plotNumber}`,
              actorUserId: principal.userId,
            },
          },
          branchAssignments: {
            create: { id: uuidv7(), branchId: plot.project.branchId, effectiveFrom },
          },
          ownerships: {
            create: {
              id: uuidv7(),
              ownerPartyId: company.legalPartyId!,
              ownershipPercent: new Prisma.Decimal(100),
              effectiveFrom,
              entitlements: {
                create: {
                  id: uuidv7(),
                  payoutPercent: new Prisma.Decimal(100),
                  effectiveFrom,
                },
              },
            },
          },
        },
      });
      const engagement = await tx.serviceEngagement.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          engagementNumber: await nextRecordNumber(tx, 'ENGAGEMENT'),
          serviceModel: ServiceModel.COMPANY_OWNED,
          status: ServiceEngagementStatus.ACTIVE,
          propertyId: property.id,
          effectiveFrom,
          notes: `Development output from ${plot.project.projectNumber}`,
          createdByUserId: principal.userId,
        },
      });
      let saleListingId: string | null = null;
      if (input.createSaleListing) {
        const listing = await tx.saleListing.create({
          data: {
            id: uuidv7(),
            companyId: principal.companyId,
            branchId: plot.project.branchId,
            listingNumber: await nextRecordNumber(tx, 'SALE_LISTING'),
            propertyId: property.id,
            serviceEngagementId: engagement.id,
            title: property.name,
            askingPrice: input.askingPrice ? new Prisma.Decimal(input.askingPrice) : null,
            currency: plot.project.currency,
            status: ListingStatus.DRAFT,
            createdByUserId: principal.userId,
          },
        });
        saleListingId = listing.id;
      }
      const output = await tx.developmentOutputAsset.create({
        data: {
          id: uuidv7(),
          developmentProjectId: plot.developmentProjectId,
          plotId: plot.id,
          propertyId: property.id,
          saleListingId,
          saleReady: true,
        },
      });
      await tx.developmentPlot.update({
        where: { id: plot.id },
        data: { status: DevelopmentPlotStatus.SALE_READY },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'development.asset.converted',
        entityType: 'DevelopmentOutputAsset',
        entityId: output.id,
        branchId: plot.project.branchId,
        correlationId,
        after: {
          plotId: plot.id,
          propertyId: property.id,
          propertyCode: property.propertyCode,
          saleListingId,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'portfolio.property.created',
        entityType: 'Property',
        entityId: property.id,
        branchId: plot.project.branchId,
        correlationId,
        after: { propertyCode: property.propertyCode, source: 'DEVELOPMENT_PLOT' },
      });
      return { output, property, engagement, saleListingId };
    });
  }
}
