import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cursorPage } from '../common/cursor-pagination';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CursorPageQueryDto } from '../common/cursor-pagination';

@Injectable()
export class FinanceSelectorsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  async chargeTypes(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    this.auth.assertCompanyPermission(principal, 'billing.read');
    const where: Prisma.ChargeTypeWhereInput = {
      companyId: principal.companyId,
      active: true,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.chargeType.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async paymentMethods(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    this.auth.assertCompanyPermission(principal, 'payment.read');
    const where: Prisma.PaymentMethodWhereInput = {
      companyId: principal.companyId,
      active: true,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.paymentMethod.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async accounts(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    this.auth.assertCompanyPermission(principal, 'journal.read');
    return this.listPostingAccounts(principal, query);
  }

  async receivingAccounts(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    this.auth.assertCompanyPermission(principal, 'payment.read');
    const where: Prisma.AccountWhereInput = {
      companyId: principal.companyId,
      active: true,
      postingAllowed: true,
      accountType: 'ASSET',
      code: { in: ['1010', '1020', '1030'] },
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.account.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, accountType: true, normalBalance: true },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  private async listPostingAccounts(principal: AuthenticatedPrincipal, query: CursorPageQueryDto) {
    const where: Prisma.AccountWhereInput = {
      companyId: principal.companyId,
      active: true,
      postingAllowed: true,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.account.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, accountType: true, normalBalance: true },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  expenseCategories() {
    return {
      items: [
        { code: 'MAINTENANCE', name: 'Maintenance' },
        { code: 'UTILITIES', name: 'Utilities' },
        { code: 'VENDOR', name: 'Vendor costs' },
        { code: 'MARKETING', name: 'Marketing' },
        { code: 'OFFICE', name: 'Office' },
        { code: 'PAYROLL', name: 'Payroll' },
        { code: 'BANK_CHARGES', name: 'Bank charges' },
        { code: 'OTHER', name: 'Other' },
      ],
    };
  }
}
