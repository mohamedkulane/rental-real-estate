import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PortalType, Prisma, UserStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { BusinessDateService } from '../common/business-date.service';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { PasswordService } from '../identity/password.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import {
  ChangePortalAccountStatusDto,
  CreatePortalAccountDto,
  ListPortalAccountsQueryDto,
} from './portal.dto';

@Injectable()
export class PortalAdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly businessDate: BusinessDateService,
  ) {}

  private activeInterval(at: Date) {
    return {
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    };
  }

  private partyScopeWhere(
    principal: AuthenticatedPrincipal,
    permission: string,
    at: Date,
  ): Prisma.PartyWhereInput {
    const authorized = this.authorization.authorizedBranchIds(principal, permission);
    if (authorized === null) return { companyId: principal.companyId, employee: { is: null } };
    const branchIds = [...authorized];
    const active = this.activeInterval(at);
    return {
      companyId: principal.companyId,
      employee: { is: null },
      OR: [
        {
          branchAssignments: {
            some: { branchId: { in: branchIds }, ...active },
          },
        },
        {
          propertyOwnerships: {
            some: {
              ...active,
              property: {
                branchAssignments: {
                  some: { branchId: { in: branchIds }, ...active },
                },
              },
            },
          },
        },
      ],
    };
  }

  private async partyScopeBranchIds(companyId: string, partyId: string): Promise<string[]> {
    const at = await this.businessDate.today(companyId);
    const active = this.activeInterval(at);
    const party = await this.database.party.findUniqueOrThrow({
      where: { id: partyId },
      select: {
        branchAssignments: {
          where: active,
          select: { branchId: true },
        },
        propertyOwnerships: {
          where: active,
          select: {
            property: {
              select: {
                branchAssignments: {
                  where: active,
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

  private async assertPortalPermission(
    principal: AuthenticatedPrincipal,
    partyId: string,
    permission: string,
  ): Promise<void> {
    const branchIds = await this.partyScopeBranchIds(principal.companyId, partyId);
    if (!branchIds.length) {
      this.authorization.assertCompanyPermission(principal, permission);
      return;
    }
    this.authorization.assertPermissionAcrossBranches(principal, permission, branchIds);
  }

  async list(principal: AuthenticatedPrincipal, query: ListPortalAccountsQueryDto) {
    const at = await this.businessDate.today(principal.companyId);
    const rows = await this.database.portalAccount.findMany({
      where: {
        companyId: principal.companyId,
        ...(query.portalType ? { portalType: query.portalType } : {}),
        ...(query.status === 'active'
          ? { active: true }
          : query.status === 'inactive'
            ? { active: false }
            : {}),
        party: this.partyScopeWhere(principal, 'portal.account.read', at),
        ...(query.search
          ? {
              OR: [
                { user: { emailNormalized: { contains: query.search, mode: 'insensitive' } } },
                { party: { displayName: { contains: query.search, mode: 'insensitive' } } },
                { party: { partyNumber: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        portalType: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        partyId: true,
        userId: true,
        party: {
          select: {
            id: true,
            displayName: true,
            partyNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            emailNormalized: true,
            status: true,
          },
        },
      },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreatePortalAccountDto,
    correlationId?: string,
  ) {
    const emailNormalized = input.email.trim().toLowerCase();
    const party = await this.database.party.findFirst({
      where: { id: input.partyId, companyId: principal.companyId },
      select: {
        id: true,
        displayName: true,
        employee: { select: { id: true } },
        portalAccount: { select: { id: true } },
        owner: { select: { partyId: true } },
        tenant: { select: { partyId: true } },
      },
    });
    if (!party) throw new NotFoundException('Party record was not found.');
    if (party.employee)
      throw new BadRequestException('Staff employees cannot receive portal login access.');
    if (party.portalAccount)
      throw new BadRequestException('This party already has a portal login account.');
    if (input.portalType === PortalType.OWNER && !party.owner)
      throw new BadRequestException('Portal type OWNER requires an owner profile for this party.');
    if (input.portalType === PortalType.TENANT && !party.tenant)
      throw new BadRequestException('Portal type TENANT requires a tenant profile for this party.');

    await this.assertPortalPermission(principal, party.id, 'portal.account.create');

    const existingUser = await this.database.user.findUnique({
      where: { emailNormalized },
      select: {
        id: true,
        employee: { select: { id: true } },
        portalAccount: { select: { id: true } },
      },
    });
    if (existingUser?.employee)
      throw new BadRequestException('This email is already used by a staff login account.');
    if (existingUser?.portalAccount)
      throw new BadRequestException('This email is already used by another portal login account.');

    const passwordHash = await this.passwords.hash(input.password);
    return this.database.$transaction(async (transaction) => {
      const user =
        existingUser ??
        (await transaction.user.create({
          data: {
            id: uuidv7(),
            emailNormalized,
            passwordHash,
            status: UserStatus.ACTIVE,
          },
        }));

      if (existingUser) {
        await transaction.user.update({
          where: { id: existingUser.id },
          data: { passwordHash, status: UserStatus.ACTIVE },
        });
      }

      const portalAccount = await transaction.portalAccount.create({
        data: {
          id: uuidv7(),
          userId: user.id,
          companyId: principal.companyId,
          partyId: party.id,
          portalType: input.portalType,
          active: true,
        },
        select: {
          id: true,
          portalType: true,
          active: true,
          createdAt: true,
          partyId: true,
          userId: true,
          party: {
            select: {
              id: true,
              displayName: true,
              partyNumber: true,
            },
          },
          user: {
            select: {
              id: true,
              emailNormalized: true,
              status: true,
            },
          },
        },
      });

      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portal.account.created',
        entityType: 'PortalAccount',
        entityId: portalAccount.id,
        correlationId,
        after: {
          partyId: party.id,
          partyDisplayName: party.displayName,
          portalType: input.portalType,
          emailNormalized,
        },
      });

      return portalAccount;
    });
  }

  async changeStatus(
    principal: AuthenticatedPrincipal,
    portalAccountId: string,
    input: ChangePortalAccountStatusDto,
    correlationId?: string,
  ) {
    const portalAccount = await this.database.portalAccount.findFirst({
      where: { id: portalAccountId, companyId: principal.companyId },
      select: { id: true, active: true, userId: true, partyId: true, portalType: true },
    });
    if (!portalAccount) throw new NotFoundException('Portal account was not found.');
    await this.assertPortalPermission(principal, portalAccount.partyId, 'portal.account.update');

    return this.database.$transaction(async (transaction) => {
      const after = await transaction.portalAccount.update({
        where: { id: portalAccount.id },
        data: { active: input.active },
        select: {
          id: true,
          portalType: true,
          active: true,
          updatedAt: true,
          partyId: true,
          userId: true,
          party: {
            select: {
              id: true,
              displayName: true,
              partyNumber: true,
            },
          },
          user: {
            select: {
              id: true,
              emailNormalized: true,
              status: true,
            },
          },
        },
      });

      await transaction.user.update({
        where: { id: portalAccount.userId },
        data: { status: input.active ? UserStatus.ACTIVE : UserStatus.SUSPENDED },
      });

      if (!input.active) {
        await transaction.session.updateMany({
          where: { userId: portalAccount.userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revocationReason: 'Portal account deactivated',
          },
        });
      }

      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: input.active ? 'portal.account.activated' : 'portal.account.deactivated',
        entityType: 'PortalAccount',
        entityId: portalAccount.id,
        correlationId,
        reason: input.reason,
        before: { active: portalAccount.active },
        after: { active: after.active },
      });

      return after;
    });
  }
}
