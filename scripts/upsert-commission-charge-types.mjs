import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const database = new PrismaClient();

const types = [
  ['OWNER_COMMISSION', 'Owner brokerage commission'],
  ['TENANT_COMMISSION', 'Tenant brokerage commission'],
];

async function main() {
  const company = await database.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No company found.');
  for (const [code, name] of types) {
    await database.chargeType.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name, active: true },
      create: { id: randomUUID(), companyId: company.id, code, name, active: true },
    });
    console.log(`OK ${code}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
