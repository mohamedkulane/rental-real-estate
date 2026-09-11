import type { LeadStage } from './crm-types';

export type WorkspaceState = 'loading' | 'error' | 'empty' | 'filtered-empty' | 'populated';

export function crmWorkspaceState(input: {
  loading: boolean;
  error: boolean;
  itemCount: number;
  filtered: boolean;
}): WorkspaceState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.itemCount) return 'populated';
  return input.filtered ? 'filtered-empty' : 'empty';
}

export function appendCursor(
  cursors: Array<string | undefined>,
  page: number,
  nextCursor: string,
): Array<string | undefined> {
  const next = cursors.slice(0, page + 1);
  next[page + 1] = nextCursor;
  return next;
}

export function listPath(
  resource: 'leads' | 'pipeline' | 'follow-ups' | 'lead-sources',
  filters: Record<string, string>,
  cursor?: string,
): string {
  const params = new URLSearchParams({ limit: '25' });
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });
  if (cursor) params.set('cursor', cursor);
  return `/crm/${resource}?${params.toString()}`;
}

export function legalStageActions(stage: LeadStage, intent: string): string[] {
  if (stage === 'NEW') return ['contacted', 'lost'];
  if (stage === 'CONTACTED') return ['qualified', 'lost'];
  if (stage === 'QUALIFIED')
    return intent === 'RENT' || intent === 'BUY'
      ? ['matching', 'nurturing', 'converted', 'lost']
      : ['nurturing', 'converted', 'lost'];
  if (stage === 'MATCHING') return ['nurturing', 'converted', 'lost'];
  if (stage === 'NURTURING')
    return intent === 'RENT' || intent === 'BUY'
      ? ['qualified', 'matching', 'converted', 'lost']
      : ['qualified', 'converted', 'lost'];
  return [];
}

export const stageActionLabel = (action: string): string =>
  ({
    contacted: 'Mark Contacted',
    qualified: 'Mark Qualified',
    matching: 'Move to Matching',
    nurturing: 'Move to Nurturing',
    converted: 'Close as Converted',
    lost: 'Close as Lost',
  })[action] ?? action;
