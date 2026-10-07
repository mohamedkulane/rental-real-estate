import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  ChargeStatus,
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
import type { ReportExportQueryDto } from '../portals/portal.dto';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

type ReportSection = Record<string, number | string>;
type ReportCell = string | number | null;
type ReportRow = Record<string, ReportCell>;
type DetailedReport = {
  section: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: ReportRow[];
  generatedAt: string;
};

const REPORT_TITLES: Record<string, string> = {
  portfolio: 'Portfolio',
  rental: 'Rental',
  fullManagement: 'Full Management',
  sales: 'Sales',
  finance: 'Finance',
  operations: 'Operations',
  development: 'Development',
};

function dateText(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

function dateTimeText(value: Date | null | undefined): string {
  return value ? value.toISOString() : '';
}

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
    const branchFilter = this.branchFilter(principal, 'portfolio.property.read', branchId);
    const propertyBranchFilter = this.propertyBranchFilter(
      branchId,
      branchId ? null : this.auth.authorizedBranchIds(principal, 'portfolio.property.read'),
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

  private async crmReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
    const companyId = principal.companyId;
    const leadBranchFilter = branchId
      ? { responsibleBranchId: branchId }
      : this.auth.authorizedBranchIds(principal, 'crm.lead.read') === null
        ? {}
        : {
            responsibleBranchId: {
              in: [...(this.auth.authorizedBranchIds(principal, 'crm.lead.read') ?? [])],
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

  private async rentalReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
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
        status: {
          in: [PaymentStatus.POSTED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.VERIFIED],
        },
      },
      _sum: { amount: true },
    });
    const [expenses, payouts] = await Promise.all([
      this.db.expense.count({ where: { companyId, ...branchFilter } }),
      this.db.ownerPayout.count({
        where: {
          companyId,
          ...branchFilter,
          status: {
            in: [
              PayoutStatus.APPROVED,
              PayoutStatus.QUEUED,
              PayoutStatus.PAID,
              PayoutStatus.RECONCILED,
            ],
          },
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

  private async salesReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
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
    return {
      maintenanceRequests: requests,
      workOrders,
      inspections,
      defects,
      highPriorityIssues: highPriority,
    };
  }

  private async financeReport(
    principal: AuthenticatedPrincipal,
    branchId?: string,
  ): Promise<ReportSection> {
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
    return {
      activeDevelopments,
      plots,
      outputProperties: outputs,
      saleReadyAssets: saleReady,
      totalCosts: costs._sum.amount?.toString() ?? '0',
      realizedSaleProceeds: proceeds._sum.companyProceeds?.toString() ?? '0',
    };
  }

  private normalizeSection(section: string): string {
    const normalized = section === 'full-management' ? 'fullManagement' : section;
    if (!REPORT_TITLES[normalized]) {
      throw new BadRequestException('Choose a supported report category.');
    }
    return normalized;
  }

  private dateRange(query: ReportExportQueryDto) {
    return {
      ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
      ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  async detailSection(
    principal: AuthenticatedPrincipal,
    rawSection: string,
    query: ReportExportQueryDto,
    limit = 500,
  ): Promise<DetailedReport> {
    const section = this.normalizeSection(rawSection);
    const companyId = principal.companyId;
    const dateRange = this.dateRange(query);
    const hasDateRange = Object.keys(dateRange).length > 0;
    const search = query.search?.trim();
    let columns: DetailedReport['columns'] = [];
    let rows: ReportRow[] = [];

    if (section === 'portfolio') {
      const authorized = this.auth.authorizedBranchIds(principal, 'portfolio.property.read');
      if (query.branchId)
        this.auth.assertBranchPermission(principal, 'portfolio.property.read', query.branchId);
      const records = await this.db.property.findMany({
        where: {
          companyId,
          ...(query.branchId
            ? { branchAssignments: { some: { branchId: query.branchId, effectiveTo: null } } }
            : authorized === null
              ? {}
              : {
                  branchAssignments: {
                    some: { branchId: { in: [...authorized] }, effectiveTo: null },
                  },
                }),
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { createdAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { propertyCode: { contains: search, mode: 'insensitive' as const } },
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { city: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          propertyCode: true,
          name: true,
          propertyType: true,
          serviceIntent: true,
          city: true,
          district: true,
          status: true,
          createdAt: true,
          _count: { select: { spaces: { where: { status: RentableSpaceStatus.ACTIVE } } } },
          branchAssignments: {
            where: { effectiveTo: null },
            take: 1,
            select: { branch: { select: { name: true } } },
          },
        },
      });
      columns = [
        { key: 'propertyCode', label: 'Property Code' },
        { key: 'property', label: 'Property' },
        { key: 'type', label: 'Type' },
        { key: 'service', label: 'Service / Business Area' },
        { key: 'branch', label: 'Branch' },
        { key: 'location', label: 'Location' },
        { key: 'activeUnits', label: 'Active Units' },
        { key: 'status', label: 'Status' },
        { key: 'addedOn', label: 'Added On' },
      ];
      rows = records.map((row) => ({
        propertyCode: row.propertyCode,
        property: row.name,
        type: row.propertyType,
        service: row.serviceIntent ?? '',
        branch: row.branchAssignments[0]?.branch.name ?? '',
        location: [row.city, row.district].filter(Boolean).join(', '),
        activeUnits: row._count.spaces,
        status: row.status,
        addedOn: dateText(row.createdAt),
      }));
    } else if (section === 'rental') {
      const branch = this.branchFilter(principal, 'lease.read', query.branchId);
      const records = await this.db.rentalAgreement.findMany({
        where: {
          companyId,
          ...branch,
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { createdAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { agreementNumber: { contains: search, mode: 'insensitive' as const } },
                  { customer: { displayName: { contains: search, mode: 'insensitive' as const } } },
                  { property: { name: { contains: search, mode: 'insensitive' as const } } },
                  { rentableSpace: { name: { contains: search, mode: 'insensitive' as const } } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          agreementNumber: true,
          customer: { select: { displayName: true } },
          property: { select: { propertyCode: true, name: true } },
          rentableSpace: { select: { spaceCode: true, name: true } },
          viewing: { select: { scheduledAt: true } },
          lease: { select: { leaseNumber: true, status: true } },
          finalRent: true,
          currency: true,
          status: true,
          leaseStartDate: true,
          leaseEndDate: true,
        },
      });
      columns = [
        { key: 'customer', label: 'Customer' },
        { key: 'property', label: 'Property' },
        { key: 'unit', label: 'Unit' },
        { key: 'viewing', label: 'Viewing' },
        { key: 'agreement', label: 'Agreement' },
        { key: 'lease', label: 'Lease' },
        { key: 'rent', label: 'Rent' },
        { key: 'status', label: 'Status' },
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
      ];
      rows = records.map((row) => ({
        customer: row.customer.displayName,
        property: `${row.property.propertyCode} — ${row.property.name}`,
        unit: `${row.rentableSpace.spaceCode} — ${row.rentableSpace.name}`,
        viewing: dateTimeText(row.viewing.scheduledAt),
        agreement: row.agreementNumber,
        lease: row.lease?.leaseNumber ?? '',
        rent: `${row.currency} ${row.finalRent.toString()}`,
        status: row.lease?.status ?? row.status,
        start: dateText(row.leaseStartDate),
        end: dateText(row.leaseEndDate),
      }));
    } else if (section === 'fullManagement') {
      const branch = this.branchFilter(principal, 'service-engagement.read', query.branchId);
      const records = await this.db.lease.findMany({
        where: {
          companyId,
          ...branch,
          serviceEngagement: { serviceModel: 'FULL_MANAGEMENT' },
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { createdAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { leaseNumber: { contains: search, mode: 'insensitive' as const } },
                  { rentableSpace: { name: { contains: search, mode: 'insensitive' as const } } },
                  {
                    rentableSpace: {
                      property: { name: { contains: search, mode: 'insensitive' as const } },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          leaseNumber: true,
          status: true,
          currency: true,
          rentAmount: true,
          rentableSpace: {
            select: {
              spaceCode: true,
              name: true,
              property: {
                select: {
                  propertyCode: true,
                  name: true,
                  ownerships: {
                    where: { effectiveTo: null },
                    take: 1,
                    select: { owner: { select: { displayName: true } } },
                  },
                },
              },
            },
          },
          parties: {
            where: { role: { in: ['TENANT', 'CO_TENANT'] } },
            take: 1,
            select: { party: { select: { displayName: true } } },
          },
          serviceEngagement: {
            select: { commercialTerms: { select: { managementFeePercent: true } } },
          },
          charges: {
            select: {
              allocations: {
                where: { reversedAt: null },
                select: { amount: true },
              },
            },
          },
          expenses: { select: { amount: true } },
        },
      });
      columns = [
        { key: 'owner', label: 'Owner' },
        { key: 'property', label: 'Property' },
        { key: 'unit', label: 'Unit' },
        { key: 'tenant', label: 'Tenant' },
        { key: 'lease', label: 'Lease' },
        { key: 'rent', label: 'Contract Rent' },
        { key: 'rentCollected', label: 'Rent Collected' },
        { key: 'managementFee', label: 'Management Fee' },
        { key: 'expenses', label: 'Expenses' },
        { key: 'ownerNet', label: 'Owner Net' },
        { key: 'status', label: 'Status' },
      ];
      rows = records.map((row) => {
        const collected = row.charges.reduce(
          (total, charge) =>
            total +
            charge.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0),
          0,
        );
        const expenses = row.expenses.reduce((total, expense) => total + Number(expense.amount), 0);
        const feePercent = Number(row.serviceEngagement.commercialTerms?.managementFeePercent ?? 0);
        const managementFee = collected * (feePercent / 100);
        return {
          owner: row.rentableSpace.property.ownerships[0]?.owner.displayName ?? '',
          property: `${row.rentableSpace.property.propertyCode} — ${row.rentableSpace.property.name}`,
          unit: `${row.rentableSpace.spaceCode} — ${row.rentableSpace.name}`,
          tenant: row.parties[0]?.party.displayName ?? '',
          lease: row.leaseNumber,
          rent: `${row.currency} ${row.rentAmount.toString()}`,
          rentCollected: `${row.currency} ${collected.toFixed(2)}`,
          managementFee: `${row.currency} ${managementFee.toFixed(2)}`,
          expenses: `${row.currency} ${expenses.toFixed(2)}`,
          ownerNet: `${row.currency} ${Math.max(0, collected - managementFee - expenses).toFixed(2)}`,
          status: row.status,
        };
      });
    } else if (section === 'sales') {
      const branch = this.branchFilter(principal, 'sale-offer.read', query.branchId);
      const records = await this.db.saleAgreement.findMany({
        where: {
          companyId,
          ...branch,
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { createdAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { agreementNumber: { contains: search, mode: 'insensitive' as const } },
                  { buyer: { displayName: { contains: search, mode: 'insensitive' as const } } },
                  { seller: { displayName: { contains: search, mode: 'insensitive' as const } } },
                  { property: { name: { contains: search, mode: 'insensitive' as const } } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          agreementNumber: true,
          buyer: { select: { displayName: true } },
          seller: { select: { displayName: true } },
          property: { select: { propertyCode: true, name: true } },
          originalAskingPrice: true,
          finalSalePrice: true,
          currency: true,
          sellerCommissionValue: true,
          buyerCommissionValue: true,
          status: true,
          saleOffer: {
            select: { settlement: { select: { settlementNumber: true, status: true } } },
          },
        },
      });
      columns = [
        { key: 'buyer', label: 'Buyer' },
        { key: 'seller', label: 'Seller' },
        { key: 'property', label: 'Property' },
        { key: 'agreement', label: 'Agreement' },
        { key: 'askingPrice', label: 'Asking Price' },
        { key: 'finalPrice', label: 'Final Price' },
        { key: 'commissions', label: 'Commission Terms' },
        { key: 'settlement', label: 'Settlement' },
        { key: 'status', label: 'Status' },
      ];
      rows = records.map((row) => ({
        buyer: row.buyer.displayName,
        seller: row.seller.displayName,
        property: `${row.property.propertyCode} — ${row.property.name}`,
        agreement: row.agreementNumber,
        askingPrice: `${row.currency} ${row.originalAskingPrice.toString()}`,
        finalPrice: `${row.currency} ${row.finalSalePrice.toString()}`,
        commissions: [row.sellerCommissionValue?.toString(), row.buyerCommissionValue?.toString()]
          .filter(Boolean)
          .join(' + '),
        settlement: row.saleOffer?.settlement?.settlementNumber ?? '',
        status: row.saleOffer?.settlement?.status ?? row.status,
      }));
    } else if (section === 'finance') {
      const branch = this.branchFilter(principal, 'invoice.read', query.branchId);
      const records = await this.db.payment.findMany({
        where: {
          companyId,
          ...branch,
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { receivedAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { paymentNumber: { contains: search, mode: 'insensitive' as const } },
                  { payer: { displayName: { contains: search, mode: 'insensitive' as const } } },
                  { externalRef: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: { receivedAt: 'desc' },
        take: limit,
        select: {
          paymentNumber: true,
          payer: { select: { displayName: true } },
          method: { select: { name: true } },
          amount: true,
          currency: true,
          status: true,
          receivedAt: true,
          externalRef: true,
          allocations: {
            where: { reversedAt: null },
            take: 1,
            select: {
              charge: {
                select: {
                  chargeType: { select: { name: true } },
                  property: { select: { propertyCode: true, name: true } },
                  rentableSpace: { select: { spaceCode: true, name: true } },
                },
              },
            },
          },
        },
      });
      columns = [
        { key: 'date', label: 'Date' },
        { key: 'paymentNumber', label: 'Payment Number' },
        { key: 'payer', label: 'Payer' },
        { key: 'businessSource', label: 'Business Source' },
        { key: 'property', label: 'Property / Unit' },
        { key: 'amount', label: 'Amount' },
        { key: 'method', label: 'Method' },
        { key: 'reference', label: 'Reference' },
        { key: 'status', label: 'Status' },
      ];
      rows = records.map((row) => {
        const charge = row.allocations[0]?.charge;
        return {
          date: dateTimeText(row.receivedAt),
          paymentNumber: row.paymentNumber,
          payer: row.payer.displayName,
          businessSource: charge?.chargeType.name ?? '',
          property: [
            charge?.property ? `${charge.property.propertyCode} — ${charge.property.name}` : '',
            charge?.rentableSpace
              ? `${charge.rentableSpace.spaceCode} — ${charge.rentableSpace.name}`
              : '',
          ]
            .filter(Boolean)
            .join(' / '),
          amount: `${row.currency} ${row.amount.toString()}`,
          method: row.method.name,
          reference: row.externalRef ?? '',
          status: row.status,
        };
      });
    } else if (section === 'operations') {
      const branch = this.branchFilter(principal, 'maintenance.read', query.branchId);
      const records = await this.db.viewing.findMany({
        where: {
          companyId,
          ...branch,
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { scheduledAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { lead: { displayName: { contains: search, mode: 'insensitive' as const } } },
                  { property: { name: { contains: search, mode: 'insensitive' as const } } },
                  { rentableSpace: { name: { contains: search, mode: 'insensitive' as const } } },
                ],
              }
            : {}),
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit,
        select: {
          scheduledAt: true,
          lead: { select: { leadNumber: true, displayName: true, intent: true } },
          property: { select: { propertyCode: true, name: true } },
          rentableSpace: { select: { spaceCode: true, name: true } },
          selectedRentableSpace: { select: { spaceCode: true, name: true } },
          assignedEmployee: {
            select: { employeeNumber: true, party: { select: { displayName: true } } },
          },
          status: true,
          outcome: true,
        },
      });
      columns = [
        { key: 'dateTime', label: 'Date / Time' },
        { key: 'customer', label: 'Customer / Buyer' },
        { key: 'type', label: 'Type' },
        { key: 'property', label: 'Property' },
        { key: 'unit', label: 'Selected Unit' },
        { key: 'agent', label: 'Agent' },
        { key: 'status', label: 'Status' },
        { key: 'outcome', label: 'Outcome' },
      ];
      rows = records.map((row) => {
        const unit = row.selectedRentableSpace ?? row.rentableSpace;
        return {
          dateTime: dateTimeText(row.scheduledAt),
          customer: `${row.lead.leadNumber} — ${row.lead.displayName}`,
          type: row.lead.intent,
          property: row.property ? `${row.property.propertyCode} — ${row.property.name}` : '',
          unit: unit ? `${unit.spaceCode} — ${unit.name}` : '',
          agent: `${row.assignedEmployee.employeeNumber} — ${row.assignedEmployee.party.displayName}`,
          status: row.status,
          outcome: row.outcome ?? '',
        };
      });
    } else {
      const branch = this.branchFilter(principal, 'development.read', query.branchId);
      const records = await this.db.developmentProject.findMany({
        where: {
          companyId,
          ...branch,
          ...(query.status ? { status: query.status as never } : {}),
          ...(hasDateRange ? { createdAt: dateRange } : {}),
          ...(search
            ? {
                OR: [
                  { projectNumber: { contains: search, mode: 'insensitive' as const } },
                  { name: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          projectNumber: true,
          name: true,
          developmentType: true,
          branch: { select: { name: true } },
          sourceProperty: { select: { propertyCode: true, name: true } },
          plannedStart: true,
          plannedCompletion: true,
          budgetAmount: true,
          currency: true,
          status: true,
          _count: { select: { plots: true, outputAssets: true } },
        },
      });
      columns = [
        { key: 'projectNumber', label: 'Project Number' },
        { key: 'project', label: 'Project' },
        { key: 'type', label: 'Type' },
        { key: 'sourceProperty', label: 'Source Property' },
        { key: 'branch', label: 'Branch' },
        { key: 'plots', label: 'Plots' },
        { key: 'outputs', label: 'Output Assets' },
        { key: 'budget', label: 'Estimated Budget' },
        { key: 'start', label: 'Start' },
        { key: 'expectedEnd', label: 'Expected End' },
        { key: 'status', label: 'Status' },
      ];
      rows = records.map((row) => ({
        projectNumber: row.projectNumber,
        project: row.name,
        type: row.developmentType,
        sourceProperty: row.sourceProperty
          ? `${row.sourceProperty.propertyCode} — ${row.sourceProperty.name}`
          : '',
        branch: row.branch.name,
        plots: row._count.plots,
        outputs: row._count.outputAssets,
        budget: row.budgetAmount ? `${row.currency} ${row.budgetAmount.toString()}` : '',
        start: dateText(row.plannedStart),
        expectedEnd: dateText(row.plannedCompletion),
        status: row.status,
      }));
    }

    return {
      section,
      title: REPORT_TITLES[section]!,
      columns,
      rows,
      generatedAt: new Date().toISOString(),
    };
  }

  async exportSection(
    principal: AuthenticatedPrincipal,
    section: string,
    query: ReportExportQueryDto,
  ) {
    const report = await this.detailSection(principal, section, query, 5_000);
    const stamp = new Date().toISOString().slice(0, 10);
    if (query.format === 'csv') {
      const escape = (value: ReportCell) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const csv = [
        report.columns.map((column) => escape(column.label)).join(','),
        ...report.rows.map((row) =>
          report.columns.map((column) => escape(row[column.key] ?? '')).join(','),
        ),
      ].join('\r\n');
      return {
        body: Buffer.from(`\uFEFF${csv}`, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        fileName: `${report.section}-report-${stamp}.csv`,
      };
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Real Estate Operations Platform';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(report.title.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { defaultRowHeight: 20 },
    });
    sheet.columns = report.columns.map((column) => ({
      header: column.label,
      key: column.key,
      width: Math.min(42, Math.max(14, column.label.length + 4)),
    }));
    for (const row of report.rows) sheet.addRow(row);
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF215E61' } };
    header.alignment = { vertical: 'middle' };
    header.height = 24;
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(report.columns.length).letter}1` };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F8F7' } };
      }
      row.alignment = { vertical: 'top', wrapText: true };
    });
    const body = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      body,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${report.section}-report-${stamp}.xlsx`,
    };
  }
}
