import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CreateSavedViewDto, UpdateSavedViewDto } from './saved-view.dto';

const allowedWorkspaces = new Set([
  'rental-properties',
  'viewings',
  'payments',
  'owner-statements',
  'maintenance',
  'sales-deals',
]);
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);

function validatedFilters(filters: Record<string, unknown>): Prisma.InputJsonObject {
  const serialized = JSON.stringify(filters);
  if (serialized.length > 4096) throw new BadRequestException('Saved filters are too large.');
  const entries = Object.entries(filters);
  if (entries.length > 24) throw new BadRequestException('Saved filters contain too many fields.');
  const output: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) || forbiddenKeys.has(key)) {
      throw new BadRequestException(`Invalid saved filter key: ${key}`);
    }
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      if (typeof value === 'string' && value.length > 500) {
        throw new BadRequestException(`Saved filter ${key} is too long.`);
      }
      output[key] = value as Prisma.InputJsonValue;
      continue;
    }
    if (
      Array.isArray(value) &&
      value.length <= 20 &&
      value.every(
        (item) =>
          item === null ||
          typeof item === 'boolean' ||
          typeof item === 'number' ||
          (typeof item === 'string' && item.length <= 200),
      )
    ) {
      output[key] = value as Prisma.InputJsonArray;
      continue;
    }
    throw new BadRequestException(`Saved filter ${key} must be a scalar or short scalar list.`);
  }
  return output;
}

@Injectable()
export class SavedViewService {
  constructor(private readonly db: DatabaseService) {}

  private assertStaff(principal: AuthenticatedPrincipal) {
    if (principal.kind !== 'STAFF')
      throw new ForbiddenException('Saved Views are for staff users.');
  }

  private assertWorkspace(workspace: string) {
    if (!allowedWorkspaces.has(workspace)) throw new BadRequestException('Unsupported workspace.');
  }

  list(principal: AuthenticatedPrincipal, workspace: string) {
    this.assertStaff(principal);
    this.assertWorkspace(workspace);
    return this.db.savedView.findMany({
      where: { companyId: principal.companyId, userId: principal.userId, workspace },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      select: { id: true, workspace: true, name: true, filters: true, updatedAt: true },
    });
  }

  async create(principal: AuthenticatedPrincipal, input: CreateSavedViewDto) {
    this.assertStaff(principal);
    this.assertWorkspace(input.workspace);
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Saved View name is required.');
    try {
      return await this.db.savedView.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          userId: principal.userId,
          workspace: input.workspace,
          name,
          filters: validatedFilters(input.filters),
        },
        select: { id: true, workspace: true, name: true, filters: true, updatedAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A Saved View with this name already exists.');
      }
      throw error;
    }
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateSavedViewDto) {
    this.assertStaff(principal);
    const existing = await this.db.savedView.findFirst({
      where: { id, companyId: principal.companyId, userId: principal.userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Saved View not found.');
    const name = input.name?.trim();
    if (input.name !== undefined && !name)
      throw new BadRequestException('Saved View name is required.');
    try {
      return await this.db.savedView.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(input.filters ? { filters: validatedFilters(input.filters) } : {}),
        },
        select: { id: true, workspace: true, name: true, filters: true, updatedAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A Saved View with this name already exists.');
      }
      throw error;
    }
  }

  async remove(principal: AuthenticatedPrincipal, id: string) {
    this.assertStaff(principal);
    const deleted = await this.db.savedView.deleteMany({
      where: { id, companyId: principal.companyId, userId: principal.userId },
    });
    if (deleted.count !== 1) throw new NotFoundException('Saved View not found.');
    return { success: true as const };
  }
}
