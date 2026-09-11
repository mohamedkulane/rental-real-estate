export type EngagementFilters = {
  search?: string;
  propertyId?: string;
  rentableSpaceId?: string;
  serviceModel?: string;
  status?: string;
  period?: string;
  branchId?: string;
};

export type EngagementWorkspaceState =
  'loading' | 'error' | 'empty' | 'filtered-empty' | 'populated';

export function engagementRequestPath(
  filters: EngagementFilters,
  cursor?: string,
  limit = 10,
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) params.set(key, value.trim());
  }
  if (cursor) params.set('cursor', cursor);
  return `/service-engagements?${params.toString()}`;
}

export function engagementWorkspaceState(input: {
  loading: boolean;
  error: boolean;
  itemCount: number;
  filtered: boolean;
}): EngagementWorkspaceState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.itemCount > 0) return 'populated';
  return input.filtered ? 'filtered-empty' : 'empty';
}

export function appendCursor(
  cursors: Array<string | undefined>,
  page: number,
  nextCursor: string,
): Array<string | undefined> {
  return [...cursors.slice(0, page + 1), nextCursor];
}
