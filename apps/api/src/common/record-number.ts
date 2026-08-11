import { Prisma } from '@prisma/client';

export type RecordNumberKind = 'BRANCH' | 'EMPLOYEE' | 'PARTY' | 'OWNER' | 'PROPERTY' | 'SPACE';

const definitions: Record<RecordNumberKind, { prefix: string; sequence: string; width: number }> = {
  BRANCH: { prefix: 'BR', sequence: 'public.branch_record_number_seq', width: 3 },
  EMPLOYEE: { prefix: 'EMP', sequence: 'public.employee_record_number_seq', width: 4 },
  PARTY: { prefix: 'PTY', sequence: 'public.party_record_number_seq', width: 4 },
  OWNER: { prefix: 'OWN', sequence: 'public.owner_record_number_seq', width: 4 },
  PROPERTY: { prefix: 'PROP', sequence: 'public.property_record_number_seq', width: 4 },
  SPACE: { prefix: 'SPC', sequence: 'public.space_record_number_seq', width: 4 },
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
