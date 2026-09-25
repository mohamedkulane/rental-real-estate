import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  AreaUnit,
  CommissionMethod,
  LeadIntent,
  LeasePartyRole,
  ListingStatus,
  OwnerStatus,
  PartyKind,
  Prisma,
  PropertyStatus,
  PropertyServiceIntent,
  PropertyType,
  RentableSpaceStatus,
  ScreeningStatus,
  ServiceEngagementStatus,
  ServiceModel,
  ViewingStatus,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { BusinessDateService } from '../common/business-date.service';
import { nextRecordNumber } from '../common/record-number';
import { CrmContactService } from '../crm/crm-contact.service';
import { ServiceEngagementService } from '../commercial/service-engagement.service';
import { ListingService } from '../leasing/listing.service';
import { LeasingService } from '../leasing/leasing.service';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { PartyService } from '../portfolio/party.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  AddBuyerDto,
  AddOwnerAndPropertyDto,
  AddRentalCustomerDto,
  AddRentalOwnerDto,
  AddRentalPropertyDto,
  CreateRentalLeaseDto,
  RentalRoomInputDto,
  RentalUnitInputDto,
  StartFullManagementDto,
  StartRentalBrokerageDto,
} from './rental.dto';
import { RentalPresentationService } from './rental-presentation.service';

function splitPersonName(name: string): { givenName: string; familyName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) throw new BadRequestException('Name is required.');
  if (parts.length === 1) return { givenName: parts[0]!, familyName: parts[0]! };
  return { givenName: parts[0]!, familyName: parts.slice(1).join(' ') };
}

function mapPropertyTypeWanted(value: string): string[] {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
  const map: Record<string, string[]> = {
    APARTMENT: ['APARTMENT_BUILDING'],
    HOUSE: ['HOUSE', 'VILLA'],
    VILLA: ['VILLA', 'HOUSE'],
    COMMERCIAL: ['COMMERCIAL_BUILDING', 'MIXED_USE'],
    LAND: ['LAND'],
    ROOM: ['HOUSE', 'APARTMENT_BUILDING', 'COMPOUND'],
  };
  return map[normalized] ?? [normalized];
}

const BUILDING_PROPERTY_TYPES = new Set<PropertyType>([
  PropertyType.APARTMENT_BUILDING,
  PropertyType.COMMERCIAL_BUILDING,
  PropertyType.COMPOUND,
  PropertyType.MIXED_USE,
  PropertyType.WAREHOUSE_PROPERTY,
]);

function defaultSpaceTypeCode(
  propertyType: PropertyType,
  unit?: RentalUnitInputDto,
  multiUnit = false,
): string {
  if (unit?.typeCode) return unit.typeCode;
  if (propertyType === PropertyType.COMMERCIAL_BUILDING) return 'SHOP';
  if (propertyType === PropertyType.LAND) return 'LAND';
  if (!multiUnit && (propertyType === PropertyType.HOUSE || propertyType === PropertyType.VILLA)) {
    return 'ENTIRE_PROPERTY';
  }
  return 'APARTMENT';
}

function roomAreaShares(rooms: RentalRoomInputDto[]): { areas: string[]; parentArea: string } {
  const areas = rooms.map((room) => {
    const value = room.area?.trim();
    if (value && Number(value) > 0) return value;
    return '1';
  });
  const parentArea = areas
    .reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0))
    .toFixed(4);
  return { areas, parentArea };
}

@Injectable()
export class RentalOrchestrationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
    private readonly businessDate: BusinessDateService,
    private readonly parties: PartyService,
    private readonly portfolio: PortfolioService,
    private readonly engagements: ServiceEngagementService,
    private readonly listings: ListingService,
    private readonly leasing: LeasingService,
    private readonly presentation: RentalPresentationService,
    private readonly contacts: CrmContactService,
  ) {}

  private async resolveBranchId(
    principal: AuthenticatedPrincipal,
    permission: string,
    branchId?: string,
  ): Promise<string> {
    if (branchId) {
      this.auth.assertBranchPermission(principal, permission, branchId);
      return branchId;
    }
    const authorized = this.auth.authorizedBranchIds(principal, permission);
    if (authorized === null) {
      const assigned = [...principal.branchIds][0];
      if (assigned) {
        this.auth.assertBranchPermission(principal, permission, assigned);
        return assigned;
      }
      // Company-wide operators may leave branch blank; use company headquarters.
      const headquarters = await this.db.branch.findFirst({
        where: { companyId: principal.companyId, active: true },
        orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
        select: { id: true },
      });
      if (headquarters) {
        this.auth.assertBranchPermission(principal, permission, headquarters.id);
        return headquarters.id;
      }
      throw new BadRequestException(
        'No company branch exists yet. Create a headquarters branch in Administration, or choose a branch.',
      );
    }
    const first = [...authorized][0];
    if (!first) throw new BadRequestException('No authorized branch is available.');
    return first;
  }

  private async defaultLeadSourceId(companyId: string): Promise<string> {
    const source = await this.db.leadSource.findFirst({
      where: { companyId, code: 'WALK_IN', status: 'ACTIVE' },
      select: { id: true },
    });
    if (!source) throw new ConflictException('Default lead source is not configured.');
    return source.id;
  }

  private async writeCommercialTerms(
    transaction: Prisma.TransactionClient,
    engagementId: string,
    effectiveFrom: Date,
    terms: {
      commissionPercent?: string;
      managementFeePercent?: string;
      commissionMethod?: CommissionMethod;
    },
  ) {
    await transaction.serviceEngagementCommercialTerms.create({
      data: {
        id: uuidv7(),
        serviceEngagementId: engagementId,
        effectiveFrom,
        commissionPercent:
          terms.commissionPercent !== undefined
            ? new Prisma.Decimal(terms.commissionPercent)
            : null,
        managementFeePercent:
          terms.managementFeePercent !== undefined
            ? new Prisma.Decimal(terms.managementFeePercent)
            : null,
        commissionMethod: terms.commissionMethod ?? null,
      },
    });
  }

  async addOwner(
    principal: AuthenticatedPrincipal,
    input: AddRentalOwnerDto,
    correlationId?: string,
  ) {
    const branchId = await this.resolveBranchId(principal, 'party.create', input.branchId);
    this.auth.assertBranchPermission(principal, 'owner.create', branchId);
    const kind = input.kind ?? PartyKind.PERSON;
    const displayName = input.name.trim();
    const names = splitPersonName(displayName);
    const party = await this.parties.create(
      principal,
      {
        branchId,
        kind,
        displayName,
        ...(kind === PartyKind.PERSON
          ? {
              person: {
                givenName: names.givenName,
                familyName: names.familyName,
              },
            }
          : {
              organization: {
                legalName: displayName,
              },
            }),
        contacts: [{ type: 'PHONE', value: input.phone.trim(), primary: true }],
      },
      correlationId,
    );
    const owner = await this.parties.createOwner(
      principal,
      { partyId: party.id, status: OwnerStatus.ACTIVE },
      correlationId,
    );
    return {
      ownerPartyId: owner.partyId,
      ownerNumber: owner.ownerNumber,
      displayName,
      status: owner.status,
      branchId,
    };
  }

  async addProperty(
    principal: AuthenticatedPrincipal,
    input: AddRentalPropertyDto,
    correlationId?: string,
  ) {
    const branchId = await this.resolveBranchId(principal, 'portfolio.property.create', input.branchId);
    this.auth.assertBranchPermission(principal, 'portfolio.ownership.manage', branchId);
    this.auth.assertBranchPermission(principal, 'portfolio.space.create', branchId);
    this.auth.assertBranchPermission(principal, 'portfolio.property.update', branchId);

    const effectiveFrom = (await this.businessDate.today(principal.companyId))
      .toISOString()
      .slice(0, 10);
    const hasMultipleUnits = input.hasMultipleUnits === 'true';
    const units = input.units ?? [];
    if (hasMultipleUnits && units.length < 2) {
      throw new BadRequestException('Add at least two units when the property has multiple rentals.');
    }
    if (units.length > 200) {
      throw new BadRequestException('A property can include at most 200 units in one create request.');
    }
    for (const unit of units) {
      if ((unit.rentMode ?? 'WHOLE') === 'BY_ROOMS') {
        if (!unit.rooms?.length) {
          throw new BadRequestException(`Add at least one room for ${unit.name}.`);
        }
      } else if (!unit.monthlyRent) {
        throw new BadRequestException(`Monthly rent is required for ${unit.name}.`);
      }
    }

    const property = await this.portfolio.createProperty(
      principal,
      {
        branchId,
        name: input.name.trim(),
        propertyType: input.propertyType,
        effectiveFrom,
        city: input.location.trim(),
        ...(input.district?.trim() ? { district: input.district.trim() } : {}),
        ...(input.addressLine1?.trim() ? { addressLine1: input.addressLine1.trim() } : {}),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      },
      correlationId,
    );

    await this.portfolio.replaceOwnership(
      principal,
      property.id,
      {
        effectiveFrom,
        reason: 'Rental property onboarding',
        shares: [
          {
            ownerPartyId: input.ownerPartyId,
            ownershipPercent: '100',
            payoutPercent: '100',
          },
        ],
      },
      correlationId,
    );

    let buildingId: string | undefined;
    if (BUILDING_PROPERTY_TYPES.has(input.propertyType)) {
      this.auth.assertBranchPermission(principal, 'portfolio.building.manage', branchId);
      const building = await this.portfolio.createBuilding(
        principal,
        property.id,
        { name: input.name.trim() },
        correlationId,
      );
      buildingId = building.id;
    }

    type CreatedSpace = {
      id: string;
      name: string;
      spaceCode: string;
      monthlyRent: string;
      parentSpaceId?: string;
      rooms?: CreatedSpace[];
    };
    const spaces: CreatedSpace[] = [];

    const persistAskingRent = async (spaceId: string, monthlyRent: string) => {
      await this.db.rentableSpaceVersion.updateMany({
        where: { rentableSpaceId: spaceId, versionNo: 1 },
        data: {
          attributes: {
            askingRent: monthlyRent,
            currency: (input.currency ?? 'USD').toUpperCase(),
          } as Prisma.InputJsonValue,
        },
      });
    };

    const createUnitSpace = async (unit: RentalUnitInputDto, multiUnit: boolean) => {
      const rentMode = unit.rentMode ?? 'WHOLE';
      const typeCode = defaultSpaceTypeCode(input.propertyType, unit, multiUnit);
      const floorNumber = unit.floor ? Number.parseInt(unit.floor, 10) : NaN;
      const residential =
        unit.bedrooms || unit.bathrooms
          ? {
              ...(unit.bedrooms && Number.isFinite(Number.parseInt(unit.bedrooms, 10))
                ? { bedrooms: Number.parseInt(unit.bedrooms, 10) }
                : {}),
              ...(unit.bathrooms ? { bathrooms: unit.bathrooms } : {}),
            }
          : undefined;
      const roomShares =
        rentMode === 'BY_ROOMS' && unit.rooms?.length ? roomAreaShares(unit.rooms) : null;
      const parentArea =
        unit.area?.trim() ||
        roomShares?.parentArea ||
        (rentMode === 'BY_ROOMS' ? String(unit.rooms?.length ?? 1) : undefined);

      const parent = await this.portfolio.createSpace(
        principal,
        {
          propertyId: property.id,
          ...(buildingId ? { buildingId } : {}),
          typeCode,
          name: unit.name.trim(),
          effectiveFrom,
          status: RentableSpaceStatus.ACTIVE,
          ...(parentArea ? { usableArea: parentArea, areaUnit: AreaUnit.SQM } : {}),
          ...(Number.isFinite(floorNumber) ? { floorNumber } : {}),
          ...(residential && Object.keys(residential).length ? { residential } : {}),
        },
        correlationId,
      );

      const parentRent =
        rentMode === 'BY_ROOMS'
          ? (unit.rooms ?? [])
              .reduce((sum, room) => sum.plus(room.monthlyRent), new Prisma.Decimal(0))
              .toFixed(2)
          : (unit.monthlyRent ?? input.monthlyRent);
      await persistAskingRent(parent.id, parentRent);

      const created: CreatedSpace = {
        id: parent.id,
        name: parent.name,
        spaceCode: parent.spaceCode,
        monthlyRent: parentRent,
        rooms: [],
      };

      if (rentMode === 'BY_ROOMS' && unit.rooms?.length && roomShares) {
        for (const [index, room] of unit.rooms.entries()) {
          const child = await this.portfolio.createSpace(
            principal,
            {
              propertyId: property.id,
              ...(buildingId ? { buildingId } : {}),
              parentSpaceId: parent.id,
              typeCode: 'ROOM',
              name: room.name.trim(),
              effectiveFrom,
              status: RentableSpaceStatus.ACTIVE,
              usableArea: roomShares.areas[index] ?? '1',
              areaUnit: AreaUnit.SQM,
            },
            correlationId,
          );
          await persistAskingRent(child.id, room.monthlyRent);
          if (room.bathroomType || room.notes || room.area) {
            await this.db.rentableSpaceVersion.updateMany({
              where: { rentableSpaceId: child.id, versionNo: 1 },
              data: {
                attributes: {
                  askingRent: room.monthlyRent,
                  currency: (input.currency ?? 'USD').toUpperCase(),
                  ...(room.bathroomType ? { bathroomType: room.bathroomType } : {}),
                  ...(room.notes ? { notes: room.notes } : {}),
                } as Prisma.InputJsonValue,
              },
            });
          }
          created.rooms!.push({
            id: child.id,
            name: child.name,
            spaceCode: child.spaceCode,
            monthlyRent: room.monthlyRent,
            parentSpaceId: parent.id,
          });
        }
      }

      return created;
    };

    if (units.length) {
      for (const unit of units) {
        spaces.push(await createUnitSpace(unit, hasMultipleUnits || units.length > 1));
      }
    } else {
      const space = await this.portfolio.createSpace(
        principal,
        {
          propertyId: property.id,
          ...(buildingId ? { buildingId } : {}),
          typeCode: defaultSpaceTypeCode(input.propertyType, undefined, false),
          name: input.name.trim(),
          effectiveFrom,
          status: RentableSpaceStatus.ACTIVE,
          ...(input.area ? { usableArea: input.area, areaUnit: AreaUnit.SQM } : {}),
          ...(input.bedrooms || input.bathrooms
            ? {
                residential: {
                  ...(input.bedrooms && Number.isFinite(Number.parseInt(input.bedrooms, 10))
                    ? { bedrooms: Number.parseInt(input.bedrooms, 10) }
                    : {}),
                  ...(input.bathrooms ? { bathrooms: input.bathrooms } : {}),
                },
              }
            : {}),
          ...(input.propertyType === PropertyType.LAND &&
          (input.landWidth || input.landLength || input.area)
            ? {
                land: {
                  permittedUse: 'Residential or commercial land',
                  ...(input.landWidth && input.landLength
                    ? { dimensions: `${input.landWidth} x ${input.landLength}` }
                    : {}),
                },
              }
            : {}),
        },
        correlationId,
      );
      await persistAskingRent(space.id, input.monthlyRent);
      spaces.push({
        id: space.id,
        name: space.name,
        spaceCode: space.spaceCode,
        monthlyRent: input.monthlyRent,
      });
    }

    const activated = await this.portfolio.transitionProperty(
      principal,
      property.id,
      PropertyStatus.ACTIVE,
      { reason: 'Rental property ready for market' },
      correlationId,
    );

    const serviceEngagementId = await this.activateOnboardedService(
      principal,
      { propertyId: activated.id, spaces, input },
      correlationId,
    );
    const rentalStatus = await this.presentation.resolvePropertyRentalStatus(
      principal,
      activated.id,
    );

    return {
      propertyId: activated.id,
      propertyCode: activated.propertyCode,
      name: activated.name,
      status: 'Available',
      rentalStatus,
      branchId,
      buildingId: buildingId ?? null,
      spaces,
      serviceIntent: input.serviceIntent ?? null,
      serviceEngagementId,
    };
  }

  private async activateOnboardedService(
    principal: AuthenticatedPrincipal,
    input: { propertyId: string; spaces: Array<{ id: string }>; input: AddRentalPropertyDto },
    correlationId?: string,
  ): Promise<string | null> {
    const serviceIntent = input.input.serviceIntent;
    if (!serviceIntent) return null;
    if (serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT && !input.input.managementFeePercent) {
      throw new BadRequestException('Management fee percentage is required for Full Management.');
    }
    await this.db.property.update({
      where: { id: input.propertyId },
      data: {
        serviceIntent,
        ...(serviceIntent === PropertyServiceIntent.SALE
          ? {
              salePrice: new Prisma.Decimal(input.input.askingPrice ?? input.input.monthlyRent),
              salePriceCurrency: (input.input.currency ?? 'USD').toUpperCase(),
            }
          : {}),
      },
    });
    if (serviceIntent === PropertyServiceIntent.CONSTRUCTION) return null;
    const effectiveFrom =
      input.input.effectiveFrom ??
      (await this.businessDate.today(principal.companyId)).toISOString().slice(0, 10);
    const serviceModel =
      serviceIntent === PropertyServiceIntent.SALE
        ? ServiceModel.SALE_BROKERAGE
        : serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT
          ? ServiceModel.FULL_MANAGEMENT
          : ServiceModel.RENTAL_BROKERAGE;
    const engagement = await this.engagements.create(
      principal,
      {
        serviceModel,
        propertyId: input.propertyId,
        ...(serviceModel === ServiceModel.SALE_BROKERAGE ? {} : { rentableSpaceId: input.spaces[0]?.id }),
        effectiveFrom,
        notes: `Created from ${serviceIntent.toLowerCase().replaceAll('_', ' ')} onboarding.`,
      },
      correlationId,
    );
    if (serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT) {
      await this.db.$transaction(async (tx) => {
        await this.writeCommercialTerms(tx, engagement.id, new Date(effectiveFrom), {
          managementFeePercent: input.input.managementFeePercent,
        });
      });
    }
    const activated = await this.engagements.transition(
      principal,
      engagement.id,
      ServiceEngagementStatus.ACTIVE,
      { version: engagement.version, reason: 'Service intent activated during onboarding.' },
      correlationId,
    );
    return activated.id;
  }

  async addRentalCustomer(
    principal: AuthenticatedPrincipal,
    input: AddRentalCustomerDto,
    correlationId?: string,
  ) {
    const branchId = await this.resolveBranchId(principal, 'crm.lead.create', input.branchId);
    this.auth.assertBranchPermission(principal, 'party.create', branchId);
    const sourceId = await this.defaultLeadSourceId(principal.companyId);
    const currency = (input.currency ?? 'USD').toUpperCase();
    if (new Prisma.Decimal(input.maxRentBudget).lt(input.minRentBudget)) {
      throw new BadRequestException('Maximum rent budget must be greater than or equal to minimum.');
    }

    const displayName = input.name.trim();
    const names = splitPersonName(displayName);
    const phone = input.phone.trim();
    const email = input.email?.trim().toLowerCase();
    const preferredLocations = input.preferredLocations
      .map((location) => location.trim())
      .filter(Boolean);
    if (!preferredLocations.length) {
      throw new BadRequestException('Add at least one preferred location.');
    }
    const party = await this.parties.create(
      principal,
      {
        branchId,
        kind: PartyKind.PERSON,
        displayName,
        person: {
          givenName: names.givenName,
          familyName: names.familyName,
        },
        contacts: [
          { type: 'PHONE' as const, value: phone, primary: true },
          ...(email ? [{ type: 'EMAIL' as const, value: email, primary: false }] : []),
        ],
      },
      correlationId,
    );

    return this.db.$transaction(async (tx) => {
      const [sequence] = await tx.$queryRaw<Array<{ value: bigint }>>(
        Prisma.sql`SELECT nextval('public.lead_record_number_seq') AS value`,
      );
      const now = new Date();
      const lead = await tx.lead.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          leadNumber: `LEAD-${sequence!.value.toString().padStart(6, '0')}`,
          intent: LeadIntent.RENT,
          sourceId,
          responsibleBranchId: branchId,
          partyId: party.id,
          displayName,
          phoneEncrypted: this.contacts.encrypt(phone),
          emailEncrypted: email ? this.contacts.encrypt(email) : null,
          phoneSearchToken: this.contacts.token(phone),
          emailSearchToken: email ? this.contacts.token(email) : null,
          createdByUserId: principal.userId,
          createdAt: now,
          updatedAt: now,
        },
      });
      const preferenceVersion = await tx.leadPreferenceVersion.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          intent: LeadIntent.RENT,
          versionNo: 1,
          preferredAreaText: preferredLocations,
          notes: input.notes?.trim() || null,
          effectiveFrom: now,
          actorUserId: principal.userId,
          reason: 'Rental customer registered',
          correlationId: correlationId ?? null,
          rent: {
            create: {
              propertyTypeCodes: mapPropertyTypeWanted(input.propertyTypeWanted),
              minRent: new Prisma.Decimal(input.minRentBudget),
              maxRent: new Prisma.Decimal(input.maxRentBudget),
              currency,
              ...(input.minBedrooms ? { minBedrooms: Number(input.minBedrooms) } : {}),
              ...(input.minBathrooms
                ? { minBathrooms: new Prisma.Decimal(input.minBathrooms) }
                : {}),
              ...(input.minArea ? { minArea: new Prisma.Decimal(input.minArea) } : {}),
            },
          },
        },
      });
      await tx.leadStageHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          toStage: 'NEW',
          actorUserId: principal.userId,
          leadVersion: 1,
          correlationId: correlationId ?? null,
          occurredAt: now,
        },
      });
      await tx.leadIntentHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          toIntent: LeadIntent.RENT,
          reason: 'Rental customer registered',
          actorUserId: principal.userId,
          leadVersion: 1,
          correlationId: correlationId ?? null,
          occurredAt: now,
        },
      });
      await tx.leadBranchHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          branchId,
          assignedFrom: now,
          actorUserId: principal.userId,
          reason: 'Rental customer registered',
          correlationId: correlationId ?? null,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'rental.customer.created',
        entityType: 'Lead',
        entityId: lead.id,
        branchId,
        correlationId,
        after: {
          leadNumber: lead.leadNumber,
          preferenceVersionId: preferenceVersion.id,
        },
      });
      return {
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        displayName: lead.displayName,
        branchId,
      };
    });
  }

  async addBuyer(principal: AuthenticatedPrincipal, input: AddBuyerDto, correlationId?: string) {
    const branchId = await this.resolveBranchId(principal, 'crm.lead.create', input.branchId);
    this.auth.assertBranchPermission(principal, 'party.create', branchId);
    const sourceId = await this.defaultLeadSourceId(principal.companyId);
    const currency = (input.currency ?? 'USD').toUpperCase();
    if (new Prisma.Decimal(input.maxPurchaseBudget).lt(input.minPurchaseBudget)) {
      throw new BadRequestException(
        'Maximum purchase budget must be greater than or equal to minimum.',
      );
    }
    const displayName = input.name.trim();
    const names = splitPersonName(displayName);
    const phone = input.phone.trim();
    const email = input.email?.trim().toLowerCase();
    const preferredLocations = input.preferredLocations
      .map((location) => location.trim())
      .filter(Boolean);
    if (!preferredLocations.length) {
      throw new BadRequestException('Add at least one preferred location.');
    }
    const party = await this.parties.create(
      principal,
      {
        branchId,
        kind: PartyKind.PERSON,
        displayName,
        person: { givenName: names.givenName, familyName: names.familyName },
        contacts: [
          { type: 'PHONE' as const, value: phone, primary: true },
          ...(email ? [{ type: 'EMAIL' as const, value: email, primary: false }] : []),
        ],
      },
      correlationId,
    );

    return this.db.$transaction(async (tx) => {
      const [sequence] = await tx.$queryRaw<Array<{ value: bigint }>>(
        Prisma.sql`SELECT nextval('public.lead_record_number_seq') AS value`,
      );
      const now = new Date();
      const lead = await tx.lead.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          leadNumber: `LEAD-${sequence!.value.toString().padStart(6, '0')}`,
          intent: LeadIntent.BUY,
          sourceId,
          responsibleBranchId: branchId,
          partyId: party.id,
          displayName,
          phoneEncrypted: this.contacts.encrypt(phone),
          emailEncrypted: email ? this.contacts.encrypt(email) : null,
          phoneSearchToken: this.contacts.token(phone),
          emailSearchToken: email ? this.contacts.token(email) : null,
          createdByUserId: principal.userId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.leadPreferenceVersion.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          intent: LeadIntent.BUY,
          versionNo: 1,
          preferredAreaText: preferredLocations,
          notes:
            [
              input.notes?.trim() || null,
              input.landWidth ? `Minimum land width: ${input.landWidth}` : null,
              input.landLength ? `Minimum land length: ${input.landLength}` : null,
            ]
              .filter(Boolean)
              .join('\n') || null,
          effectiveFrom: now,
          actorUserId: principal.userId,
          reason: 'Buyer registered',
          correlationId: correlationId ?? null,
          buy: {
            create: {
              propertyTypeCodes: mapPropertyTypeWanted(input.propertyTypeWanted),
              minBudget: new Prisma.Decimal(input.minPurchaseBudget),
              maxBudget: new Prisma.Decimal(input.maxPurchaseBudget),
              currency,
              ...(input.minBedrooms ? { minBedrooms: Number(input.minBedrooms) } : {}),
              ...(input.minBathrooms
                ? { minBathrooms: new Prisma.Decimal(input.minBathrooms) }
                : {}),
              ...(input.minArea ? { minArea: new Prisma.Decimal(input.minArea) } : {}),
            },
          },
        },
      });
      await tx.leadStageHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          toStage: 'NEW',
          actorUserId: principal.userId,
          leadVersion: 1,
          correlationId: correlationId ?? null,
          occurredAt: now,
        },
      });
      await tx.leadIntentHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          toIntent: LeadIntent.BUY,
          reason: 'Buyer registered',
          actorUserId: principal.userId,
          leadVersion: 1,
          correlationId: correlationId ?? null,
          occurredAt: now,
        },
      });
      await tx.leadBranchHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          branchId,
          assignedFrom: now,
          actorUserId: principal.userId,
          reason: 'Buyer registered',
          correlationId: correlationId ?? null,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'sales.buyer.created',
        entityType: 'Lead',
        entityId: lead.id,
        branchId,
        correlationId,
        after: { leadNumber: lead.leadNumber },
      });
      return {
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        displayName: lead.displayName,
        branchId,
      };
    });
  }

  async addOwnerAndProperty(
    principal: AuthenticatedPrincipal,
    input: AddOwnerAndPropertyDto,
    correlationId?: string,
  ) {
    const owner = await this.addOwner(
      principal,
      {
        name: input.ownerName,
        phone: input.ownerPhone,
        ...(input.ownerKind ? { kind: input.ownerKind } : {}),
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      correlationId,
    );
    const serviceIntent =
      input.serviceIntent ??
      (input.purpose === 'SALE' ? PropertyServiceIntent.SALE : PropertyServiceIntent.RENTAL_BROKERAGE);
    const isSale = serviceIntent === PropertyServiceIntent.SALE;
    const isConstruction = serviceIntent === PropertyServiceIntent.CONSTRUCTION;
    const hasMultipleUnits = input.hasMultipleUnits === 'true';
    const monthlyRent =
      isSale
        ? (input.askingPrice ?? input.monthlyRent ?? '0')
        : (input.monthlyRent ?? '0');
    if (isSale) {
      if (!monthlyRent || monthlyRent === '0') {
        throw new BadRequestException('Asking price is required.');
      }
    } else if (!isConstruction && (hasMultipleUnits || (input.units?.length ?? 0) > 0)) {
      if (!input.units?.length) {
        throw new BadRequestException('Add at least one rental unit.');
      }
    } else if (!isConstruction && (!monthlyRent || monthlyRent === '0')) {
      throw new BadRequestException('Monthly rent is required.');
    }
    const property = await this.addProperty(
      principal,
      {
        ownerPartyId: owner.ownerPartyId,
        name: input.name,
        propertyType: input.propertyType,
        location: input.location,
        monthlyRent: monthlyRent === '0' && input.units?.[0]?.monthlyRent
          ? input.units[0].monthlyRent
          : monthlyRent,
        serviceIntent,
        ...(isSale ? { askingPrice: monthlyRent } : {}),
        ...(input.managementFeePercent ? { managementFeePercent: input.managementFeePercent } : {}),
        ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.district ? { district: input.district } : {}),
        ...(input.addressLine1 ? { addressLine1: input.addressLine1 } : {}),
        ...(input.description
          ? {
              description: [
                input.description,
                isSale ? `Asking price: ${monthlyRent}` : null,
                input.bedrooms ? `Bedrooms: ${input.bedrooms}` : null,
                input.bathrooms ? `Bathrooms: ${input.bathrooms}` : null,
                input.area ? `Area: ${input.area}` : null,
                input.landWidth ? `Land width: ${input.landWidth}` : null,
                input.landLength ? `Land length: ${input.landLength}` : null,
              ]
                .filter(Boolean)
                .join('\n'),
            }
          : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.hasMultipleUnits ? { hasMultipleUnits: input.hasMultipleUnits } : {}),
        ...(input.units ? { units: input.units } : {}),
        ...(input.bedrooms ? { bedrooms: input.bedrooms } : {}),
        ...(input.bathrooms ? { bathrooms: input.bathrooms } : {}),
        ...(input.area ? { area: input.area } : {}),
        ...(input.landWidth ? { landWidth: input.landWidth } : {}),
        ...(input.landLength ? { landLength: input.landLength } : {}),
      },
      correlationId,
    );

    return {
      ...property,
      ownerPartyId: owner.ownerPartyId,
      ownerNumber: owner.ownerNumber,
    };
  }

  private async resolvePrimarySpace(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    rentableSpaceId?: string,
  ) {
    if (rentableSpaceId) {
      const space = await this.db.rentableSpace.findFirst({
        where: {
          id: rentableSpaceId,
          propertyId,
          property: { companyId: principal.companyId },
          status: RentableSpaceStatus.ACTIVE,
        },
      });
      if (!space) throw new NotFoundException('Rentable space was not found for this property.');
      return space;
    }
    const space = await this.db.rentableSpace.findFirst({
      where: {
        propertyId,
        property: { companyId: principal.companyId, status: PropertyStatus.ACTIVE },
        status: RentableSpaceStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!space) {
      throw new ConflictException('Activate a rentable space on this property before continuing.');
    }
    return space;
  }

  private async ensurePublishedListing(
    principal: AuthenticatedPrincipal,
    input: {
      propertyName: string;
      rentableSpaceId: string;
      serviceEngagementId: string;
      monthlyRent: string;
      currency?: string;
    },
    correlationId?: string,
  ) {
    const currency = (input.currency ?? 'USD').toUpperCase();
    let listing = await this.db.rentalListing.findFirst({
      where: {
        rentableSpaceId: input.rentableSpaceId,
        serviceEngagementId: input.serviceEngagementId,
        status: { not: ListingStatus.ARCHIVED },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!listing) {
      listing = await this.listings.createRental(
        principal,
        {
          rentableSpaceId: input.rentableSpaceId,
          serviceEngagementId: input.serviceEngagementId,
          title: input.propertyName,
          askingRent: input.monthlyRent,
          currency,
        },
        correlationId,
      );
    } else if (input.monthlyRent) {
      listing = await this.db.rentalListing.update({
        where: { id: listing.id },
        data: { askingRent: new Prisma.Decimal(input.monthlyRent), currency },
      });
    }
    if (listing.status === ListingStatus.DRAFT) {
      try {
        listing = await this.listings.transitionRental(
          principal,
          listing.id,
          ListingStatus.PENDING_REVIEW,
          { expectedVersion: listing.version, reason: 'Submitted from simplified rental start' },
          correlationId,
        );
      } catch {
        return listing;
      }
    }
    if (listing.status === ListingStatus.PENDING_REVIEW || listing.status === ListingStatus.PAUSED) {
      try {
        listing = await this.listings.transitionRental(
          principal,
          listing.id,
          ListingStatus.PUBLISHED,
          { expectedVersion: listing.version, reason: 'Published from simplified rental start' },
          correlationId,
        );
      } catch {
        return listing;
      }
    }
    return listing;
  }

  async startRentalBrokerage(
    principal: AuthenticatedPrincipal,
    input: StartRentalBrokerageDto,
    correlationId?: string,
  ) {
    const property = await this.db.property.findFirst({
      where: { id: input.propertyId, companyId: principal.companyId },
      select: { id: true, status: true, name: true, propertyCode: true },
    });
    if (!property || property.status !== PropertyStatus.ACTIVE) {
      throw new ConflictException('Property must be active before starting rental brokerage.');
    }
    const ownership = await this.db.propertyOwnership.findFirst({
      where: {
        propertyId: input.propertyId,
        ownerPartyId: input.ownerPartyId,
        effectiveTo: null,
      },
    });
    if (!ownership) throw new ConflictException('Owner is not linked to this property.');
    const space = await this.resolvePrimarySpace(
      principal,
      input.propertyId,
      input.rentableSpaceId,
    );
    const effectiveFrom =
      input.effectiveFrom ??
      (await this.businessDate.today(principal.companyId)).toISOString().slice(0, 10);

    const ownerFee = input.fees?.find((fee) => fee.party === 'OWNER');
    const tenantFee = input.fees?.find((fee) => fee.party === 'TENANT');
    const primaryFee = ownerFee ?? tenantFee;
    const commissionMethod =
      primaryFee?.method === 'FIXED'
        ? CommissionMethod.FIXED_AMOUNT
        : CommissionMethod.PERCENT_OF_RENT;
    const commissionPercent =
      primaryFee?.method === 'PERCENT'
        ? primaryFee.amount
        : primaryFee?.method === 'FIXED'
          ? primaryFee.amount
          : (input.commissionPercent ?? '10');
    const feeNotes = JSON.stringify({
      source: 'simplified-rental-brokerage',
      fees: input.fees ?? [
        { party: 'OWNER', method: 'PERCENT', amount: commissionPercent },
      ],
    });

    const engagement = await this.engagements.create(
      principal,
      {
        serviceModel: ServiceModel.RENTAL_BROKERAGE,
        propertyId: input.propertyId,
        rentableSpaceId: space.id,
        effectiveFrom,
        notes: feeNotes,
      },
      correlationId,
    );

    await this.db.$transaction(async (tx) => {
      await this.writeCommercialTerms(tx, engagement.id, new Date(effectiveFrom), {
        commissionPercent,
        commissionMethod,
      });
    });

    const activated = await this.engagements.transition(
      principal,
      engagement.id,
      ServiceEngagementStatus.ACTIVE,
      { version: 1, reason: 'Rental brokerage started' },
      correlationId,
    );

    const listing = await this.ensurePublishedListing(
      principal,
      {
        propertyName: property.name,
        rentableSpaceId: space.id,
        serviceEngagementId: activated.id,
        monthlyRent: input.monthlyRent,
        ...(input.currency ? { currency: input.currency } : {}),
      },
      correlationId,
    );

    const rentalStatus = await this.presentation.resolvePropertyRentalStatus(
      principal,
      property.id,
    );

    return {
      serviceEngagementId: activated.id,
      engagementNumber: activated.engagementNumber,
      propertyId: property.id,
      propertyCode: property.propertyCode,
      propertyName: property.name,
      rentableSpaceId: space.id,
      rentalListingId: listing.id,
      listingNumber: listing.listingNumber,
      monthlyRent: listing.askingRent?.toString() ?? input.monthlyRent,
      commissionPercent,
      fees: input.fees ?? [{ party: 'OWNER', method: 'PERCENT', amount: commissionPercent }],
      rentalStatus,
      status: activated.status,
    };
  }

  async startFullManagement(
    principal: AuthenticatedPrincipal,
    input: StartFullManagementDto,
    correlationId?: string,
  ) {
    const property = await this.db.property.findFirst({
      where: { id: input.propertyId, companyId: principal.companyId },
      select: { id: true, status: true, name: true, propertyCode: true },
    });
    if (!property || property.status !== PropertyStatus.ACTIVE) {
      throw new ConflictException('Property must be active before starting full management.');
    }
    const ownership = await this.db.propertyOwnership.findFirst({
      where: {
        propertyId: input.propertyId,
        ownerPartyId: input.ownerPartyId,
        effectiveTo: null,
      },
    });
    if (!ownership) throw new ConflictException('Owner is not linked to this property.');
    const space = await this.resolvePrimarySpace(
      principal,
      input.propertyId,
      input.rentableSpaceId,
    );

    const feeNotes = JSON.stringify({
      source: 'simplified-full-management',
      managementFeePercent: input.managementFeePercent,
      ...(input.tenantBrokerageFee
        ? {
            tenantBrokerage: {
              method: input.tenantBrokerageMethod ?? 'FIXED',
              amount: input.tenantBrokerageFee,
            },
          }
        : {}),
    });

    const engagement = await this.engagements.create(
      principal,
      {
        serviceModel: ServiceModel.FULL_MANAGEMENT,
        propertyId: input.propertyId,
        rentableSpaceId: space.id,
        effectiveFrom: input.startDate,
        notes: feeNotes,
      },
      correlationId,
    );

    await this.db.$transaction(async (tx) => {
      await this.writeCommercialTerms(tx, engagement.id, new Date(input.startDate), {
        managementFeePercent: input.managementFeePercent,
      });
    });

    const activated = await this.engagements.transition(
      principal,
      engagement.id,
      ServiceEngagementStatus.ACTIVE,
      { version: 1, reason: 'Full management started' },
      correlationId,
    );

    const listing = await this.ensurePublishedListing(
      principal,
      {
        propertyName: property.name,
        rentableSpaceId: space.id,
        serviceEngagementId: activated.id,
        monthlyRent: input.monthlyRent,
        ...(input.currency ? { currency: input.currency } : {}),
      },
      correlationId,
    );

    const rentalStatus = await this.presentation.resolvePropertyRentalStatus(
      principal,
      property.id,
    );

    return {
      serviceEngagementId: activated.id,
      engagementNumber: activated.engagementNumber,
      propertyId: property.id,
      propertyCode: property.propertyCode,
      propertyName: property.name,
      rentableSpaceId: space.id,
      rentalListingId: listing.id,
      listingNumber: listing.listingNumber,
      monthlyRent: listing.askingRent?.toString() ?? input.monthlyRent,
      managementFeePercent: input.managementFeePercent,
      tenantBrokerageFee: input.tenantBrokerageFee ?? null,
      tenantBrokerageMethod: input.tenantBrokerageFee
        ? (input.tenantBrokerageMethod ?? 'FIXED')
        : null,
      startDate: input.startDate,
      rentalStatus,
      status: activated.status,
    };
  }

  async createRentalLease(
    principal: AuthenticatedPrincipal,
    input: CreateRentalLeaseDto,
    correlationId?: string,
  ) {
    const start = new Date(input.leaseStartDate);
    const end = new Date(input.leaseEndDate);
    if (end <= start) {
      throw new BadRequestException('Lease end date must be after the start date.');
    }

    const lead = await this.db.lead.findFirst({
      where: { id: input.leadId, companyId: principal.companyId, intent: LeadIntent.RENT },
    });
    if (!lead) throw new NotFoundException('Rental customer was not found.');
    if (!lead.partyId) {
      throw new ConflictException('This customer needs a saved identity before a lease can be created.');
    }
    this.auth.assertBranchPermission(principal, 'lease.create', lead.responsibleBranchId);

    const property = await this.db.property.findFirst({
      where: { id: input.propertyId, companyId: principal.companyId },
      select: { id: true, name: true, status: true },
    });
    if (!property || property.status !== PropertyStatus.ACTIVE) {
      throw new ConflictException('Choose an active rental property.');
    }

    const space = await this.resolvePrimarySpace(principal, property.id, input.rentableSpaceId);
    const ownership = await this.db.propertyOwnership.findFirst({
      where: { propertyId: property.id, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!ownership) throw new ConflictException('This property has no current owner to act as landlord.');
    if (ownership.ownerPartyId === lead.partyId) {
      throw new ConflictException('A property owner cannot rent their own property.');
    }

    let listing = await this.db.rentalListing.findFirst({
      where: {
        companyId: principal.companyId,
        rentableSpaceId: space.id,
        status: {
          in: [
            ListingStatus.PUBLISHED,
            ListingStatus.PENDING_REVIEW,
            ListingStatus.DRAFT,
            ListingStatus.PAUSED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!listing) {
      const engagement = await this.db.serviceEngagement.findFirst({
        where: {
          companyId: principal.companyId,
          propertyId: property.id,
          status: ServiceEngagementStatus.ACTIVE,
          serviceModel: { in: [ServiceModel.RENTAL_BROKERAGE, ServiceModel.FULL_MANAGEMENT] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!engagement) {
        throw new ConflictException(
          'Start Rental Brokerage or Full Management for this property before creating a lease.',
        );
      }
      listing = await this.ensurePublishedListing(
        principal,
        {
          propertyName: property.name,
          rentableSpaceId: space.id,
          serviceEngagementId: engagement.id,
          monthlyRent: input.monthlyRent,
          ...(input.currency ? { currency: input.currency } : {}),
        },
        correlationId,
      );
    } else if (listing.status !== ListingStatus.PUBLISHED) {
      listing = await this.ensurePublishedListing(
        principal,
        {
          propertyName: property.name,
          rentableSpaceId: space.id,
          serviceEngagementId: listing.serviceEngagementId,
          monthlyRent: input.monthlyRent,
          ...(input.currency ? { currency: input.currency } : {}),
        },
        correlationId,
      );
    }
    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new ConflictException('The property listing must be published before a lease can be created.');
    }
    if (listing.branchId !== lead.responsibleBranchId) {
      throw new ConflictException('The customer and property must belong to the same branch.');
    }

    const completedViewing = await this.db.viewing.findFirst({
      where: {
        companyId: principal.companyId,
        leadId: lead.id,
        status: ViewingStatus.COMPLETED,
        OR: [{ rentalListingId: listing.id }, { rentableSpaceId: space.id }],
      },
      select: { id: true },
    });
    if (!completedViewing) {
      throw new ConflictException(
        'Complete a viewing for this customer and unit before creating the lease. If they are not interested, match another property.',
      );
    }

    let application = await this.db.rentalApplication.findFirst({
      where: { leadId: lead.id, rentalListingId: listing.id, companyId: principal.companyId },
      select: { id: true, status: true, screeningStatus: true, version: true },
    });
    if (application && ['REJECTED', 'WITHDRAWN'].includes(application.status)) {
      throw new ConflictException(
        'This customer already has a closed application for this property. Use a different property or reopen the existing case.',
      );
    }
    const toApplication = (row: {
      id: string;
      status: ApplicationStatus;
      screeningStatus: ScreeningStatus;
      version: number;
    }) => ({
      id: row.id,
      status: row.status,
      screeningStatus: row.screeningStatus,
      version: row.version,
    });
    if (!application) {
      application = toApplication(
        await this.leasing.createApplication(
          principal,
          {
            leadId: lead.id,
            rentalListingId: listing.id,
            applicantPartyId: lead.partyId,
          },
          correlationId,
        ),
      );
    }
    const reason = 'Created from rental lease workspace';
    if (application.status === ApplicationStatus.DRAFT) {
      application = toApplication(
        await this.leasing.transitionApplication(
          principal,
          application.id,
          { status: ApplicationStatus.SUBMITTED, expectedVersion: application.version, reason },
          correlationId,
        ),
      );
    }
    if (
      application.status === ApplicationStatus.SUBMITTED &&
      application.screeningStatus === ScreeningStatus.NOT_STARTED
    ) {
      application = toApplication(
        await this.leasing.recordScreening(
          principal,
          application.id,
          {
            screeningStatus: ScreeningStatus.WAIVED,
            expectedVersion: application.version,
            reason: 'Screening waived for rental lease creation',
          },
          correlationId,
        ),
      );
    }
    if (application.status === ApplicationStatus.SUBMITTED) {
      application = toApplication(
        await this.leasing.transitionApplication(
          principal,
          application.id,
          { status: ApplicationStatus.UNDER_REVIEW, expectedVersion: application.version, reason },
          correlationId,
        ),
      );
    }
    if (application.status === ApplicationStatus.UNDER_REVIEW) {
      if (
        application.screeningStatus !== ScreeningStatus.PASSED &&
        application.screeningStatus !== ScreeningStatus.WAIVED
      ) {
        application = toApplication(
          await this.leasing.recordScreening(
            principal,
            application.id,
            {
              screeningStatus: ScreeningStatus.WAIVED,
              expectedVersion: application.version,
              reason: 'Screening waived for rental lease creation',
            },
            correlationId,
          ),
        );
      }
      application = toApplication(
        await this.leasing.transitionApplication(
          principal,
          application.id,
          { status: ApplicationStatus.APPROVED, expectedVersion: application.version, reason },
          correlationId,
        ),
      );
    }
    if (application.status !== ApplicationStatus.APPROVED) {
      throw new ConflictException('The rental application could not be approved for this lease.');
    }

    await this.leasing.convertTenant(
      principal,
      { applicationId: application.id },
      correlationId,
    );

    const lease = await this.leasing.createLease(
      principal,
      {
        applicationId: application.id,
        serviceEngagementId: listing.serviceEngagementId,
        leaseStartDate: input.leaseStartDate,
        leaseEndDate: input.leaseEndDate,
        rentAmount: input.monthlyRent,
        currency: (input.currency ?? 'USD').toUpperCase(),
        parties: [
          { partyId: lead.partyId, role: LeasePartyRole.TENANT },
          { partyId: ownership.ownerPartyId, role: LeasePartyRole.LANDLORD },
        ],
      },
      correlationId,
    );

    return {
      leaseId: lease.id,
      leaseNumber: lease.leaseNumber,
      applicationId: application.id,
      status: lease.status,
    };
  }
}
