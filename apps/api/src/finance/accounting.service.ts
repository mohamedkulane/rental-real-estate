import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalStatus, PeriodStatus, Prisma } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import {
  assertBalancedJournal,
  assertJournalDraft,
  assertJournalPosted,
} from './finance.policy';
import type { CreateJournalDto, JournalQueryDto, ReverseJournalDto } from './finance.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

@Injectable()
export class AccountingService {
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

  private assertJournalScope(
    principal: AuthenticatedPrincipal,
    permission: string,
    branchId: string | null,
  ) {
    if (branchId) {
      this.auth.assertBranchPermission(principal, permission, branchId);
      return;
    }
    this.auth.assertCompanyPermission(principal, permission);
  }

  private async openPeriod(companyId: string, businessDate: Date) {
    const period = await this.db.accountingPeriod.findFirst({
      where: {
        status: PeriodStatus.OPEN,
        startsOn: { lte: businessDate },
        endsOn: { gte: businessDate },
        fiscalYear: { companyId },
      },
      orderBy: [{ startsOn: 'desc' }],
    });
    if (!period) {
      throw new ConflictException('No open accounting period covers the business date.');
    }
    return period;
  }

  async list(principal: AuthenticatedPrincipal, query: JournalQueryDto) {
    const branchIds = this.branches(principal, 'journal.read', query.branchId);
    const where: Prisma.JournalEntryWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { journalNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.journalEntry.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(principal: AuthenticatedPrincipal, input: CreateJournalDto, correlationId?: string) {
    const businessDate = isoDate(input.businessDate);
    const period = await this.openPeriod(principal.companyId, businessDate);
    this.assertJournalScope(principal, 'journal.manage', input.branchId ?? null);
    assertBalancedJournal(input.lines);
    const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
    const accounts = await this.db.account.findMany({
      where: { id: { in: accountIds }, companyId: principal.companyId, active: true, postingAllowed: true },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new ConflictException('One or more accounts are unavailable for posting.');
    }
    return this.db.$transaction(async (tx) => {
      const journal = await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId ?? null,
          journalNumber: await nextRecordNumber(tx, 'JOURNAL'),
          periodId: period.id,
          businessDate,
          status: JournalStatus.DRAFT,
          currency: input.currency.toUpperCase(),
          description: input.description.trim(),
          lines: {
            create: input.lines.map((line, index) => ({
              id: uuidv7(),
              lineNo: index + 1,
              accountId: line.accountId,
              signedAmount: new Prisma.Decimal(line.signedAmount),
              branchId: line.branchId ?? input.branchId ?? null,
              propertyId: line.propertyId ?? null,
              rentableSpaceId: line.rentableSpaceId ?? null,
              ownerPartyId: line.ownerPartyId ?? null,
              tenantPartyId: line.tenantPartyId ?? null,
              leaseId: line.leaseId ?? null,
              vendorPartyId: line.vendorPartyId ?? null,
              serviceEngagementId: line.serviceEngagementId ?? null,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'journal.created',
        entityType: 'JournalEntry',
        entityId: journal.id,
        branchId: journal.branchId,
        correlationId,
        after: { journalNumber: journal.journalNumber, lineCount: journal.lines.length },
      });
      return journal;
    });
  }

  async post(principal: AuthenticatedPrincipal, journalId: string, correlationId?: string) {
    const current = await this.db.journalEntry.findFirst({
      where: { id: journalId, companyId: principal.companyId },
      include: { lines: true },
    });
    if (!current) throw new NotFoundException('Journal entry not found.');
    this.assertJournalScope(principal, 'journal.manage', current.branchId);
    assertJournalDraft(current.status);
    assertBalancedJournal(current.lines);
    return this.db.$transaction(async (tx) => {
      const row = await tx.journalEntry.update({
        where: { id: journalId },
        data: { status: JournalStatus.POSTED, postedAt: new Date() },
        include: { lines: true },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'journal.posted',
        entityType: 'JournalEntry',
        entityId: journalId,
        branchId: current.branchId,
        correlationId,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async reverse(
    principal: AuthenticatedPrincipal,
    journalId: string,
    input: ReverseJournalDto,
    correlationId?: string,
  ) {
    const original = await this.db.journalEntry.findFirst({
      where: { id: journalId, companyId: principal.companyId },
      include: { lines: true, reversals: true },
    });
    if (!original) throw new NotFoundException('Journal entry not found.');
    this.assertJournalScope(principal, 'journal.manage', original.branchId);
    assertJournalPosted(original.status);
    if (original.reversals.length) {
      throw new ConflictException('This journal entry has already been reversed.');
    }
    const businessDate = input.businessDate ? isoDate(input.businessDate) : original.businessDate;
    const period = await this.openPeriod(principal.companyId, businessDate);
    return this.db.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: original.branchId,
          journalNumber: await nextRecordNumber(tx, 'JOURNAL'),
          periodId: period.id,
          businessDate,
          status: JournalStatus.POSTED,
          postedAt: new Date(),
          currency: original.currency,
          description: `Reversal of ${original.journalNumber}: ${input.reason.trim()}`,
          reversalOfId: original.id,
          lines: {
            create: original.lines.map((line) => ({
              id: uuidv7(),
              lineNo: line.lineNo,
              accountId: line.accountId,
              signedAmount: line.signedAmount.negated(),
              branchId: line.branchId,
              propertyId: line.propertyId,
              rentableSpaceId: line.rentableSpaceId,
              ownerPartyId: line.ownerPartyId,
              tenantPartyId: line.tenantPartyId,
              leaseId: line.leaseId,
              vendorPartyId: line.vendorPartyId,
              serviceEngagementId: line.serviceEngagementId,
            })),
          },
        },
        include: { lines: true },
      });
      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: JournalStatus.REVERSED },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'journal.reversed',
        entityType: 'JournalEntry',
        entityId: reversal.id,
        branchId: original.branchId,
        correlationId,
        reason: input.reason,
        before: { originalJournalId: original.id, originalStatus: original.status },
        after: { reversalJournalId: reversal.id, reversalNumber: reversal.journalNumber },
      });
      return reversal;
    });
  }

  async get(principal: AuthenticatedPrincipal, journalId: string) {
    const journal = await this.db.journalEntry.findFirst({
      where: { id: journalId, companyId: principal.companyId },
      include: { lines: true, reversalOf: true, reversals: true },
    });
    if (!journal) throw new NotFoundException('Journal entry not found.');
    this.assertJournalScope(principal, 'journal.read', journal.branchId);
    return journal;
  }
}
