import type { Prisma } from '@prisma/client';

// Internal orchestration hook, never accepted as HTTP input. The canonical
// command and its durable workflow checkpoint must commit or roll back together.
export type CommandCheckpoint = (
  transaction: Prisma.TransactionClient,
  entityId: string,
) => Promise<void>;
