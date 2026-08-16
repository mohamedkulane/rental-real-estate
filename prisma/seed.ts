import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { uuidv7 } from '@rerms/shared';
import { hash } from 'argon2';
import { parseSeedEnvironment } from '@rerms/config';
import { PrismaClient, BranchAccessMode, PartyKind, UserStatus } from '@prisma/client';

const environmentFile = resolve(__dirname, '../.env');
if (existsSync(environmentFile)) loadEnvFile(environmentFile);

const database = new PrismaClient();
const environment = parseSeedEnvironment(process.env);
const today = new Date(new Date().toISOString().slice(0, 10));

async function synchronizeRecordNumberSequences(): Promise<void> {
  await database.$executeRaw`
    DO $$
    DECLARE
      maximum_value bigint;
    BEGIN
      SELECT MAX(substring(code FROM '^BR-([0-9]+)$')::bigint)
        INTO maximum_value FROM branches WHERE code ~ '^BR-[0-9]+$';
      PERFORM setval('branch_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("employeeNumber" FROM '^EMP-([0-9]+)$')::bigint)
        INTO maximum_value FROM employees WHERE "employeeNumber" ~ '^EMP-[0-9]+$';
      PERFORM setval('employee_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("partyNumber" FROM '^PTY-([0-9]+)$')::bigint)
        INTO maximum_value FROM parties WHERE "partyNumber" ~ '^PTY-[0-9]+$';
      PERFORM setval('party_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("ownerNumber" FROM '^OWN-([0-9]+)$')::bigint)
        INTO maximum_value FROM owner_profiles WHERE "ownerNumber" ~ '^OWN-[0-9]+$';
      PERFORM setval('owner_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("propertyCode" FROM '^PROP-([0-9]+)$')::bigint)
        INTO maximum_value FROM properties WHERE "propertyCode" ~ '^PROP-[0-9]+$';
      PERFORM setval('property_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("spaceCode" FROM '^SPC-([0-9]+)$')::bigint)
        INTO maximum_value FROM rentable_spaces WHERE "spaceCode" ~ '^SPC-[0-9]+$';
      PERFORM setval('space_record_number_seq', COALESCE(maximum_value + 1, 1), false);
    END $$;
  `;
}

const permissions = [
  ['organization.company.read', 'Read company foundation settings'],
  ['organization.company.update', 'Update company foundation settings'],
  ['organization.branch.read', 'Read branches'],
  ['organization.branch.create', 'Create branches'],
  ['organization.branch.update', 'Update branches'],
  ['identity.user.read', 'Read users'],
  ['identity.user.create', 'Create user access'],
  ['identity.user.update', 'Update user access'],
  ['identity.user.suspend', 'Suspend or activate users'],
  ['identity.session.revoke', 'Revoke user sessions'],
  ['identity.role.read', 'Read roles and role grants'],
  ['identity.role.manage', 'Manage role permissions and assignments'],
  ['identity.permission.read', 'Read system permissions'],
  ['identity.employee.read', 'Read employees'],
  ['identity.employee.create', 'Create employees'],
  ['identity.employee.update', 'Update employees and access assignments'],
  ['governance.audit.read', 'Read audit evidence'],
  ['governance.approval.read', 'Read approval requests'],
  ['governance.approval.request', 'Create approval requests'],
  ['governance.approval.decide', 'Record approval decisions'],
  ['party.read', 'Read directory-level Party data'],
  ['party.contact.read', 'Read full Party phone and email values'],
  ['party.create', 'Create company-level parties'],
  ['party.update', 'Update company-level parties'],
  ['owner.read', 'Read owner profiles and portfolios'],
  ['owner.create', 'Create owner profiles'],
  ['owner.update', 'Update owner profiles'],
  ['portfolio.property.read', 'Read properties'],
  ['portfolio.property.create', 'Create properties'],
  ['portfolio.property.update', 'Update properties and operating branch'],
  ['portfolio.building.read', 'Read property buildings'],
  ['portfolio.building.manage', 'Manage property buildings'],
  ['portfolio.space.read', 'Read RentableSpace hierarchy'],
  ['portfolio.space.create', 'Create RentableSpaces'],
  ['portfolio.space.update', 'Correct and retire RentableSpaces'],
  ['portfolio.space.partition', 'Partition RentableSpaces'],
  ['portfolio.ownership.read', 'Read property ownership history'],
  ['portfolio.ownership.manage', 'Manage effective property ownership'],
  ['portfolio.amenity.read', 'Read amenity reference data'],
  ['portfolio.amenity.manage', 'Manage property and space amenities'],
  ['portfolio.document.read', 'Read portfolio document metadata'],
  ['portfolio.document.manage', 'Manage portfolio document metadata'],
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  GENERAL_MANAGER: permissions
    .map(([code]) => code)
    .filter((code) => code !== 'identity.role.manage'),
  BRANCH_MANAGER: [
    'organization.company.read',
    'organization.branch.read',
    'organization.branch.update',
    'identity.user.read',
    'identity.user.create',
    'identity.user.update',
    'identity.user.suspend',
    'identity.session.revoke',
    'identity.role.read',
    'identity.role.manage',
    'identity.permission.read',
    'identity.employee.read',
    'identity.employee.create',
    'identity.employee.update',
    'governance.audit.read',
    'governance.approval.read',
    'governance.approval.request',
    'governance.approval.decide',
    'party.read',
    'party.contact.read',
    'party.create',
    'party.update',
    'owner.read',
    'owner.create',
    'owner.update',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.property.create',
    'portfolio.property.update',
    'portfolio.building.manage',
    'portfolio.space.read',
    'portfolio.space.create',
    'portfolio.space.update',
    'portfolio.space.partition',
    'portfolio.ownership.read',
    'portfolio.ownership.manage',
    'portfolio.amenity.read',
    'portfolio.amenity.manage',
    'portfolio.document.read',
    'portfolio.document.manage',
  ],
  PROPERTY_MANAGER: [
    'organization.branch.read',
    'identity.employee.read',
    'party.read',
    'party.contact.read',
    'party.create',
    'party.update',
    'owner.read',
    'owner.create',
    'owner.update',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.property.create',
    'portfolio.property.update',
    'portfolio.building.manage',
    'portfolio.space.read',
    'portfolio.space.create',
    'portfolio.space.update',
    'portfolio.space.partition',
    'portfolio.ownership.read',
    'portfolio.ownership.manage',
    'portfolio.amenity.read',
    'portfolio.amenity.manage',
    'portfolio.document.read',
    'portfolio.document.manage',
  ],
  LEASING_AGENT: [
    'organization.branch.read',
    'identity.employee.read',
    'party.read',
    'party.contact.read',
    'party.create',
    'party.update',
    'owner.read',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.space.read',
    'portfolio.ownership.read',
    'portfolio.amenity.read',
    'portfolio.document.read',
  ],
  ACCOUNTANT: [
    'organization.branch.read',
    'identity.employee.read',
    'governance.approval.read',
    'governance.approval.request',
    'party.read',
    'party.contact.read',
    'owner.read',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.ownership.read',
    'portfolio.document.read',
  ],
  MAINTENANCE_COORDINATOR: [
    'organization.branch.read',
    'identity.employee.read',
    'party.read',
    'party.contact.read',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.space.read',
    'portfolio.amenity.read',
    'portfolio.document.read',
  ],
  INSPECTOR: [
    'organization.branch.read',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.space.read',
    'portfolio.amenity.read',
    'portfolio.document.read',
  ],
  RECEPTIONIST: [
    'organization.branch.read',
    'identity.employee.read',
    'party.read',
    'party.contact.read',
    'party.create',
    'party.update',
    'owner.read',
    'portfolio.property.read',
    'portfolio.building.read',
    'portfolio.space.read',
    'portfolio.amenity.read',
  ],
};

const roleNames: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  GENERAL_MANAGER: 'General Manager',
  BRANCH_MANAGER: 'Branch Manager',
  PROPERTY_MANAGER: 'Property Manager',
  LEASING_AGENT: 'Leasing Agent',
  ACCOUNTANT: 'Accountant',
  MAINTENANCE_COORDINATOR: 'Maintenance Coordinator',
  INSPECTOR: 'Inspector',
  RECEPTIONIST: 'Receptionist',
};

async function seed(): Promise<void> {
  const company = await database.company.upsert({
    where: { code: environment.SEED_COMPANY_CODE },
    update: {
      name: 'Real Estate Rental Company',
      displayName: 'Real Estate Rental Company',
      active: true,
    },
    create: {
      id: uuidv7(),
      singletonKey: true,
      code: environment.SEED_COMPANY_CODE,
      name: 'Real Estate Rental Company',
      legalName: 'Real Estate Rental Company',
      displayName: 'Real Estate Rental Company',
      defaultCurrency: 'USD',
      timezone: 'Africa/Nairobi',
      active: true,
    },
  });

  const branchInputs = [
    [environment.SEED_BRANCH_CODE, 'Head Office'],
    ['HODAN', 'Hodan Branch'],
    ['WADAJIR', 'Wadajir Branch'],
  ] as const;
  const branches = [];
  for (const [code, name] of branchInputs) {
    branches.push(
      await database.branch.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: { name, active: true },
        create: { id: uuidv7(), companyId: company.id, code, name, active: true },
      }),
    );
  }

  const permissionRecords = new Map<string, string>();
  for (const [code, description] of permissions) {
    const permission = await database.permission.upsert({
      where: { code },
      update: { description },
      create: { id: uuidv7(), code, description },
    });
    permissionRecords.set(code, permission.id);
  }

  const roles = new Map<string, string>();
  for (const [code, codes] of Object.entries(rolePermissions)) {
    const name = roleNames[code] ?? code.replaceAll('_', ' ');
    const role = await database.role.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name, active: true },
      create: {
        id: uuidv7(),
        companyId: company.id,
        code,
        name,
        active: true,
      },
    });
    roles.set(code, role.id);
    const intendedPermissionIds = codes.map((permissionCode) => {
      const permissionId = permissionRecords.get(permissionCode);
      if (!permissionId) throw new Error(`Unknown permission ${permissionCode}`);
      return permissionId;
    });
    await database.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: intendedPermissionIds },
      },
    });
    for (const permissionCode of codes) {
      const permissionId = permissionRecords.get(permissionCode);
      if (!permissionId) throw new Error(`Unknown permission ${permissionCode}`);
      await database.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  const rentableSpaceTypes = [
    ['ENTIRE_PROPERTY', 'Entire property'],
    ['APARTMENT', 'Apartment'],
    ['ROOM', 'Room'],
    ['FLOOR', 'Floor'],
    ['HALL', 'Hall'],
    ['SHOP', 'Shop'],
    ['BOOTH', 'Booth'],
    ['OFFICE', 'Office'],
    ['WAREHOUSE', 'Warehouse'],
    ['LAND', 'Land'],
    ['PARKING_SPACE', 'Parking space'],
    ['STORAGE', 'Storage'],
    ['OTHER', 'Other'],
  ] as const;
  for (const [code, name] of rentableSpaceTypes) {
    await database.rentableSpaceType.upsert({
      where: { code },
      update: { name, active: true },
      create: { id: uuidv7(), code, name, active: true },
    });
  }
  const amenities = [
    ['PARKING', 'Parking'],
    ['SECURITY', 'Security'],
    ['CCTV', 'CCTV'],
    ['ELEVATOR', 'Elevator'],
    ['GENERATOR', 'Generator'],
    ['WATER', 'Water availability'],
    ['INTERNET_READY', 'Internet ready'],
    ['GARDEN', 'Garden'],
    ['AIR_CONDITIONING', 'Air conditioning'],
    ['FURNISHED', 'Furnished'],
  ] as const;
  for (const [code, name] of amenities) {
    await database.amenity.upsert({
      where: { code },
      update: { name, active: true },
      create: { id: uuidv7(), code, name, active: true },
    });
  }

  const emailNormalized = environment.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await hash(environment.SEED_ADMIN_PASSWORD, {
    type: 2,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
  const user = await database.user.upsert({
    where: { emailNormalized },
    update: { status: UserStatus.ACTIVE, passwordHash },
    create: { id: uuidv7(), emailNormalized, passwordHash, status: UserStatus.ACTIVE },
  });
  const existingAdminEmployee = await database.employee.findUnique({
    where: { companyId_employeeNumber: { companyId: company.id, employeeNumber: 'EMP-0001' } },
  });
  const employeeId = existingAdminEmployee?.id ?? uuidv7();
  const partyId = existingAdminEmployee?.partyId ?? uuidv7();
  const party = await database.party.upsert({
    where: { id: partyId },
    update: {
      partyNumber: `STF-${employeeId}`,
      displayName: 'Mohamed Ali Hassan',
      active: true,
    },
    create: {
      id: partyId,
      companyId: company.id,
      partyNumber: `STF-${employeeId}`,
      kind: PartyKind.PERSON,
      displayName: 'Mohamed Ali Hassan',
    },
  });
  const employee = await database.employee.upsert({
    where: { companyId_employeeNumber: { companyId: company.id, employeeNumber: 'EMP-0001' } },
    update: { userId: user.id, accessMode: BranchAccessMode.COMPANY_WIDE, active: true },
    create: {
      id: employeeId,
      companyId: company.id,
      userId: user.id,
      partyId: party.id,
      employeeNumber: 'EMP-0001',
      accessMode: BranchAccessMode.COMPANY_WIDE,
      jobTitle: 'Super Administrator',
    },
  });
  const superAdminRoleId = roles.get('SUPER_ADMIN');
  if (!superAdminRoleId) throw new Error('SUPER_ADMIN role was not created');
  const existingRole = await database.employeeRole.findFirst({
    where: { employeeId: employee.id, roleId: superAdminRoleId, branchId: null, effectiveTo: null },
  });
  if (!existingRole)
    await database.employeeRole.create({
      data: {
        id: uuidv7(),
        employeeId: employee.id,
        roleId: superAdminRoleId,
        effectiveFrom: today,
      },
    });

  const approvalPolicy = await database.approvalPolicy.upsert({
    where: {
      companyId_code_effectiveFrom: {
        companyId: company.id,
        code: 'FOUNDATION_MAKER_CHECKER',
        effectiveFrom: today,
      },
    },
    update: { name: 'Foundation maker-checker policy', active: true },
    create: {
      id: uuidv7(),
      companyId: company.id,
      code: 'FOUNDATION_MAKER_CHECKER',
      name: 'Foundation maker-checker policy',
      effectiveFrom: today,
      active: true,
    },
  });
  const existingApprovalRule = await database.approvalRule.findFirst({
    where: { policyId: approvalPolicy.id, actionType: 'FOUNDATION_TEST', sequence: 1 },
  });
  if (!existingApprovalRule)
    await database.approvalRule.create({
      data: {
        id: uuidv7(),
        policyId: approvalPolicy.id,
        actionType: 'FOUNDATION_TEST',
        sequence: 1,
        makerChecker: true,
        allowDelegation: false,
      },
    });

  // Seeded business identifiers must reserve their values before normal API writes begin.
  await synchronizeRecordNumberSequences();

  console.info(
    `Seeded Phase 4 foundation for ${company.code} with ${branches.length} branches and admin ${emailNormalized}.`,
  );
}

seed().finally(async () => database.$disconnect());
