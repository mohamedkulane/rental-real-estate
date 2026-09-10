export type NavigationItem = {
  key: string;
  label: string;
  onSelect?: () => void;
  children?: NavigationItem[];
};

export type SidebarGroup = {
  id: string;
  title: string;
  items: NavigationItem[];
};

export const startNewDestinations = [
  {
    key: 'start:add-lead',
    label: 'Add Lead',
    description: 'Capture a new CRM enquiry and intent.',
    href: '/crm/leads/new',
    permission: 'crm.lead.create',
  },
  {
    key: 'start:property-onboarding',
    label: 'Onboard Property',
    description: 'Guide owner, property, structure, and document setup.',
    href: '/workflows/new?type=PROPERTY_ONBOARDING',
    permission: 'workflow.draft.update',
  },
  {
    key: 'start:rental-brokerage',
    label: 'Start Rental Brokerage',
    description: 'Prepare an authorized property or space for rental marketing.',
    href: '/workflows/new?type=RENTAL_BROKERAGE',
    permission: 'workflow.draft.update',
  },
  {
    key: 'start:full-management',
    label: 'Start Full Management',
    description: 'Connect a managed property to its operational authority.',
    href: '/workflows/new?type=FULL_MANAGEMENT',
    permission: 'workflow.draft.update',
  },
  {
    key: 'start:property-sale',
    label: 'Start Property Sale',
    description: 'Prepare an authorized property for sale marketing.',
    href: '/workflows/new?type=PROPERTY_SALE',
    permission: 'workflow.draft.update',
  },
] as const;

export function startNewNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return startNewDestinations
    .filter((destination) => permissions.includes(destination.permission))
    .map((destination) => ({
      key: destination.key,
      label: destination.label,
      onSelect: () => navigate(destination.href),
    }));
}

const crmChildDestinations = [
  { key: 'crm:leads', label: 'Leads', href: '/crm/leads', permission: 'crm.lead.read' },
  {
    key: 'crm:pipeline',
    label: 'Opportunities',
    href: '/crm/pipeline',
    permission: 'crm.lead.read',
  },
  {
    key: 'crm:follow-ups',
    label: 'Follow-Ups',
    href: '/crm/follow-ups',
    permission: 'crm.followup.read',
    alsoRequires: 'crm.lead.read' as const,
  },
  {
    key: 'crm:sources',
    label: 'Lead Sources',
    href: '/crm/lead-sources',
    permission: 'crm.source.manage',
  },
] as const;

/** @deprecated Prefer customersNavigation for sidebar IA. Kept for route-level tests. */
export const crmDestinations = [
  { key: 'crm:leads', label: 'Lead Register', href: '/crm/leads', permission: 'crm.lead.read' },
  {
    key: 'crm:rental-leads',
    label: 'Rental Leads',
    href: '/crm/leads?intent=RENT',
    permission: 'crm.lead.read',
  },
  {
    key: 'crm:buyer-leads',
    label: 'Buyer Leads',
    href: '/crm/leads?intent=BUY',
    permission: 'crm.lead.read',
  },
  {
    key: 'crm:seller-leads',
    label: 'Seller Leads',
    href: '/crm/leads?intent=SELL',
    permission: 'crm.lead.read',
  },
  {
    key: 'crm:construction-enquiries',
    label: 'Construction Enquiries',
    href: '/crm/leads?intent=CONSTRUCTION_SERVICE',
    permission: 'crm.lead.read',
  },
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
  { key: 'viewings', label: 'Viewings', href: '/crm/viewings', permission: 'viewing.read' },
] as const;

export const workflowDestinations = [
  {
    key: 'incomplete-work',
    label: 'Incomplete Work',
    href: '/workflows',
    permission: 'workflow.draft.read',
  },
] as const;

export const marketingDestinations = [
  {
    key: 'rental-listings',
    label: 'Rental Listings',
    href: '/marketing/rental-listings',
    permission: 'listing.read',
  },
  {
    key: 'sale-listings',
    label: 'Sale Listings',
    href: '/marketing/sale-listings',
    permission: 'listing.read',
  },
] as const;

export const leasingDestinations = [
  {
    key: 'applications',
    label: 'Applications',
    href: '/leasing/applications',
    permission: 'application.read',
  },
  {
    key: 'reservations',
    label: 'Reservations',
    href: '/leasing/reservations',
    permission: 'reservation.read',
  },
  { key: 'tenants', label: 'Tenants', href: '/leasing/tenants', permission: 'tenant.read' },
  { key: 'leases', label: 'Lease Contracts', href: '/leasing/leases', permission: 'lease.read' },
  { key: 'renewals', label: 'Renewals', href: '/leasing/renewals', permission: 'renewal.read' },
  { key: 'move-ins', label: 'Move-In', href: '/leasing/move-ins', permission: 'move-in.read' },
] as const;

export const rentalOperationsDestinations = [
  marketingDestinations[0],
  {
    key: 'start:rental-brokerage',
    label: 'Rental Brokerage',
    href: '/workflows/new?type=RENTAL_BROKERAGE',
    permission: 'workflow.draft.update',
  },
  {
    key: 'start:full-management',
    label: 'Full Management',
    href: '/workflows/new?type=FULL_MANAGEMENT',
    permission: 'workflow.draft.update',
  },
  ...leasingDestinations,
] as const;

export const salesOperationsDestinations = [
  marketingDestinations[1],
  {
    key: 'start:property-sale',
    label: 'Property Sale',
    href: '/workflows/new?type=PROPERTY_SALE',
    permission: 'workflow.draft.update',
  },
] as const;

export const financeDestinations = [] as const;

export const reportingDestinations = [
  {
    key: 'audit',
    label: 'Audit Log',
    href: '/admin?section=audit',
    permission: 'governance.audit.read',
  },
] as const;

export const projectsDestinations = [
  {
    key: 'projects:construction',
    label: 'Construction Enquiries',
    href: '/crm/leads?intent=CONSTRUCTION_SERVICE',
    permission: 'crm.lead.read',
  },
] as const;

const PROPERTY_NAV_KEYS = new Set(['parties', 'owners', 'properties', 'spaces', 'amenities']);

const ACTIVE_ITEM_ALIASES: Record<string, string[]> = {
  'service-engagements': ['service-engagements', 'engagement-register'],
  'projects:construction': ['projects:construction', 'crm:construction-enquiries'],
  'incomplete-work': ['incomplete-work', 'workflow-new'],
  'crm:leads': ['crm:leads', 'crm:rental-leads', 'crm:buyer-leads', 'crm:seller-leads'],
};

export function normalizeActiveItem(activeItem: string | undefined): string | undefined {
  if (!activeItem) return undefined;
  for (const [canonical, aliases] of Object.entries(ACTIVE_ITEM_ALIASES)) {
    if (aliases.includes(activeItem)) return canonical;
  }
  return activeItem;
}

export function authorizedTaskNavigation(
  destinations: ReadonlyArray<{ key: string; label: string; href: string; permission: string }>,
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return destinations
    .filter((destination) => permissions.includes(destination.permission))
    .map((destination) => ({
      key: destination.key,
      label: destination.label,
      onSelect: () => navigate(destination.href),
    }));
}

/** Flat CRM list for legacy callers. */
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

function collapsibleWhenChildren(
  key: string,
  label: string,
  children: NavigationItem[],
): NavigationItem[] {
  return children.length ? [{ key, label, children }] : [];
}

export function customersNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  const children = crmChildDestinations
    .filter((destination) => {
      if (!permissions.includes(destination.permission)) return false;
      if ('alsoRequires' in destination && destination.alsoRequires) {
        return permissions.includes(destination.alsoRequires);
      }
      return true;
    })
    .map((destination) => ({
      key: destination.key,
      label: destination.label,
      onSelect: () => navigate(destination.href),
    }));
  return collapsibleWhenChildren('crm', 'CRM', children);
}

export function companyNavigation(
  permissions: string[],
  navigate: (href: string) => void,
  overrides?: {
    organization?: NavigationItem[];
    administration?: NavigationItem[];
  },
): NavigationItem[] {
  const defaults = [
    {
      key: 'company',
      label: 'Company Profile',
      href: '/admin?section=company',
      permission: 'organization.company.read',
    },
    {
      key: 'branches',
      label: 'Branches',
      href: '/admin?section=branches',
      permission: 'organization.branch.read',
    },
    {
      key: 'employees',
      label: 'Employees',
      href: '/admin?section=employees',
      permission: 'identity.employee.read',
    },
    {
      key: 'users',
      label: 'User Accounts',
      href: '/admin?section=users',
      permission: 'identity.user.read',
    },
    {
      key: 'roles',
      label: 'Roles & Permissions',
      href: '/admin?section=roles',
      permission: 'identity.role.read',
    },
  ] as const;

  const merged = [...(overrides?.organization ?? []), ...(overrides?.administration ?? [])];
  if (merged.length) {
    return defaults
      .map((entry) => merged.find((item) => item.key === entry.key))
      .filter((item): item is NavigationItem => Boolean(item));
  }

  return defaults
    .filter((entry) => permissions.includes(entry.permission))
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      onSelect: () => navigate(entry.href),
    }));
}

export function propertiesNavigation(
  permissions: string[],
  navigate: (href: string) => void,
  override?: NavigationItem[],
): NavigationItem[] {
  if (override?.length) {
    return override
      .filter((item) => PROPERTY_NAV_KEYS.has(item.key))
      .map((item) => {
        const entry: NavigationItem = {
          key: item.key,
          label: item.label,
        };
        if (item.onSelect) entry.onSelect = item.onSelect;
        return entry;
      });
  }

  const defaults = [
    {
      key: 'parties',
      label: 'Parties',
      href: '/portfolio?section=parties',
      permission: 'party.read',
    },
    {
      key: 'owners',
      label: 'Owners',
      href: '/portfolio?section=owners',
      permission: 'owner.read',
    },
    {
      key: 'properties',
      label: 'Properties',
      href: '/portfolio?section=properties',
      permission: 'portfolio.property.read',
    },
    {
      key: 'spaces',
      label: 'Rentable Spaces',
      href: '/portfolio?section=spaces',
      permission: 'portfolio.space.read',
    },
    {
      key: 'amenities',
      label: 'Amenities Catalog',
      href: '/portfolio?section=amenities',
      permission: 'portfolio.amenity.read',
    },
  ] as const;

  return defaults
    .filter((entry) => permissions.includes(entry.permission))
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      onSelect: () => navigate(entry.href),
    }));
}

export function commercialNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  const items: NavigationItem[] = [];

  if (permissions.includes('service-engagement.read')) {
    items.push({
      key: 'service-engagements',
      label: 'Service Engagements',
      onSelect: () => navigate('/commercial/service-engagements'),
    });
  }

  const rentalChildren = authorizedTaskNavigation(
    rentalOperationsDestinations,
    permissions,
    navigate,
  );
  items.push(...collapsibleWhenChildren('rental-operations', 'Rental Operations', rentalChildren));

  const salesChildren = authorizedTaskNavigation(
    salesOperationsDestinations,
    permissions,
    navigate,
  );
  items.push(...collapsibleWhenChildren('sales-operations', 'Sales Operations', salesChildren));

  return items;
}

export function projectsNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(projectsDestinations, permissions, navigate);
}

export function financeNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(financeDestinations, permissions, navigate);
}

export function reportingNavigation(
  permissions: string[],
  navigate: (href: string) => void,
  override?: NavigationItem[],
): NavigationItem[] {
  if (override?.length) {
    return override.filter((item) => item.key === 'audit');
  }
  return authorizedTaskNavigation(reportingDestinations, permissions, navigate);
}

export function workflowsNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(workflowDestinations, permissions, navigate);
}

export function buildSidebarGroups(options: {
  permissions: string[];
  navigate: (href: string) => void;
  subNavigation?: {
    organization?: NavigationItem[];
    administration?: NavigationItem[];
    portfolio?: NavigationItem[];
  };
}): SidebarGroup[] {
  const { permissions, navigate, subNavigation } = options;

  return [
    {
      id: 'company',
      title: 'COMPANY',
      items: companyNavigation(permissions, navigate, subNavigation),
    },
    {
      id: 'customers',
      title: 'CUSTOMERS',
      items: customersNavigation(permissions, navigate),
    },
    {
      id: 'properties',
      title: 'PROPERTIES',
      items: propertiesNavigation(permissions, navigate, subNavigation?.portfolio),
    },
    {
      id: 'commercial',
      title: 'COMMERCIAL',
      items: commercialNavigation(permissions, navigate),
    },
    {
      id: 'projects',
      title: 'PROJECTS',
      items: projectsNavigation(permissions, navigate),
    },
    {
      id: 'finance',
      title: 'FINANCE',
      items: financeNavigation(permissions, navigate),
    },
    {
      id: 'reporting',
      title: 'REPORTING',
      items: reportingNavigation(permissions, navigate, subNavigation?.administration),
    },
    {
      id: 'workflows',
      title: 'WORKFLOWS',
      items: workflowsNavigation(permissions, navigate),
    },
  ].filter((group) => group.items.length > 0);
}

export function expandedParentForActive(
  items: NavigationItem[],
  activeItem: string | undefined,
): string | undefined {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return undefined;
  return items.find((item) => item.children?.some((child) => child.key === normalized))?.key;
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
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return false;
  if (item.key === normalized || normalized.startsWith(`${item.key}:`)) return true;
  return Boolean(item.children?.some((child) => child.key === normalized));
}

export function navigationItemIsActiveDeep(
  items: NavigationItem[],
  activeItem: string | undefined,
): boolean {
  return items.some((item) => navigationItemIsActive(item, activeItem));
}
