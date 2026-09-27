import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChargeStatus, PaymentStatus, Prisma, ReceiptStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { assertManualPaymentOnly, replayIdempotentRecord } from './finance.policy';
import type {
  AllocatePaymentDto,
  CreatePaymentDto,
  PaymentQueryDto,
  ReversePaymentDto,
} from './finance.dto';

const isoInstant = (value: string): Date => new Date(value);

@Injectable()
export class PaymentService {
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

  async list(principal: AuthenticatedPrincipal, query: PaymentQueryDto) {
    const branchIds = this.branches(principal, 'payment.read', query.branchId);
    const where: Prisma.PaymentWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.payerPartyId ? { payerPartyId: query.payerPartyId } : {}),
      ...(query.search
        ? { paymentNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.payment.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      include: {
        payer: { select: { displayName: true } },
        method: { select: { name: true } },
        allocations: { include: { charge: { select: { chargeNumber: true } } } },
        receipt: true,
      },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(principal: AuthenticatedPrincipal, input: CreatePaymentDto, correlationId?: string) {
    assertManualPaymentOnly(input.autoCapture);
    this.auth.assertBranchPermission(principal, 'payment.create', input.branchId);
    const contextualCharge = input.chargeId
      ? await this.db.charge.findFirst({
          where: {
            id: input.chargeId,
            companyId: principal.companyId,
            branchId: input.branchId,
            status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
          },
          include: { chargeType: { select: { code: true } } },
        })
      : null;
    if (input.chargeId && !contextualCharge) {
      throw new ConflictException('The selected receivable is unavailable or already paid.');
    }
    if (contextualCharge && contextualCharge.debtorPartyId !== input.payerPartyId) {
      throw new ConflictException('The payer must match the receivable debtor.');
    }
    const payer = await this.db.party.findFirst({
      where: { id: input.payerPartyId, companyId: principal.companyId },
      select: { id: true },
    });
    if (!payer) throw new ConflictException('Payer party is unavailable.');
    const method = await this.db.paymentMethod.findFirst({
      where: { id: input.methodId, companyId: principal.companyId, active: true },
      select: { id: true, code: true, receivingAccountId: true },
    });
    if (!method) throw new ConflictException('Payment method is unavailable.');
    const receivingAccountId = method.receivingAccountId;
    if (!receivingAccountId) {
      throw new ConflictException('This payment method has no configured receiving account.');
    }
    const account = await this.db.account.findFirst({
      where: {
        id: receivingAccountId,
        companyId: principal.companyId,
        active: true,
        postingAllowed: true,
        accountType: 'ASSET',
        code: { in: ['1010', '1020', '1030'] },
      },
      select: { id: true },
    });
    if (!account) {
      throw new ConflictException(
        'Receiving account must be Cash on Hand, Bank, or Mobile Money.',
      );
    }
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Payment amount must be positive.');
    if (contextualCharge && contextualCharge.currency !== input.currency.toUpperCase()) {
      throw new ConflictException('Payment currency must match the receivable currency.');
    }
    if (contextualCharge && amount.gt(contextualCharge.outstandingAmount)) {
      throw new BadRequestException('Payment amount cannot exceed the outstanding balance.');
    }
    if (!contextualCharge && input.purpose && input.purpose !== 'GENERAL') {
      throw new BadRequestException('Commission payments must start from a commission receivable.');
    }
    try {
      return await this.db.$transaction(async (tx) => {
        if (input.idempotencyKey) {
          const existing = replayIdempotentRecord(
            await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } }),
            principal.companyId,
          );
          if (existing) return existing;
        }

        const payment = await tx.payment.create({
          data: {
            id: uuidv7(),
            companyId: principal.companyId,
            branchId: input.branchId,
            paymentNumber: await nextRecordNumber(tx, 'PAYMENT'),
            payerPartyId: input.payerPartyId,
            methodId: input.methodId,
            receivingAccountId,
            currency: input.currency.toUpperCase(),
            amount,
            verifiedAmount: amount,
            status: contextualCharge
              ? PaymentStatus.FULLY_ALLOCATED
              : PaymentStatus.CAPTURED,
            externalRef: input.externalRef?.trim() || null,
            idempotencyKey: input.idempotencyKey ?? null,
            receivedAt: isoInstant(input.receivedAt),
            notes: input.notes?.trim() || null,
            receivedByUserId: principal.userId,
            postedAt: contextualCharge ? new Date() : null,
          },
        });

        if (contextualCharge) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM charges WHERE id = ${contextualCharge.id}::uuid FOR UPDATE`,
          );
          const lockedCharge = await tx.charge.findFirst({
            where: {
              id: contextualCharge.id,
              companyId: principal.companyId,
              branchId: input.branchId,
              debtorPartyId: input.payerPartyId,
              currency: input.currency.toUpperCase(),
              status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
            },
          });
          if (!lockedCharge || amount.gt(lockedCharge.outstandingAmount)) {
            throw new ConflictException('The receivable balance changed. Refresh and try again.');
          }
          await tx.paymentAllocation.create({
            data: {
              id: uuidv7(),
              paymentId: payment.id,
              chargeId: lockedCharge.id,
              amount,
              allocatedAt: new Date(),
            },
          });
          const outstanding = lockedCharge.outstandingAmount.minus(amount);
          await tx.charge.update({
            where: { id: lockedCharge.id },
            data: {
              outstandingAmount: outstanding,
              status: outstanding.isZero() ? ChargeStatus.PAID : ChargeStatus.PARTIALLY_PAID,
            },
          });
        }

        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'payment.captured',
          entityType: 'Payment',
          entityId: payment.id,
          branchId: payment.branchId,
          correlationId,
          after: {
            paymentNumber: payment.paymentNumber,
            amount: payment.amount.toString(),
            chargeId: contextualCharge?.id ?? null,
            paymentMethod: method.code,
          },
        });
        return payment;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (input.idempotencyKey) {
          const existing = replayIdempotentRecord(
            await this.db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } }),
            principal.companyId,
          );
          if (existing) return existing;
        }
        throw new ConflictException('Payment idempotency conflict.');
      }
      throw error;
    }
  }

  async reverse(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    input: ReversePaymentDto,
    correlationId?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM payments WHERE id = ${paymentId}::uuid AND "companyId" = ${principal.companyId}::uuid FOR UPDATE`,
      );
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, companyId: principal.companyId },
        include: { allocations: { where: { reversedAt: null }, include: { charge: true } }, receipt: true },
      });
      if (!payment) throw new NotFoundException('Payment not found.');
      this.auth.assertBranchPermission(principal, 'payment.allocate', payment.branchId);
      if (payment.status === PaymentStatus.REVERSED) {
        throw new ConflictException('This payment has already been reversed.');
      }
      const now = new Date();
      for (const allocation of payment.allocations) {
        const outstanding = allocation.charge.outstandingAmount.plus(allocation.amount);
        await tx.charge.update({
          where: { id: allocation.chargeId },
          data: {
            outstandingAmount: outstanding,
            status: outstanding.gte(allocation.charge.originalAmount)
              ? ChargeStatus.OPEN
              : ChargeStatus.PARTIALLY_PAID,
          },
        });
        await tx.paymentAllocation.update({
          where: { id: allocation.id },
          data: { reversedAt: now },
        });
      }
      if (payment.receipt) {
        await tx.receipt.update({ where: { id: payment.receipt.id }, data: { status: ReceiptStatus.VOIDED } });
      }
      const reversed = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REVERSED },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'payment.reversed',
        entityType: 'Payment',
        entityId: payment.id,
        branchId: payment.branchId,
        correlationId,
        reason: input.reason,
        before: { status: payment.status },
        after: { status: PaymentStatus.REVERSED, restoredAllocations: payment.allocations.length },
      });
      return reversed;
    });
  }

  async allocate(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    input: AllocatePaymentDto,
    correlationId?: string,
  ) {
    const requested = input.allocations.reduce(
      (sum, row) => sum.plus(new Prisma.Decimal(row.amount)),
      new Prisma.Decimal(0),
    );
    const chargeIds = [...new Set(input.allocations.map((row) => row.chargeId))];
    if (chargeIds.length !== input.allocations.length) {
      throw new BadRequestException('Each allocation line must target a distinct charge.');
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM payments WHERE id = ${paymentId}::uuid AND "companyId" = ${principal.companyId}::uuid FOR UPDATE`,
      );
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, companyId: principal.companyId },
        include: { allocations: { where: { reversedAt: null } } },
      });
      if (!payment) throw new NotFoundException('Payment not found.');
      this.auth.assertBranchPermission(principal, 'payment.allocate', payment.branchId);
      if (payment.status === PaymentStatus.REVERSED) {
        throw new ConflictException('Reversed payments cannot be allocated.');
      }
      const allocated = payment.allocations.reduce(
        (sum, row) => sum.plus(row.amount),
        new Prisma.Decimal(0),
      );
      if (allocated.plus(requested).gt(payment.amount)) {
        throw new BadRequestException('Allocation exceeds the payment amount.');
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM charges WHERE "companyId" = ${principal.companyId}::uuid AND id IN (${Prisma.join(
          chargeIds.map((id) => Prisma.sql`${id}::uuid`),
        )}) FOR UPDATE`,
      );
      const charges = await tx.charge.findMany({
        where: {
          id: { in: chargeIds },
          companyId: principal.companyId,
          branchId: payment.branchId,
          currency: payment.currency,
          status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        },
      });
      if (charges.length !== chargeIds.length) {
        throw new ConflictException('One or more charges are unavailable for allocation.');
      }
      const chargeMap = new Map(charges.map((row) => [row.id, row]));
      for (const line of input.allocations) {
        const charge = chargeMap.get(line.chargeId)!;
        const amount = new Prisma.Decimal(line.amount);
        if (amount.lte(0)) {
          throw new BadRequestException('Allocation amounts must be positive.');
        }
        if (amount.gt(charge.outstandingAmount)) {
          throw new BadRequestException(`Allocation exceeds outstanding amount for ${charge.chargeNumber}.`);
        }
      }
      const now = new Date();
      for (const line of input.allocations) {
        const charge = chargeMap.get(line.chargeId)!;
        const amount = new Prisma.Decimal(line.amount);
        await tx.paymentAllocation.create({
          data: {
            id: uuidv7(),
            paymentId,
            chargeId: line.chargeId,
            amount,
            allocatedAt: now,
          },
        });
        const outstanding = charge.outstandingAmount.minus(amount);
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            outstandingAmount: outstanding,
            status: outstanding.isZero()
              ? ChargeStatus.PAID
              : ChargeStatus.PARTIALLY_PAID,
          },
        });
      }
      const totalAllocated = allocated.plus(requested);
      const status = totalAllocated.gte(payment.amount)
        ? PaymentStatus.FULLY_ALLOCATED
        : PaymentStatus.PARTIALLY_ALLOCATED;
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status, postedAt: now },
        include: { allocations: true },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'payment.allocated',
        entityType: 'Payment',
        entityId: paymentId,
        branchId: payment.branchId,
        correlationId,
        after: { status, allocationCount: input.allocations.length },
      });
      return updated;
    });
  }

  async issueReceipt(principal: AuthenticatedPrincipal, paymentId: string, correlationId?: string) {
    const payment = await this.db.payment.findFirst({
      where: { id: paymentId, companyId: principal.companyId },
      include: { receipt: true },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    this.auth.assertBranchPermission(principal, 'payment.create', payment.branchId);
    if (payment.receipt) return payment.receipt;
    return this.db.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: payment.branchId,
          receiptNumber: await nextRecordNumber(tx, 'RECEIPT'),
          paymentId: payment.id,
          payerPartyId: payment.payerPartyId,
          currency: payment.currency,
          amount: payment.amount,
          issuedAt: new Date(),
          status: ReceiptStatus.ISSUED,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'receipt.issued',
        entityType: 'Receipt',
        entityId: receipt.id,
        branchId: payment.branchId,
        correlationId,
        after: { paymentId, receiptNumber: receipt.receiptNumber },
      });
      return receipt;
    });
  }

  async get(principal: AuthenticatedPrincipal, paymentId: string) {
    const payment = await this.db.payment.findFirst({
      where: { id: paymentId, companyId: principal.companyId },
      include: {
        payer: { select: { displayName: true, partyNumber: true } },
        method: { select: { code: true, name: true } },
        receivingAccount: { select: { code: true, name: true } },
        allocations: { include: { charge: { select: { chargeNumber: true, outstandingAmount: true, currency: true } } } },
        receipt: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    this.auth.assertBranchPermission(principal, 'payment.read', payment.branchId);
    return payment;
  }
}
