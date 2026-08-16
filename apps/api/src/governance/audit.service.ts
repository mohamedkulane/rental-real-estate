import { uuidv7 } from '@rerms/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface AuditInput {
  actorUserId?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  branchId?: string | null | undefined;
  correlationId?: string | undefined;
  reason?: string | null | undefined;
  before?: Prisma.InputJsonValue | undefined;
  after?: Prisma.InputJsonValue | undefined;
}

const sensitiveKey =
  /password|token|secret|authorization|cookie|valueencrypted|normalizedhash|cipher(?:text)?|authtag|initializationvector|privatekey|apikey|lookupkey/i;

@Injectable()
export class AuditService {
  private sanitize(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
    return this.sanitizeNullable(value) as Prisma.InputJsonValue;
  }

  private sanitizeNullable(value: Prisma.InputJsonValue | null): Prisma.InputJsonValue | null {
    if (Array.isArray(value)) {
      const entries: Prisma.InputJsonArray = value;
      return entries.map((entry: Prisma.InputJsonValue | null) => this.sanitizeNullable(entry));
    }
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value) as Array<[string, Prisma.InputJsonValue | null]>;
      return Object.fromEntries(
        entries.map(([key, entry]) => [
          key,
          sensitiveKey.test(key) ? '[REDACTED]' : this.sanitizeNullable(entry),
        ]),
      );
    }
    return value;
  }

  async write(database: Prisma.TransactionClient, input: AuditInput): Promise<void> {
    await database.auditLog.create({
      data: {
        id: uuidv7(),
        actorUserId: input.actorUserId ?? null,
        effectiveActorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        branchId: input.branchId ?? null,
        correlationId:
          input.correlationId && /^[0-9a-f-]{36}$/i.test(input.correlationId)
            ? input.correlationId
            : null,
        reason: input.reason ?? null,
        beforeSnapshot: input.before === undefined ? Prisma.JsonNull : this.sanitize(input.before),
        afterSnapshot: input.after === undefined ? Prisma.JsonNull : this.sanitize(input.after),
      },
    });
  }
}
