import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const database = new PrismaClient();
const tables = [
  'construction_projects',
  'construction_contracts',
  'construction_payment_terms',
  'construction_budget_lines',
  'construction_milestones',
  'construction_work_packages',
  'construction_work_package_dependencies',
  'construction_progress_entries',
  'construction_costs',
  'construction_billing_events',
  'construction_service_lead_preferences',
] as const;

const output = resolve(
  process.cwd(),
  'tmp',
  `legacy-construction-backup-${new Date().toISOString().replaceAll(':', '-')}.json`,
);

try {
  const backup: Record<string, unknown[]> = {};
  for (const table of tables) {
    backup[table] = await database.$queryRawUnsafe(`SELECT * FROM "${table}"`);
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(backup, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2),
    'utf8',
  );
  console.log(`Legacy Construction backup written to ${output}`);
} finally {
  await database.$disconnect();
}
