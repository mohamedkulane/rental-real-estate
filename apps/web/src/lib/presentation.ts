export function humanize(value: string | null | undefined): string {
  if (!value) return 'Not set';
  return value
    .toLowerCase()
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDate(value: unknown, includeTime = false): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return 'No date recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date recorded';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function permissionLabel(code: string): string {
  const parts = code.split('.');
  return humanize(parts.slice(-2).join(' '));
}

export function permissionDomain(code: string): string {
  const domain = code.split('.')[0] ?? 'other';
  const mapped: Record<string, string> = {
    organization: 'Organization',
    identity: 'Identity',
    portfolio: 'Portfolio',
    governance: 'Governance',
    party: 'Portfolio',
    owner: 'Portfolio',
  };
  return mapped[domain] ?? humanize(domain);
}

export function statusTone(value: string | boolean | null | undefined) {
  const normalized = typeof value === 'boolean' ? (value ? 'ACTIVE' : 'INACTIVE') : (value ?? '');
  if (/INACTIVE|FAILED|REJECTED|OVERDUE|SUSPENDED|DISABLED|RETIRED/i.test(normalized)) return 'negative';
  if (/ACTIVE|PAID|APPROVED|COMPLETED|HEALTHY/i.test(normalized)) return 'positive';
  if (/PENDING|EXPIR|REVIEW|ATTENTION/i.test(normalized)) return 'warning';
  if (/PROCESSING|ASSIGNED|SCHEDULED/i.test(normalized)) return 'info';
  return 'neutral';
}
