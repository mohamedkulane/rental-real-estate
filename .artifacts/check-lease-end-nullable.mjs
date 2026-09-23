import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rows = await prisma.$queryRawUnsafe(`
  SELECT table_name::text AS table_name, is_nullable::text AS is_nullable
  FROM information_schema.columns
  WHERE table_name IN ('leases', 'rental_agreements')
    AND column_name = 'leaseEndDate'
`);
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
