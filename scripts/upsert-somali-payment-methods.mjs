/**
 * Upserts local Somali payment methods for the seeded company.
 * Usage: node scripts/upsert-somali-payment-methods.mjs
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const methods = [
  ['EVC', 'EVC'],
  ['EDAHAB', 'E-Dahab'],
  ['SOMNET', 'Somnet'],
  ['SALAAM_BANK', 'Salaam Bank'],
];

const database = new PrismaClient();

async function main() {
  const company = await database.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) {
    throw new Error('No company found. Seed the database first.');
  }

  for (const [code, name] of methods) {
    await database.paymentMethod.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name, active: true },
      create: {
        id: randomUUID(),
        companyId: company.id,
        code,
        name,
        active: true,
      },
    });
    console.log(`OK ${code} — ${name}`);
  }

  const rows = await database.paymentMethod.findMany({
    where: { companyId: company.id, active: true },
    orderBy: { code: 'asc' },
    select: { code: true, name: true },
  });
  console.log('\nActive payment methods:');
  for (const row of rows) console.log(`  ${row.code}\t${row.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
