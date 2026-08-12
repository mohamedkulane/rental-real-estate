import { uuidv7 } from '@rerms/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnerStatus, PartyKind, Prisma } from '@prisma/client';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  CreateOwnerDto,
  CreatePartyDto,
  UpdateOwnerDto,
  UpdatePartyDto,
} from './portfolio.dto';
import { PartyCryptoService } from './party-crypto.service';

@Injectable()
export class PartyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: PartyCryptoService,
    private readonly audit: AuditService,
    private readonly authorization: AuthorizationService,
  ) {}

  private activeInterval() {
    const at = new Date();
    return {
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    };
  }

  private partyScopeWhere(
    principal: AuthenticatedPrincipal,
    permission: string,
  ): Prisma.PartyWhereInput {
    const authorized = this.authorization.authorizedBranchIds(principal, permission);
    if (authorized === null) return { companyId: principal.companyId, employee: { is: null } };
    const branchIds = [...authorized];
    return {
      companyId: principal.companyId,
      employee: { is: null },
      OR: [
        {
          branchAssignments: {
            some: { branchId: { in: branchIds }, ...this.activeInterval() },
          },
        },
        {
          propertyOwnerships: {
            some: {
              ...this.activeInterval(),
              property: {
                branchAssignments: {
                  some: { branchId: { in: branchIds }, ...this.activeInterval() },
                },
              },
            },
          },
        },
      ],
    };
  }

  private async assertBusinessParty(
    principal: AuthenticatedPrincipal,
    partyId: string,
  ): Promise<void> {
    const party = await this.database.party.findFirst({
      where: { id: partyId, companyId: principal.companyId },
      select: { employee: { select: { id: true } } },
    });
    if (!party) throw new NotFoundException('Party record was not found.');
    if (party.employee)
      throw new BadRequestException(
        'Employees are staff identities and cannot be used as business parties or owners.',
      );
  }

  private async partyScopeBranchIds(partyId: string): Promise<string[]> {
    const party = await this.database.party.findUniqueOrThrow({
      where: { id: partyId },
      select: {
        branchAssignments: {
          where: this.activeInterval(),
          select: { branchId: true },
        },
        propertyOwnerships: {
          where: this.activeInterval(),
          select: {
            property: {
              select: {
                branchAssignments: {
                  where: this.activeInterval(),
                  select: { branchId: true },
                },
              },
            },
          },
        },
      },
    });
    return [
      ...new Set([
        ...party.branchAssignments.map((assignment) => assignment.branchId),
        ...party.propertyOwnerships.flatMap((ownership) =>
          ownership.property.branchAssignments.map((assignment) => assignment.branchId),
        ),
      ]),
    ];
  }

  private async assertPartyReadable(
    principal: AuthenticatedPrincipal,
    partyId: string,
    permission: string,
  ): Promise<string[]> {
    await this.assertBusinessParty(principal, partyId);
    const branchIds = await this.partyScopeBranchIds(partyId);
    if (this.authorization.canPerformCompanyWide(principal, permission)) return branchIds;
    if (
      !branchIds.some((branchId) =>
        this.authorization.canPerformInBranch(principal, permission, branchId),
      )
    )
      throw new ForbiddenException('This record is outside your authorized branch scope.');
    return branchIds;
  }

  private async assertPartyPermission(
    principal: AuthenticatedPrincipal,
    partyId: string,
    permission: string,
  ): Promise<string[]> {
    await this.assertBusinessParty(principal, partyId);
    const branchIds = await this.partyScopeBranchIds(partyId);
    if (!branchIds.length) {
      this.authorization.assertCompanyPermission(principal, permission);
      return branchIds;
    }
    this.authorization.assertPermissionAcrossBranches(principal, permission, branchIds);
    return branchIds;
  }

  private maskContact(value: string, type: string): string {
    if (type === 'EMAIL') {
      const [name, domain] = value.split('@');
      return domain ? (name?.slice(0, 2) ?? '') + '***@' + domain : '***';
    }
    const visible = value.slice(-4);
    return visible ? '***' + visible : '***';
  }

  list(principal: AuthenticatedPrincipal) {
    const active = this.activeInterval();
    return this.database.party
      .findMany({
        where: this.partyScopeWhere(principal, 'party.read'),
        include: {
          person: true,
          organization: true,
          owner: true,
          contacts: true,
          addresses: true,
          branchAssignments: { where: active, select: { branchId: true } },
          propertyOwnerships: {
            where: active,
            select: {
              property: {
                select: {
                  branchAssignments: { where: active, select: { branchId: true } },
                },
              },
            },
          },
        },
        orderBy: { partyNumber: 'asc' },
      })
      .then((parties) =>
        parties.map(({ branchAssignments, propertyOwnerships, ...party }) => ({
          ...party,
          scopeBranchIds: [
            ...new Set([
              ...branchAssignments.map((assignment) => assignment.branchId),
              ...propertyOwnerships.flatMap((ownership) =>
                ownership.property.branchAssignments.map((assignment) => assignment.branchId),
              ),
            ]),
          ],
          contacts: party.contacts.map(({ valueEncrypted, normalizedHash, ...contact }) => {
            void normalizedHash;
            return {
              ...contact,
              value: this.maskContact(this.crypto.decrypt(valueEncrypted), contact.type),
              masked: true,
            };
          }),
        })),
      );
  }

  async get(principal: AuthenticatedPrincipal, partyId: string) {
    const scopeBranchIds = await this.assertPartyReadable(principal, partyId, 'party.read');
    const party = await this.database.party.findFirstOrThrow({
      where: { id: partyId, companyId: principal.companyId, employee: { is: null } },
      include: { person: true, organization: true, owner: true, contacts: true, addresses: true },
    });
    const canReadContacts =
      this.authorization.canPerformCompanyWide(principal, 'party.contact.read') ||
      scopeBranchIds.some((branchId) =>
        this.authorization.canPerformInBranch(principal, 'party.contact.read', branchId),
      );
    return {
      ...party,
      scopeBranchIds,
      contacts: party.contacts.map(({ valueEncrypted, normalizedHash, ...contact }) => {
        void normalizedHash;
        return {
          ...contact,
          value: canReadContacts
            ? this.crypto.decrypt(valueEncrypted)
            : this.maskContact(this.crypto.decrypt(valueEncrypted), contact.type),
          masked: !canReadContacts,
        };
      }),
    };
  }

  async create(principal: AuthenticatedPrincipal, input: CreatePartyDto, correlationId?: string) {
    this.authorization.assertBranchPermission(principal, 'party.create', input.branchId);
    if (input.kind === PartyKind.PERSON && (!input.person || input.organization))
      throw new BadRequestException('PERSON requires only a person profile.');
    if (input.kind === PartyKind.ORGANIZATION && (!input.organization || input.person))
      throw new BadRequestException('ORGANIZATION requires only an organization profile.');
    return this.database.$transaction(async (transaction) => {
      const party = await transaction.party.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          partyNumber:
            input.partyNumber?.trim().toUpperCase() ??
            (await nextRecordNumber(transaction, 'PARTY')),
          kind: input.kind,
          displayName: input.displayName.trim(),
          branchAssignments: {
            create: {
              id: uuidv7(),
              branchId: input.branchId,
              effectiveFrom: new Date(),
            },
          },
          ...(input.person
            ? {
                person: {
                  create: {
                    givenName: input.person.givenName,
                    familyName: input.person.familyName,
                    preferredName: input.person.preferredName ?? null,
                    birthDate: input.person.birthDate ? new Date(input.person.birthDate) : null,
                    nationalityCode: input.person.nationalityCode?.toUpperCase() ?? null,
                  },
                },
              }
            : {}),
          ...(input.organization
            ? {
                organization: {
                  create: {
                    legalName: input.organization.legalName,
                    tradingName: input.organization.tradingName ?? null,
                    registrationNumber: input.organization.registrationNumber ?? null,
                    contactPersonName: input.organization.contactPersonName ?? null,
                  },
                },
              }
            : {}),
          ...(input.contacts?.length
            ? {
                contacts: {
                  create: input.contacts.map((contact) => ({
                    id: uuidv7(),
                    type: contact.type,
                    valueEncrypted: this.crypto.encrypt(contact.value),
                    normalizedHash: this.crypto.normalizedHash(contact.value),
                    primary: contact.primary ?? false,
                  })),
                },
              }
            : {}),
          ...(input.addresses?.length
            ? {
                addresses: {
                  create: input.addresses.map((address) => ({
                    id: uuidv7(),
                    type: address.type ?? 'PRIMARY',
                    line1: address.line1,
                    city: address.city ?? null,
                    countryCode: address.countryCode.toUpperCase(),
                  })),
                },
              }
            : {}),
        },
        include: { person: true, organization: true, contacts: true, addresses: true },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'party.created',
        entityType: 'Party',
        entityId: party.id,
        branchId: input.branchId,
        correlationId,
        after: { partyNumber: party.partyNumber, kind: party.kind, displayName: party.displayName },
      });
      return {
        ...party,
        contacts: party.contacts.map((contact) => ({
          id: contact.id,
          partyId: contact.partyId,
          type: contact.type,
          primary: contact.primary,
        })),
      };
    });
  }

  async update(
    principal: AuthenticatedPrincipal,
    partyId: string,
    input: UpdatePartyDto,
    correlationId?: string,
  ) {
    const branchIds = await this.assertPartyPermission(principal, partyId, 'party.update');
    return this.database.$transaction(async (transaction) => {
      const { person, organization, contacts, addresses, ...partyChanges } = input;
      const before = await transaction.party.findFirstOrThrow({
        where: { id: partyId, companyId: principal.companyId, employee: { is: null } },
        include: {
          person: true,
          organization: true,
          contacts: { select: { id: true } },
          addresses: { select: { id: true } },
        },
      });
      if (person && before.kind !== PartyKind.PERSON)
        throw new BadRequestException('Only a Person record can have person details.');
      if (organization && before.kind !== PartyKind.ORGANIZATION)
        throw new BadRequestException('Only an Organization record can have organization details.');

      await transaction.party.update({ where: { id: partyId }, data: partyChanges });
      if (person)
        await transaction.personProfile.upsert({
          where: { partyId },
          update: {
            givenName: person.givenName,
            familyName: person.familyName,
            preferredName: person.preferredName ?? null,
            birthDate: person.birthDate ? new Date(person.birthDate) : null,
            nationalityCode: person.nationalityCode?.toUpperCase() ?? null,
          },
          create: {
            partyId,
            givenName: person.givenName,
            familyName: person.familyName,
            preferredName: person.preferredName ?? null,
            birthDate: person.birthDate ? new Date(person.birthDate) : null,
            nationalityCode: person.nationalityCode?.toUpperCase() ?? null,
          },
        });
      if (organization)
        await transaction.organizationProfile.upsert({
          where: { partyId },
          update: {
            legalName: organization.legalName,
            tradingName: organization.tradingName ?? null,
            registrationNumber: organization.registrationNumber ?? null,
            contactPersonName: organization.contactPersonName ?? null,
          },
          create: {
            partyId,
            legalName: organization.legalName,
            tradingName: organization.tradingName ?? null,
            registrationNumber: organization.registrationNumber ?? null,
            contactPersonName: organization.contactPersonName ?? null,
          },
        });
      if (contacts !== undefined) {
        await transaction.contactPoint.deleteMany({ where: { partyId } });
        if (contacts.length)
          await transaction.contactPoint.createMany({
            data: contacts.map((contact) => ({
              id: uuidv7(),
              partyId,
              type: contact.type,
              valueEncrypted: this.crypto.encrypt(contact.value),
              normalizedHash: this.crypto.normalizedHash(contact.value),
              primary: contact.primary ?? false,
            })),
          });
      }
      if (addresses !== undefined) {
        await transaction.address.deleteMany({ where: { partyId } });
        if (addresses.length)
          await transaction.address.createMany({
            data: addresses.map((address) => ({
              id: uuidv7(),
              partyId,
              type: address.type ?? 'PRIMARY',
              line1: address.line1,
              city: address.city ?? null,
              countryCode: address.countryCode.toUpperCase(),
            })),
          });
      }
      const after = await transaction.party.findUniqueOrThrow({
        where: { id: partyId },
        include: {
          person: true,
          organization: true,
          contacts: { select: { id: true, type: true, primary: true } },
          addresses: true,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'party.updated',
        entityType: 'Party',
        entityId: partyId,
        branchId: branchIds.length === 1 ? branchIds[0] : null,
        correlationId,
        before: {
          displayName: before.displayName,
          active: before.active,
          contactCount: before.contacts.length,
          addressCount: before.addresses.length,
        },
        after: {
          displayName: after.displayName,
          active: after.active,
          contactCount: after.contacts.length,
          addressCount: after.addresses.length,
        },
      });
      return after;
    });
  }

  listOwners(principal: AuthenticatedPrincipal) {
    const active = this.activeInterval();
    return this.database.ownerProfile
      .findMany({
        where: { party: this.partyScopeWhere(principal, 'owner.read') },
        include: {
          party: {
            include: {
              person: true,
              organization: true,
              branchAssignments: { where: active, select: { branchId: true } },
              propertyOwnerships: {
                where: active,
                select: {
                  property: {
                    select: {
                      branchAssignments: { where: active, select: { branchId: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { ownerNumber: 'asc' },
      })
      .then((owners) =>
        owners.map(({ party, ...owner }) => {
          const { branchAssignments, propertyOwnerships, ...partyRecord } = party;
          return {
            ...owner,
            party: partyRecord,
            scopeBranchIds: [
              ...new Set([
                ...branchAssignments.map((assignment) => assignment.branchId),
                ...propertyOwnerships.flatMap((ownership) =>
                  ownership.property.branchAssignments.map((assignment) => assignment.branchId),
                ),
              ]),
            ],
          };
        }),
      );
  }

  async getOwner(principal: AuthenticatedPrincipal, partyId: string) {
    const scopeBranchIds = await this.assertPartyReadable(principal, partyId, 'owner.read');
    const owner = await this.database.ownerProfile.findFirstOrThrow({
      where: { partyId, party: { companyId: principal.companyId } },
      include: { party: { include: { person: true, organization: true } } },
    });
    const ownerships = await this.database.propertyOwnership.findMany({
      where: { ownerPartyId: partyId },
      include: {
        property: {
          include: {
            branchAssignments: { include: { branch: true } },
          },
        },
        entitlements: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    const allowed = ownerships.filter((ownership) =>
      ownership.property.branchAssignments.some(
        (assignment) =>
          assignment.effectiveFrom <= new Date() &&
          (!assignment.effectiveTo || new Date() < assignment.effectiveTo) &&
          this.authorization.canPerformInBranch(principal, 'owner.read', assignment.branchId),
      ),
    );
    return { ...owner, scopeBranchIds, ownerships: allowed };
  }

  async createOwner(
    principal: AuthenticatedPrincipal,
    input: CreateOwnerDto,
    correlationId?: string,
  ) {
    const branchIds = await this.assertPartyPermission(principal, input.partyId, 'owner.create');
    return this.database.$transaction(async (transaction) => {
      const party = await transaction.party.findFirstOrThrow({
        where: { id: input.partyId, companyId: principal.companyId },
      });
      const owner = await transaction.ownerProfile.create({
        data: {
          partyId: party.id,
          ownerNumber:
            input.ownerNumber?.trim().toUpperCase() ??
            (await nextRecordNumber(transaction, 'OWNER')),
          status: input.status ?? OwnerStatus.PROSPECTIVE,
          communicationPreference: input.communicationPreference ?? null,
          notes: input.notes ?? null,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'owner.created',
        entityType: 'OwnerProfile',
        entityId: owner.partyId,
        branchId: branchIds.length === 1 ? branchIds[0] : null,
        correlationId,
        after: { ownerNumber: owner.ownerNumber, status: owner.status },
      });
      return owner;
    });
  }

  async updateOwner(
    principal: AuthenticatedPrincipal,
    partyId: string,
    input: UpdateOwnerDto,
    correlationId?: string,
  ) {
    const branchIds = await this.assertPartyPermission(principal, partyId, 'owner.update');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.ownerProfile.findFirstOrThrow({
        where: { partyId, party: { companyId: principal.companyId } },
      });
      const after = await transaction.ownerProfile.update({ where: { partyId }, data: input });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'owner.updated',
        entityType: 'OwnerProfile',
        entityId: partyId,
        branchId: branchIds.length === 1 ? branchIds[0] : null,
        correlationId,
        before: { status: before.status, communicationPreference: before.communicationPreference },
        after: { status: after.status, communicationPreference: after.communicationPreference },
      });
      return after;
    });
  }
}
