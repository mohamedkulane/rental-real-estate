import { PrismaClient } from '@prisma/client';

const database = new PrismaClient();

const staffNames = [
  'Ayaan Cabdi Warsame',
  'Hodan Ahmed Osman',
  'Mohamed Nur Hassan',
  'Fadumo Ali Mohamed',
  'Abdirahman Yusuf Noor',
  'Sahra Ibrahim Aden',
  'Khalid Omar Jama',
  'Maryan Hassan Ali',
];
const ownerNames = [
  'Hodan Property Holdings',
  'Daryeel Property Holdings',
  'Barwaaqo Investment Group',
  'Sahan Real Estate Partners',
];
const propertyNames = [
  'Barwaaqo Residence',
  'Daryeel Business Centre',
  'Hodan Plaza',
  'Sahan Apartments',
];

async function normalize(): Promise<void> {
  await database.party.updateMany({
    where: { displayName: 'Development Super Admin' },
    data: { displayName: 'Mohamed Ali Hassan' },
  });

  const testUsers = await database.user.findMany({
    where: { emailNormalized: { endsWith: '@example.test' } },
    include: { employee: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const [index, user] of testUsers.entries()) {
    const name = staffNames[index % staffNames.length]!;
    const token = user.id.slice(0, 6).toLowerCase();
    const emailName = name
      .toLowerCase()
      .replaceAll(/[^a-z]+/gu, '.')
      .replace(/^\.|\.$/gu, '');
    await database.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { emailNormalized: `${emailName}+${token}@demo.rentalops.local` },
      });
      if (user.employee) {
        await transaction.party.update({
          where: { id: user.employee.partyId },
          data: { displayName: name },
        });
      }
    });
  }

  const parties = await database.party.findMany({
    where: {
      OR: [
        { displayName: { startsWith: 'CRUD Owner' } },
        { displayName: { startsWith: 'Phase Four' } },
      ],
    },
    orderBy: { partyNumber: 'asc' },
  });
  for (const [index, party] of parties.entries())
    await database.party.update({
      where: { id: party.id },
      data: { displayName: ownerNames[index % ownerNames.length]! },
    });

  const properties = await database.property.findMany({
    where: {
      OR: [{ name: { startsWith: 'CRUD Property' } }, { name: { startsWith: 'Phase Four' } }],
    },
    orderBy: { propertyCode: 'asc' },
  });
  for (const [index, property] of properties.entries())
    await database.property.update({
      where: { id: property.id },
      data: { name: propertyNames[index % propertyNames.length]! },
    });

  const branches = await database.branch.findMany({
    where: { name: { startsWith: 'CRUD Branch' } },
    orderBy: { code: 'asc' },
  });
  const branchNames = ['Hodan Service Office', 'Wadajir Service Office', 'KM4 Operations Office'];
  for (const [index, branch] of branches.entries())
    await database.branch.update({
      where: { id: branch.id },
      data: { name: branchNames[index % branchNames.length]! },
    });

  const roles = await database.role.findMany({
    where: { name: { startsWith: 'CRUD Role' } },
    orderBy: { code: 'asc' },
  });
  for (const [index, role] of roles.entries())
    await database.role.update({
      where: { id: role.id },
      data: { name: index % 2 ? 'Senior Portfolio Coordinator' : 'Portfolio Coordinator' },
    });

  console.info(
    `Normalized ${testUsers.length} test accounts, ${parties.length} parties, ${properties.length} properties, ${branches.length} branches, and ${roles.length} roles.`,
  );
}

normalize().finally(async () => database.$disconnect());
