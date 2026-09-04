export type NavigationItem = {
  key: string;
  label: string;
  onSelect?: () => void;
  children?: NavigationItem[];
};

export const startNewDestinations = [
  { key: 'start:add-lead', label: 'Add Lead', description: 'Capture a new CRM enquiry and intent.', href: '/crm/leads/new', permission: 'crm.lead.create' },
] as const;

export function startNewNavigation(permissions: string[], navigate: (href: string) => void): NavigationItem[] {
  return startNewDestinations.filter((destination) => permissions.includes(destination.permission)).map((destination) => ({
    key: destination.key, label: destination.label, onSelect: () => navigate(destination.href),
  }));
}

export const crmDestinations = [
  { key: 'crm:leads', label: 'Lead Register', href: '/crm/leads', permission: 'crm.lead.read' },
  { key: 'crm:pipeline', label: 'Pipeline', href: '/crm/pipeline', permission: 'crm.lead.read' },
  {
    key: 'crm:follow-ups',
    label: 'Follow-ups',
    href: '/crm/follow-ups',
    permission: 'crm.followup.read',
  },
  {
    key: 'crm:sources',
    label: 'Lead Sources',
    href: '/crm/lead-sources',
    permission: 'crm.source.manage',
  },
] as const;

export function crmNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return crmDestinations
    .filter(
      (destination) =>
        permissions.includes(destination.permission) &&
        (destination.key !== 'crm:follow-ups' || permissions.includes('crm.lead.read')),
    )
    .map((destination) => ({
      key: destination.key,
      label: destination.label,
      onSelect: () => navigate(destination.href),
    }));
}

export function expandedParentForActive(
  items: NavigationItem[],
  activeItem: string | undefined,
): string | undefined {
  if (!activeItem) return undefined;
  return items.find((item) => item.children?.some((child) => child.key === activeItem))?.key;
}

export function nextExpandedParent(
  current: string | undefined,
  requested: string,
): string | undefined {
  return current === requested ? undefined : requested;
}

export function navigationItemIsActive(
  item: NavigationItem,
  activeItem: string | undefined,
): boolean {
  return (
    item.key === activeItem || Boolean(item.children?.some((child) => child.key === activeItem))
  );
}
