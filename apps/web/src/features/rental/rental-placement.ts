/** Client-side placement progress for rental match → lease. */

export type PlacementProgress = {
  viewingId?: string;
  agreedRent?: string;
  currency?: string;
  companyFee?: string;
  feeCollected?: boolean;
  declined?: boolean;
};

export function isInterestedViewingOutcome(outcome?: string | null): boolean {
  return Boolean(outcome && outcome !== 'NOT_INTERESTED' && outcome.startsWith('INTERESTED'));
}

export function viewingInterestLabel(outcome?: string | null): string | null {
  if (!outcome) return null;
  if (outcome.includes('NOT_INTERESTED')) return 'Not interested';
  if (isInterestedViewingOutcome(outcome)) return 'Interested';
  return null;
}

function storageKey(leadId: string, listingKey: string) {
  return `rental-placement:${leadId}:${listingKey}`;
}

export function readPlacementProgress(leadId: string, listingKey: string): PlacementProgress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(storageKey(leadId, listingKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlacementProgress;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writePlacementProgress(
  leadId: string,
  listingKey: string,
  patch: PlacementProgress,
): PlacementProgress {
  const next = { ...readPlacementProgress(leadId, listingKey), ...patch };
  window.sessionStorage.setItem(storageKey(leadId, listingKey), JSON.stringify(next));
  return next;
}

export type PlacementStep = 'viewing' | 'negotiate' | 'fees' | 'lease' | 'declined';

export function nextPlacementStep(input: {
  viewingStatus?: string | null;
  progress: PlacementProgress;
}): PlacementStep {
  if (input.progress.declined) return 'declined';
  const viewingDone = input.viewingStatus === 'COMPLETED';
  if (!viewingDone) return 'viewing';
  if (!input.progress.agreedRent?.trim()) return 'negotiate';
  if (!input.progress.feeCollected || !input.progress.companyFee?.trim()) return 'fees';
  return 'lease';
}
