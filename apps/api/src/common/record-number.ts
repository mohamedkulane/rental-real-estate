import { Prisma } from '@prisma/client';

export type RecordNumberKind =
  | 'BRANCH' | 'EMPLOYEE' | 'PARTY' | 'OWNER' | 'PROPERTY' | 'BUILDING' | 'SPACE'
  | 'ENGAGEMENT' | 'RENTAL_LISTING' | 'SALE_LISTING' | 'APPLICATION'
  | 'RESERVATION' | 'TENANT' | 'LEASE'
  | 'CHARGE' | 'INVOICE' | 'PAYMENT' | 'RECEIPT' | 'EXPENSE' | 'PAYOUT'
  | 'STATEMENT' | 'JOURNAL' | 'BROKERAGE_DEAL' | 'SALE_OFFER' | 'SALE_SETTLEMENT'
  | 'MAINTENANCE_REQUEST' | 'WORK_ORDER' | 'INSPECTION' | 'DEFECT'
  | 'CONSTRUCTION_PROJECT' | 'CONSTRUCTION_CONTRACT' | 'DEVELOPMENT_PROJECT';

const definitions: Record<RecordNumberKind, { prefix: string; sequence: string; width: number }> = {
  BRANCH: { prefix: 'BR', sequence: 'public.branch_record_number_seq', width: 3 },
  EMPLOYEE: { prefix: 'EMP', sequence: 'public.employee_record_number_seq', width: 4 },
  PARTY: { prefix: 'PTY', sequence: 'public.party_record_number_seq', width: 4 },
  OWNER: { prefix: 'OWN', sequence: 'public.owner_record_number_seq', width: 4 },
  PROPERTY: { prefix: 'PROP', sequence: 'public.property_record_number_seq', width: 4 },
  BUILDING: { prefix: 'BLD', sequence: 'public.building_record_number_seq', width: 4 },
  SPACE: { prefix: 'SPC', sequence: 'public.space_record_number_seq', width: 4 },
  ENGAGEMENT: {
    prefix: 'ENG',
    sequence: 'public.service_engagement_record_number_seq',
    width: 6,
  },
  RENTAL_LISTING: { prefix: 'RL', sequence: 'public.rental_listing_record_number_seq', width: 6 },
  SALE_LISTING: { prefix: 'SL', sequence: 'public.sale_listing_record_number_seq', width: 6 },
  APPLICATION: { prefix: 'APP', sequence: 'public.application_record_number_seq', width: 6 },
  RESERVATION: { prefix: 'RSV', sequence: 'public.reservation_record_number_seq', width: 6 },
  TENANT: { prefix: 'TEN', sequence: 'public.tenant_record_number_seq', width: 6 },
  LEASE: { prefix: 'LSE', sequence: 'public.lease_record_number_seq', width: 6 },
  CHARGE: { prefix: 'CHG', sequence: 'public.charge_record_number_seq', width: 6 },
  INVOICE: { prefix: 'INV', sequence: 'public.invoice_record_number_seq', width: 6 },
  PAYMENT: { prefix: 'PAY', sequence: 'public.payment_record_number_seq', width: 6 },
  RECEIPT: { prefix: 'RCT', sequence: 'public.receipt_record_number_seq', width: 6 },
  EXPENSE: { prefix: 'EXP', sequence: 'public.expense_record_number_seq', width: 6 },
  PAYOUT: { prefix: 'PO', sequence: 'public.payout_record_number_seq', width: 6 },
  STATEMENT: { prefix: 'OST', sequence: 'public.owner_statement_record_number_seq', width: 6 },
  JOURNAL: { prefix: 'JRN', sequence: 'public.journal_record_number_seq', width: 6 },
  BROKERAGE_DEAL: { prefix: 'BD', sequence: 'public.brokerage_deal_record_number_seq', width: 6 },
  SALE_OFFER: { prefix: 'SO', sequence: 'public.sale_offer_record_number_seq', width: 6 },
  SALE_SETTLEMENT: { prefix: 'SS', sequence: 'public.sale_settlement_record_number_seq', width: 6 },
  MAINTENANCE_REQUEST: { prefix: 'MR', sequence: 'public.maintenance_request_record_number_seq', width: 6 },
  WORK_ORDER: { prefix: 'WO', sequence: 'public.work_order_record_number_seq', width: 6 },
  INSPECTION: { prefix: 'INSP', sequence: 'public.inspection_record_number_seq', width: 6 },
  DEFECT: { prefix: 'DEF', sequence: 'public.defect_issue_record_number_seq', width: 6 },
  CONSTRUCTION_PROJECT: { prefix: 'CP', sequence: 'public.construction_project_record_number_seq', width: 6 },
  CONSTRUCTION_CONTRACT: { prefix: 'CC', sequence: 'public.construction_contract_record_number_seq', width: 6 },
  DEVELOPMENT_PROJECT: { prefix: 'DP', sequence: 'public.development_project_record_number_seq', width: 6 },
};

export async function nextRecordNumber(
  transaction: Prisma.TransactionClient,
  kind: RecordNumberKind,
): Promise<string> {
  const definition = definitions[kind];
  const [row] = await transaction.$queryRaw<Array<{ value: bigint }>>(
    Prisma.sql`SELECT nextval(${definition.sequence}::regclass) AS value`,
  );
  if (!row) throw new Error(`Unable to generate ${kind.toLowerCase()} record number.`);
  return `${definition.prefix}-${row.value.toString().padStart(definition.width, '0')}`;
}
