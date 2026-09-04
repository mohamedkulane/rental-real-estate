import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { uuidv7 } from '@rerms/shared';
import { hash } from 'argon2';
import { parseSeedEnvironment } from '@rerms/config';
import {
  PrismaClient,
  BranchAccessMode,
  LeadIntent,
  LeadStage,
  OwnerStatus,
  PartyKind,
  PropertyStatus,
  RentableSpaceStatus,
  ServiceEngagementStatus,
  ServiceModel,
  UserStatus,
} from '@prisma/client';

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

      SELECT MAX(substring("buildingCode" FROM '^BLD-([0-9]+)$')::bigint)
        INTO maximum_value FROM buildings WHERE "buildingCode" ~ '^BLD-[0-9]+$';
      PERFORM setval('building_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("spaceCode" FROM '^SPC-([0-9]+)$')::bigint)
        INTO maximum_value FROM rentable_spaces WHERE "spaceCode" ~ '^SPC-[0-9]+$';
      PERFORM setval('space_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("engagementNumber" FROM '^ENG-([0-9]+)$')::bigint)
        INTO maximum_value FROM service_engagements WHERE "engagementNumber" ~ '^ENG-[0-9]+$';
      PERFORM setval('service_engagement_record_number_seq', COALESCE(maximum_value + 1, 1), false);

      SELECT MAX(substring("leadNumber" FROM '^LEAD-([0-9]+)$')::bigint)
        INTO maximum_value FROM leads WHERE "leadNumber" ~ '^LEAD-[0-9]+$';
      PERFORM setval('lead_record_number_seq', COALESCE(maximum_value + 1, 1), false);
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
  ['service-engagement.read', 'Read Service Engagements'],
  ['service-engagement.create', 'Create Service Engagement drafts'],
  ['service-engagement.update', 'Update permitted Service Engagement fields'],
  ['service-engagement.activate', 'Activate Service Engagements'],
  ['service-engagement.deactivate', 'Deactivate Service Engagements'],
  ['service-engagement.cancel', 'Cancel Service Engagements'],
  ['service-engagement.capability.read', 'Resolve effective commercial capabilities'],
  ['crm.lead.read', 'Read CRM Leads'],
  ['crm.lead.create', 'Create CRM Leads'],
  ['crm.lead.update', 'Update permitted CRM Lead fields'],
  ['crm.lead.stage', 'Perform controlled CRM Lead stage transitions'],
  ['crm.activity.read', 'Read CRM Lead Activities'],
  ['crm.activity.create', 'Append CRM Lead Activities'],
  ['crm.activity.correct', 'Append CRM Activity corrections or voids'],
  ['crm.followup.read', 'Read CRM Follow-ups'],
  ['crm.followup.create', 'Create CRM Follow-ups'],
  ['crm.followup.update', 'Reschedule open CRM Follow-ups'],
  ['crm.followup.complete', 'Complete CRM Follow-ups'],
  ['crm.followup.cancel', 'Cancel CRM Follow-ups'],
  ['crm.assignment.read', 'Read CRM Lead assignment history'],
  ['crm.assignment.manage', 'Assign and reassign CRM Leads'],
  ['crm.lead.branch.transfer', 'Transfer CRM Lead responsibility between authorized Branches'],
  ['crm.source.read', 'Read CRM Lead Sources'],
  ['crm.source.manage', 'Manage Company-wide CRM Lead Sources'],
  ['crm.lead.contact.read', 'Read sensitive CRM Lead contact fields'],
  ['crm.lead.contact.export', 'Export sensitive CRM Lead contact fields'],
  ['workflow.draft.read', 'Read authorized workflow drafts'],
  ['workflow.draft.update', 'Create and update authorized workflow drafts'],
  ['workflow.draft.cancel', 'Cancel authorized workflow drafts'],
  ['workflow.draft.complete', 'Complete authorized workflow drafts'],
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
    'service-engagement.read',
    'service-engagement.create',
    'service-engagement.update',
    'service-engagement.activate',
    'service-engagement.deactivate',
    'service-engagement.cancel',
    'service-engagement.capability.read',
    'crm.lead.read',
    'crm.lead.create',
    'crm.lead.update',
    'crm.lead.stage',
    'crm.activity.read',
    'crm.activity.create',
    'crm.activity.correct',
    'crm.followup.read',
    'crm.followup.create',
    'crm.followup.update',
    'crm.followup.complete',
    'crm.followup.cancel',
    'crm.assignment.read',
    'crm.assignment.manage',
    'crm.lead.branch.transfer',
    'crm.source.read',
    'crm.lead.contact.read',
    'workflow.draft.read',
    'workflow.draft.update',
    'workflow.draft.cancel',
    'workflow.draft.complete',
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
    'service-engagement.read',
    'service-engagement.create',
    'service-engagement.update',
    'service-engagement.activate',
    'service-engagement.deactivate',
    'service-engagement.cancel',
    'service-engagement.capability.read',
    'crm.lead.read',
    'crm.lead.create',
    'crm.lead.update',
    'crm.lead.stage',
    'crm.activity.read',
    'crm.activity.create',
    'crm.activity.correct',
    'crm.followup.read',
    'crm.followup.create',
    'crm.followup.update',
    'crm.followup.complete',
    'crm.followup.cancel',
    'crm.assignment.read',
    'crm.assignment.manage',
    'crm.lead.branch.transfer',
    'crm.source.read',
    'crm.lead.contact.read',
    'workflow.draft.read',
    'workflow.draft.update',
    'workflow.draft.cancel',
    'workflow.draft.complete',
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
    'service-engagement.read',
    'service-engagement.capability.read',
    'crm.lead.read',
    'crm.lead.create',
    'crm.lead.update',
    'crm.lead.stage',
    'crm.activity.read',
    'crm.activity.create',
    'crm.followup.read',
    'crm.followup.create',
    'crm.followup.update',
    'crm.followup.complete',
    'crm.followup.cancel',
    'crm.assignment.read',
    'crm.source.read',
    'crm.lead.contact.read',
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
    'service-engagement.read',
    'service-engagement.capability.read',
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
    'crm.lead.read',
    'crm.lead.create',
    'crm.lead.update',
    'crm.activity.read',
    'crm.activity.create',
    'crm.followup.read',
    'crm.followup.create',
    'crm.assignment.read',
    'crm.source.read',
    'crm.lead.contact.read',
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

  const companyPartyNumber = `PTY-COMP-${company.id.replaceAll('-', '').slice(0, 12)}`;
  const existingCompanyParty = company.legalPartyId
    ? await database.party.findUnique({ where: { id: company.legalPartyId } })
    : null;
  const companyParty =
    existingCompanyParty ??
    (await database.party.upsert({
      where: {
        companyId_partyNumber: { companyId: company.id, partyNumber: companyPartyNumber },
      },
      update: {
        displayName: company.legalName ?? company.name,
        active: true,
      },
      create: {
        id: uuidv7(),
        companyId: company.id,
        partyNumber: companyPartyNumber,
        kind: PartyKind.ORGANIZATION,
        displayName: company.legalName ?? company.name,
        active: true,
      },
    }));
  if (existingCompanyParty) {
    await database.party.update({
      where: { id: existingCompanyParty.id },
      data: { displayName: company.legalName ?? company.name, active: true },
    });
  }
  await database.organizationProfile.upsert({
    where: { partyId: companyParty.id },
    update: { legalName: company.legalName ?? company.name },
    create: { partyId: companyParty.id, legalName: company.legalName ?? company.name },
  });
  await database.ownerProfile.upsert({
    where: { partyId: companyParty.id },
    update: { status: OwnerStatus.ACTIVE, verifiedAt: new Date() },
    create: {
      partyId: companyParty.id,
      ownerNumber: `OWN-COMP-${company.id.replaceAll('-', '').slice(0, 12)}`,
      status: OwnerStatus.ACTIVE,
      verifiedAt: new Date(),
    },
  });
  if (company.legalPartyId !== companyParty.id) {
    await database.company.update({
      where: { id: company.id },
      data: { legalPartyId: companyParty.id },
    });
  }

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

  const leadSources = new Map<string, string>();
  for (const [code, label, sortOrder] of [
    ['WALK_IN', 'Walk-in', 10],
    ['REFERRAL', 'Referral', 20],
    ['WEBSITE', 'Website', 30],
  ] as const) {
    const source = await database.leadSource.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { label, sortOrder, status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        companyId: company.id,
        code,
        label,
        sortOrder,
        createdByUserId: user.id,
      },
    });
    leadSources.set(code, source.id);
  }

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

  let sampleProperty = await database.property.findUnique({
    where: {
      companyId_propertyCode: { companyId: company.id, propertyCode: 'PROP-P5-DEMO' },
    },
  });
  if (!sampleProperty) {
    sampleProperty = await database.$transaction(async (transaction) => {
      const ownershipId = uuidv7();
      return transaction.property.create({
        data: {
          id: uuidv7(),
          companyId: company.id,
          propertyCode: 'PROP-P5-DEMO',
          name: 'Company Commercial Demonstration Property',
          propertyType: 'COMMERCIAL_BUILDING',
          status: PropertyStatus.ACTIVE,
          city: 'Mogadishu',
          description: 'Idempotent Phase 5.1 capability-resolution sample.',
          propertyLifecycleHistories: {
            create: {
              id: uuidv7(),
              status: PropertyStatus.ACTIVE,
              effectiveFrom: today,
              reason: 'Phase 5.1 seed activation',
              actorUserId: user.id,
            },
          },
          branchAssignments: {
            create: { id: uuidv7(), branchId: branches[0]!.id, effectiveFrom: today },
          },
          ownerships: {
            create: {
              id: ownershipId,
              ownerPartyId: companyParty.id,
              ownershipPercent: '100',
              effectiveFrom: today,
              entitlements: {
                create: {
                  id: uuidv7(),
                  payoutPercent: '100',
                  effectiveFrom: today,
                },
              },
            },
          },
        },
      });
    });
  }
  const wholePropertyType = await database.rentableSpaceType.findUniqueOrThrow({
    where: { code: 'ENTIRE_PROPERTY' },
  });
  let sampleSpace = await database.rentableSpace.findFirst({
    where: { propertyId: sampleProperty.id, spaceCode: 'SPC-P5-DEMO' },
  });
  if (!sampleSpace) {
    sampleSpace = await database.rentableSpace.create({
      data: {
        id: uuidv7(),
        propertyId: sampleProperty.id,
        typeId: wholePropertyType.id,
        spaceCode: 'SPC-P5-DEMO',
        name: 'Entire Demonstration Property',
        status: RentableSpaceStatus.ACTIVE,
        versions: {
          create: {
            id: uuidv7(),
            versionNo: 1,
            effectiveFrom: today,
            label: 'Initial whole-property rental scope',
          },
        },
      },
    });
  }
  await database.serviceEngagement.upsert({
    where: {
      companyId_engagementNumber: {
        companyId: company.id,
        engagementNumber: 'ENG-000001',
      },
    },
    update: { notes: 'Company-owned capability baseline for Phase 5.1.' },
    create: {
      id: uuidv7(),
      companyId: company.id,
      engagementNumber: 'ENG-000001',
      serviceModel: ServiceModel.COMPANY_OWNED,
      status: ServiceEngagementStatus.ACTIVE,
      propertyId: sampleProperty.id,
      effectiveFrom: today,
      notes: 'Company-owned capability baseline for Phase 5.1.',
      createdByUserId: user.id,
      history: {
        create: {
          id: uuidv7(),
          toStatus: ServiceEngagementStatus.ACTIVE,
          action: 'SEEDED',
          reason: 'Phase 5.1 idempotent sample data',
          actorUserId: user.id,
        },
      },
    },
  });

  const referralSourceId = leadSources.get('REFERRAL');
  if (!referralSourceId) throw new Error('REFERRAL Lead Source was not created');
  const existingLead = await database.lead.findUnique({
    where: { companyId_leadNumber: { companyId: company.id, leadNumber: 'LEAD-000001' } },
  });
  if (!existingLead) {
    const recordedAt = new Date();
    await database.lead.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        leadNumber: 'LEAD-000001',
        intent: LeadIntent.RENT,
        stage: LeadStage.NEW,
        sourceId: referralSourceId,
        responsibleBranchId: branches[0]!.id,
        currentAssigneeEmployeeId: employee.id,
        partyId: party.id,
        displayName: party.displayName,
        createdByUserId: user.id,
        preferenceVersions: {
          create: {
            id: uuidv7(),
            intent: LeadIntent.RENT,
            versionNo: 1,
            preferredAreaText: ['Mogadishu'],
            effectiveFrom: recordedAt,
            actorUserId: user.id,
            reason: 'Phase 5.2 idempotent sample intake',
            rent: {
              create: {
                propertyTypeCodes: ['COMMERCIAL_BUILDING'],
                rentableSpaceTypeCodes: ['ENTIRE_PROPERTY'],
                maxRent: '2500',
                currency: 'USD',
                rentPeriod: 'MONTHLY',
                moveInDate: today,
                rentableSpaceId: sampleSpace.id,
              },
            },
          },
        },
        stageHistory: {
          create: {
            id: uuidv7(),
            toStage: LeadStage.NEW,
            reason: 'Phase 5.2 idempotent sample intake',
            actorUserId: user.id,
            leadVersion: 1,
            occurredAt: recordedAt,
          },
        },
        branchHistory: {
          create: {
            id: uuidv7(),
            branchId: branches[0]!.id,
            assignedFrom: recordedAt,
            actorUserId: user.id,
            reason: 'Phase 5.2 idempotent sample intake',
          },
        },
        assignments: {
          create: {
            id: uuidv7(),
            employeeId: employee.id,
            branchId: branches[0]!.id,
            assignedFrom: recordedAt,
            actorUserId: user.id,
            reason: 'Phase 5.2 idempotent sample assignment',
          },
        },
      },
    });
  }

  // Seeded business identifiers must reserve their values before normal API writes begin.
  await synchronizeRecordNumberSequences();

  console.info(
    `Seeded Phase 5.2 CRM foundation for ${company.code} with ${branches.length} branches and admin ${emailNormalized}.`,
  );
}

seed().finally(async () => database.$disconnect());
