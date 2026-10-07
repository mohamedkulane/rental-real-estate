import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { createTextPdf } from './simple-pdf';

type GeneratedPdf = { body: Buffer; fileName: string };
const date = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : 'Open-ended';
const money = (currency: string, value: { toString(): string } | number) =>
  `${currency} ${Number(value.toString()).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const safeFile = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase();

@Injectable()
export class GeneratedDocumentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  async lease(principal: AuthenticatedPrincipal, id: string): Promise<GeneratedPdf> {
    const row = await this.db.lease.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        company: { select: { name: true, legalName: true } },
        branch: { select: { name: true } },
        rentableSpace: {
          select: {
            spaceCode: true,
            name: true,
            property: {
              select: { propertyCode: true, name: true, addressLine1: true, city: true },
            },
          },
        },
        parties: { include: { party: { select: { displayName: true, partyNumber: true } } } },
        versions: {
          orderBy: { sequence: 'desc' },
          take: 1,
          select: { sequence: true, signedAt: true, signatureHash: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Lease not found.');
    this.auth.assertBranchPermission(principal, 'lease.read', row.branchId);
    const parties = row.parties.map(
      (item) => `${item.role}: ${item.party.displayName} (${item.party.partyNumber})`,
    );
    return {
      fileName: `lease-${safeFile(row.leaseNumber)}.pdf`,
      body: createTextPdf(
        'Rental Lease Agreement',
        [
          row.company.legalName ?? row.company.name,
          `Lease: ${row.leaseNumber} | Status: ${row.status} | Branch: ${row.branch.name}`,
          `Property: ${row.rentableSpace.property.propertyCode} - ${row.rentableSpace.property.name}`,
          `Unit: ${row.rentableSpace.spaceCode} - ${row.rentableSpace.name}`,
          `Address: ${row.rentableSpace.property.addressLine1 ?? ''} ${row.rentableSpace.property.city}`.trim(),
          `Term: ${date(row.leaseStartDate)} to ${date(row.leaseEndDate)}`,
          `Rent: ${money(row.currency, row.rentAmount)}`,
          ...parties,
          `Document version: ${row.versions[0]?.sequence ?? 1}`,
          row.versions[0]?.signedAt
            ? `Signed: ${date(row.versions[0].signedAt)}`
            : 'Signature: Pending',
          row.versions[0]?.signatureHash
            ? `Signature reference: ${row.versions[0].signatureHash}`
            : '',
          `Generated from canonical system data on ${new Date().toISOString()}.`,
        ].filter(Boolean),
      ),
    };
  }

  async saleAgreement(principal: AuthenticatedPrincipal, id: string): Promise<GeneratedPdf> {
    const row = await this.db.saleAgreement.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        company: { select: { name: true, legalName: true } },
        branch: { select: { name: true } },
        property: { select: { propertyCode: true, name: true, addressLine1: true, city: true } },
        seller: { select: { displayName: true, partyNumber: true } },
        buyer: { select: { displayName: true, partyNumber: true } },
      },
    });
    if (!row) throw new NotFoundException('Sale Agreement not found.');
    this.auth.assertBranchPermission(principal, 'sale-offer.read', row.branchId);
    return {
      fileName: `sale-agreement-${safeFile(row.agreementNumber)}.pdf`,
      body: createTextPdf(
        'Property Sale Agreement',
        [
          row.company.legalName ?? row.company.name,
          `Agreement: ${row.agreementNumber} | Status: ${row.status} | Branch: ${row.branch.name}`,
          `Property: ${row.property.propertyCode} - ${row.property.name}`,
          `Address: ${row.property.addressLine1 ?? ''} ${row.property.city}`.trim(),
          `Seller: ${row.seller.displayName} (${row.seller.partyNumber})`,
          `Buyer: ${row.buyer.displayName} (${row.buyer.partyNumber})`,
          `Original asking price: ${money(row.currency, row.originalAskingPrice)}`,
          `Final sale price: ${money(row.currency, row.finalSalePrice)}`,
          `Confirmed: ${date(row.confirmedAt)}`,
          row.notes ? `Notes: ${row.notes}` : '',
          `Generated from canonical system data on ${new Date().toISOString()}.`,
        ].filter(Boolean),
      ),
    };
  }

  async paymentReceipt(principal: AuthenticatedPrincipal, id: string): Promise<GeneratedPdf> {
    const row = await this.db.payment.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        company: { select: { name: true, legalName: true } },
        branch: { select: { name: true } },
        payer: { select: { displayName: true, partyNumber: true } },
        method: { select: { name: true } },
        receipt: true,
        allocations: {
          where: { reversedAt: null },
          include: { charge: { select: { chargeNumber: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('Payment not found.');
    this.auth.assertBranchPermission(principal, 'payment.read', row.branchId);
    const receiptNumber = row.receipt?.receiptNumber ?? row.paymentNumber;
    return {
      fileName: `receipt-${safeFile(receiptNumber)}.pdf`,
      body: createTextPdf(
        'Payment Receipt',
        [
          row.company.legalName ?? row.company.name,
          `Receipt: ${receiptNumber} | Payment: ${row.paymentNumber}`,
          `Status: ${row.status} | Branch: ${row.branch.name}`,
          `Received from: ${row.payer.displayName} (${row.payer.partyNumber})`,
          `Amount: ${money(row.currency, row.amount)}`,
          `Payment method: ${row.method.name}`,
          `Received: ${row.receivedAt.toISOString()}`,
          row.externalRef ? `External reference: ${row.externalRef}` : '',
          ...row.allocations.map(
            (item) =>
              `Allocated to ${item.charge.chargeNumber}: ${money(row.currency, item.amount)}`,
          ),
          row.notes ? `Notes: ${row.notes}` : '',
          `Generated from canonical system data on ${new Date().toISOString()}.`,
        ].filter(Boolean),
      ),
    };
  }

  async ownerStatement(principal: AuthenticatedPrincipal, id: string): Promise<GeneratedPdf> {
    const row = await this.db.ownerStatement.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        company: { select: { name: true, legalName: true } },
        branch: { select: { name: true } },
        owner: { select: { displayName: true, partyNumber: true } },
        property: { select: { propertyCode: true, name: true } },
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Owner statement not found.');
    this.auth.assertBranchPermission(principal, 'owner-statement.read', row.branchId);
    return {
      fileName: `owner-statement-${safeFile(row.statementNumber)}.pdf`,
      body: createTextPdf('Owner Statement', [
        row.company.legalName ?? row.company.name,
        `Statement: ${row.statementNumber} | Status: ${row.status} | Branch: ${row.branch.name}`,
        `Owner: ${row.owner.displayName} (${row.owner.partyNumber})`,
        row.property
          ? `Property: ${row.property.propertyCode} - ${row.property.name}`
          : 'Property: All eligible owned properties',
        `Period: ${date(row.periodStart)} to ${date(row.periodEnd)}`,
        ...row.lines.map((line) => `${line.description}: ${money(row.currency, line.amount)}`),
        `Calculation reference: ${row.calculationHash}`,
        `Generated from canonical system data on ${new Date().toISOString()}.`,
      ]),
    };
  }
}
