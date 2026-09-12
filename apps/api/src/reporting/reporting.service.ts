import { Injectable } from '@nestjs/common';
import {
  ChargeStatus,
  ConstructionEconomicModel,
  ConstructionProjectStatus,
  DevelopmentProjectStatus,
  InvoiceStatus,
  LeadFollowUpState,
  LeadStage,
  LeaseStatus,
  MaintenanceRequestStatus,
  PaymentStatus,
  PayoutStatus,
  PropertyStatus,
  RentableSpaceStatus,
  ReservationStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

type ReportSection = Record<string, number | string>;

@Injectable()
export class ReportingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  private branchFilter(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    if (branchId) {
      this.auth.assertBranchPermission(principal, permission, branchId);
      return { branchId };
    }
    const branchIds = this.auth.authorizedBranchIds(principal, permission);
    return branchIds === null ? {} : { branchId: { in: [...branchIds] } };
  }

  private propertyBranchFilter(branchId?: string, branchIds?: ReadonlySet<string> | null) {
    if (branchId) return { branchAssignments: { some: { branchId } } };
    if (branchIds && branchIds.size)
      return { branchAssignments: { some: { branchId: { in: [...branchIds] } } } };
    return {};
  }

  async workspace(principal: AuthenticatedPrincipal, branchId?: string) {
    const companyId = principal.companyId;
    const portfolio = await this.portfolioReport(principal, branchId);
    const crm = await this.crmReport(principal, branchId);
    const rental = await this.rentalReport(principal, branchId);
    const fullManagement = await this.fullManagementReport(principal, branchId);
    const sales = await this.salesReport(principal, branchId);
    const operations = await this.operationsReport(principal, branchId);
    const finance = await this.financeReport(principal, branchId);
    const construction = await this.constructionReport(principal, branchId);
    const development = await this.developmentReport(principal, branchId);
    const branch = branchId
      ? { selectedBranchId: branchId, comparisonAvailable: false }
      : { selectedBranchId: null, comparisonAvailable: principal.accessMode === 'COMPANY_WIDE' };
    return {
      portfolio,
      crm,
      rental,
      fullManagement,
      sales,
      operations,
      finance,
      construction,
      development,
      branch,
      companyId,
    };
  }

  private async portfolioReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'property.read', branchId);
    const propertyBranchFilter = this.propertyBranchFilter(
      branchId,
      branchId ? null : this.auth.authorizedBranchIds(principal, 'property.read'),
    );
    const [properties, spaces, activeLeases] = await Promise.all([
      this.db.property.count({
        where: { companyId, status: PropertyStatus.ACTIVE, ...propertyBranchFilter },
      }),
      this.db.rentableSpace.count({
        where: {
          property: { companyId, ...propertyBranchFilter },
          status: { in: [RentableSpaceStatus.ACTIVE] },
        },
      }),
      this.db.lease.count({
        where: { companyId, status: LeaseStatus.ACTIVE, ...branchFilter },
      }),
    ]);
    const occupiedSpaces = activeLeases;
    const vacantSpaces = Math.max(spaces - occupiedSpaces, 0);
    return {
      propertyCount: properties,
      rentableSpaces: spaces,
      occupiedSpaces,
      vacantSpaces,
      occupancyRate: spaces ? Number(((occupiedSpaces / spaces) * 100).toFixed(1)) : 0,
      activeLeases,
    };
  }

  private async crmReport(principal: AuthenticatedPrincipal, branchId?: string): Promise<ReportSection> {
    const companyId = principal.companyId;
    const leadBranchFilter = branchId
      ? { responsibleBranchId: branchId }
      : this.auth.authorizedBranchIds(principal, 'lead.read') === null
        ? {}
        : {
            responsibleBranchId: {
              in: [...(this.auth.authorizedBranchIds(principal, 'lead.read') ?? [])],
            },
          };
    const [leads, followUps, sources] = await Promise.all([
      this.db.lead.count({ where: { companyId, ...leadBranchFilter } }),
      this.db.leadFollowUp.count({
        where: { lead: { companyId, ...leadBranchFilter }, state: LeadFollowUpState.OPEN },
      }),
      this.db.leadSource.count({ where: { companyId, status: 'ACTIVE' } }),
    ]);
    const converted = await this.db.lead.count({
      where: { companyId, ...leadBranchFilter, stage: LeadStage.CONVERTED },
    });
    return {
      leadCount: leads,
      openFollowUps: followUps,
      leadSources: sources,
      convertedLeads: converted,
      conversionRate: leads ? Number(((converted / leads) * 100).toFixed(1)) : 0,
    };
  }

  private async rentalReport(principal: AuthenticatedPrincipal, branchId?: string): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'lease.read', branchId);
    const [listings, viewings, applications, reservations, leases, renewals] = await Promise.all([
      this.db.rentalListing.count({ where: { companyId, ...branchFilter } }),
      this.db.viewing.count({ where: { companyId, ...branchFilter } }),
      this.db.rentalApplication.count({ where: { companyId, ...branchFilter } }),
      this.db.reservation.count({
        where: { companyId, ...branchFilter, status: ReservationStatus.ACTIVE },
      }),
      this.db.lease.count({ where: { companyId, ...branchFilter, status: LeaseStatus.ACTIVE } }),
      this.db.leaseRenewal.count({ where: { originalLease: { companyId, ...branchFilter } } }),
    ]);
    return { listings, viewings, applications, reservations, leases, renewals };
  }

  private async fullManagementReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'service-engagement.read', branchId);
    const engagements = await this.db.serviceEngagement.count({
      where: { companyId, serviceModel: 'FULL_MANAGEMENT', status: 'ACTIVE', ...branchFilter },
    });
    const rentBilled = await this.db.charge.aggregate({
      where: { companyId, ...branchFilter, status: { not: ChargeStatus.CANCELLED } },
      _sum: { originalAmount: true },
    });
    const paymentsReceived = await this.db.payment.aggregate({
      where: {
        companyId,
        ...branchFilter,
        status: { in: [PaymentStatus.POSTED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.VERIFIED] },
      },
      _sum: { amount: true },
    });
    const [expenses, payouts] = await Promise.all([
      this.db.expense.count({ where: { companyId, ...branchFilter } }),
      this.db.ownerPayout.count({
        where: {
          companyId,
          ...branchFilter,
          status: { in: [PayoutStatus.APPROVED, PayoutStatus.QUEUED, PayoutStatus.PAID, PayoutStatus.RECONCILED] },
        },
      }),
    ]);
    return {
      managedProperties: engagements,
      rentBilled: rentBilled._sum.originalAmount?.toString() ?? '0',
      paymentsReceived: paymentsReceived._sum.amount?.toString() ?? '0',
      expenses,
      pendingOwnerPayouts: payouts,
    };
  }

  private async salesReport(principal: AuthenticatedPrincipal, branchId?: string): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'sale-offer.read', branchId);
    const [listings, offers, settlements] = await Promise.all([
      this.db.saleListing.count({ where: { companyId, ...branchFilter } }),
      this.db.saleOffer.count({ where: { companyId, ...branchFilter } }),
      this.db.saleSettlement.count({ where: { companyId, ...branchFilter } }),
    ]);
    const underOffer = await this.db.saleOffer.count({
      where: { companyId, ...branchFilter, status: { in: ['SUBMITTED', 'COUNTERED', 'ACCEPTED'] } },
    });
    return { saleListings: listings, offers, underOffer, settlements };
  }

  private async operationsReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'maintenance.read', branchId);
    const [requests, workOrders, inspections, defects, highPriority] = await Promise.all([
      this.db.maintenanceRequest.count({ where: { companyId, ...branchFilter } }),
      this.db.workOrder.count({ where: { companyId, ...branchFilter } }),
      this.db.inspection.count({ where: { companyId, ...branchFilter } }),
      this.db.defectIssue.count({ where: { companyId, ...branchFilter } }),
      this.db.maintenanceRequest.count({
        where: {
          companyId,
          ...branchFilter,
          priority: { in: ['HIGH', 'URGENT'] },
          status: {
            in: [
              MaintenanceRequestStatus.NEW,
              MaintenanceRequestStatus.TRIAGED,
              MaintenanceRequestStatus.ASSIGNED,
              MaintenanceRequestStatus.IN_PROGRESS,
            ],
          },
        },
      }),
    ]);
    return { maintenanceRequests: requests, workOrders, inspections, defects, highPriorityIssues: highPriority };
  }

  private async financeReport(principal: AuthenticatedPrincipal, branchId?: string): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'invoice.read', branchId);
    const [invoices, payments, statements, payouts, expenses, outstanding] = await Promise.all([
      this.db.invoice.count({ where: { companyId, ...branchFilter } }),
      this.db.payment.count({ where: { companyId, ...branchFilter } }),
      this.db.ownerStatement.count({ where: { companyId, ...branchFilter } }),
      this.db.ownerPayout.count({ where: { companyId, ...branchFilter } }),
      this.db.expense.count({ where: { companyId, ...branchFilter } }),
      this.db.charge.aggregate({
        where: {
          companyId,
          ...branchFilter,
          status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        },
        _sum: { outstandingAmount: true },
      }),
    ]);
    return {
      invoices,
      payments,
      ownerStatements: statements,
      ownerPayouts: payouts,
      expenses,
      outstandingReceivables: outstanding._sum.outstandingAmount?.toString() ?? '0',
      openInvoices: await this.db.invoice.count({
        where: { companyId, ...branchFilter, status: InvoiceStatus.ISSUED },
      }),
    };
  }

  private async constructionReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'construction.read', branchId);
    const today = new Date();
    const [activeProjects, delayedProjects, costs] = await Promise.all([
      this.db.constructionProject.count({
        where: {
          companyId,
          ...branchFilter,
          economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
          status: ConstructionProjectStatus.ACTIVE,
        },
      }),
      this.db.constructionProject.count({
        where: {
          companyId,
          ...branchFilter,
          economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
          status: ConstructionProjectStatus.ACTIVE,
          expectedEndDate: { lt: today },
        },
      }),
      this.db.constructionCost.aggregate({
        where: { project: { companyId, ...branchFilter } },
        _sum: { amount: true },
      }),
    ]);
    const progress = await this.db.constructionProject.aggregate({
      where: {
        companyId,
        ...branchFilter,
        economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
      },
      _avg: { actualPercent: true },
    });
    const receivables = await this.db.charge.aggregate({
      where: {
        companyId,
        ...branchFilter,
        constructionBilling: { isNot: null },
        status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
      },
      _sum: { outstandingAmount: true },
    });
    const budget = await this.db.constructionBudgetLine.aggregate({
      where: { project: { companyId, ...branchFilter, economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT } },
      _sum: { budgetAmount: true, actualAmount: true },
    });
    return {
      activeProjects,
      delayedProjects,
      completionPercent: Number(progress._avg.actualPercent ?? 0),
      budgetAmount: budget._sum.budgetAmount?.toString() ?? '0',
      actualCosts: costs._sum.amount?.toString() ?? '0',
      clientReceivables: receivables._sum.outstandingAmount?.toString() ?? '0',
    };
  }

  private async developmentReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'development.read', branchId);
    const [activeDevelopments, plots, outputs, saleReady, costs] = await Promise.all([
      this.db.developmentProject.count({
        where: { companyId, ...branchFilter, status: DevelopmentProjectStatus.ACTIVE },
      }),
      this.db.developmentPlot.count({ where: { project: { companyId, ...branchFilter } } }),
      this.db.developmentOutputAsset.count({ where: { project: { companyId, ...branchFilter } } }),
      this.db.developmentOutputAsset.count({
        where: { project: { companyId, ...branchFilter }, saleReady: true },
      }),
      this.db.developmentCost.aggregate({
        where: { project: { companyId, ...branchFilter } },
        _sum: { amount: true },
      }),
    ]);
    const proceeds = await this.db.saleSettlement.aggregate({
      where: {
        companyId,
        ...this.branchFilter(principal, 'sale-settlement.read', branchId),
        property: { developmentOutputAssets: { some: {} } },
      },
      _sum: { companyProceeds: true },
    });
    const construction = await this.db.constructionProject.aggregate({
      where: {
        companyId,
        ...branchFilter,
        economicModel: ConstructionEconomicModel.COMPANY_DEVELOPMENT,
      },
      _avg: { actualPercent: true },
    });
    return {
      activeDevelopments,
      plots,
      outputProperties: outputs,
      saleReadyAssets: saleReady,
      constructionProgress: Number(construction._avg.actualPercent ?? 0),
      totalCosts: costs._sum.amount?.toString() ?? '0',
      realizedSaleProceeds: proceeds._sum.companyProceeds?.toString() ?? '0',
    };
  }

  async exportSection(principal: AuthenticatedPrincipal, section: string, branchId?: string) {
    const workspace = await this.workspace(principal, branchId);
    const data = workspace[section as keyof typeof workspace];
    if (!data || typeof data !== 'object') return { csv: 'metric,value\n' };
    const rows = Object.entries(data as Record<string, unknown>).map(([key, value]) => [key, String(value)]);
    const csv = ['metric,value', ...rows.map(([key, value]) => `"${key}","${String(value).replace(/"/g, '""')}"`)].join('\n');
    return { csv, section, generatedAt: new Date().toISOString() };
  }
}
