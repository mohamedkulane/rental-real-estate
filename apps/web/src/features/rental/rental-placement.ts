/** Presentation helpers for the server-authoritative viewing → agreement → lease flow. */

export function isInterestedViewingOutcome(outcome?: string | null): boolean {
  return Boolean(outcome && outcome !== 'NOT_INTERESTED' && outcome.startsWith('INTERESTED'));
}

export function isNotInterestedViewingOutcome(outcome?: string | null): boolean {
  return Boolean(outcome?.toUpperCase().includes('NOT_INTERESTED'));
}

export function viewingInterestLabel(outcome?: string | null): string | null {
  if (!outcome) return null;
  if (outcome.includes('NOT_INTERESTED')) return 'Not interested';
  if (isInterestedViewingOutcome(outcome)) return 'Interested';
  return null;
}

export type PlacementStep = 'viewing' | 'agreement' | 'lease' | 'declined';

export function nextPlacementStep(input: {
  viewingStatus?: string | null;
  viewingOutcome?: string | null;
}): PlacementStep {
  if (isNotInterestedViewingOutcome(input.viewingOutcome)) return 'declined';
  if (input.viewingStatus !== 'COMPLETED') return 'viewing';
  return isInterestedViewingOutcome(input.viewingOutcome) ? 'agreement' : 'viewing';
}
