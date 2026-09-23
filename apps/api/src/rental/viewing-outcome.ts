/** Viewing interest outcome helpers shared by agreement / lease gates. */

export function normalizeViewingOutcome(outcome: string | null | undefined): string {
  return outcome?.trim().toUpperCase() ?? '';
}

/** True only for explicit interest — never matches NOT_INTERESTED. */
export function isInterestedViewingOutcome(outcome: string | null | undefined): boolean {
  const value = normalizeViewingOutcome(outcome);
  if (!value || value.includes('NOT_INTERESTED')) return false;
  return value === 'INTERESTED' || value.startsWith('INTERESTED');
}

export function isNotInterestedViewingOutcome(outcome: string | null | undefined): boolean {
  const value = normalizeViewingOutcome(outcome);
  return value.includes('NOT_INTERESTED');
}

/** Prisma filter: completed viewing marked INTERESTED (exact, case-insensitive). */
export const interestedViewingOutcomeFilter = {
  equals: 'INTERESTED' as const,
  mode: 'insensitive' as const,
};
