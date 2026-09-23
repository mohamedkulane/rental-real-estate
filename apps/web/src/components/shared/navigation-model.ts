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
    key: 'start:add-owner-property',
    label: 'Add Owner + Property',
    description: 'Register a new owner, property, and service intent in one flow.',
    href: '/rental/properties?create=1',
    permission: 'portfolio.property.create',
  },
  {
    key: 'start:add-customer',
    label: 'Add Customer',
    description: 'Choose whether the customer is looking to rent or buy.',
    href: '/rental/customers?chooseIntent=1',
    permission: 'crm.lead.create',
  },
  {
    key: 'start:add-owner',
    label: 'Add Owner',
    description: 'Register an owner for the property portfolio.',
    href: '/portfolio?section=owners&create=1',
    permission: 'owner.create',
  },
  {
    key: 'start:add-property',
    label: 'Add Property',
    description: 'Register a property under an existing owner (or create a new owner).',
    href: '/rental/properties?create=1',
    permission: 'portfolio.property.create',
  },
  {
    key: 'start:record-payment',
    label: 'Record Payment',
    description: 'Record rent, commission, or other payment.',
    href: '/finance/payments?create=1',
    permission: 'payment.create',
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

/** @deprecated Prefer sales buyers / rental customers. Kept for tests. */
export const crmDestinations = [
  {
    key: 'crm:buyer-leads',
    label: 'Buyers',
    href: '/sales/buyers',
    permission: 'crm.lead.read',
  },
  {
    key: 'crm:pipeline',
    label: 'Deals',
    href: '/sales/deals',
    permission: 'crm.lead.read',
  },
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
    key: 'sale-listings',
    label: 'Properties for Sale',
    href: '/sales/properties',
    permission: 'listing.read',
  },
] as const;

export const leasingDestinations = [
  { key: 'leases', label: 'Leases', href: '/leasing/leases', permission: 'lease.read' },
] as const;

export const rentalDestinations = [
  {
    key: 'rental:overview',
    label: 'Overview',
    href: '/rental',
    permission: 'portfolio.property.read',
  },
  {
    key: 'rental:customers',
    label: 'Customers',
    href: '/rental/customers',
    permission: 'crm.lead.read',
  },
  {
    key: 'commercial:rental-brokerage',
    label: 'Brokerage',
    href: '/commercial/rental-brokerage',
    permission: 'service-engagement.read',
  },
  {
    key: 'commercial:full-management',
    label: 'Full Management',
    href: '/commercial/full-management',
    permission: 'service-engagement.read',
  },
  {
    key: 'leases',
    label: 'Leases',
    href: '/leasing/leases',
    permission: 'lease.read',
  },
] as const;

export const portfolioDestinations = [
  {
    key: 'owners',
    label: 'Owners',
    href: '/portfolio?section=owners',
    permission: 'owner.read',
  },
  {
    key: 'properties',
    label: 'Properties',
    href: '/rental/properties',
    permission: 'portfolio.property.read',
  },
  {
    key: 'viewings',
    label: 'Viewings',
    href: '/viewings',
    permission: 'viewing.read',
  },
  {
    key: 'amenities',
    label: 'Amenities',
    href: '/portfolio?section=amenities',
    permission: 'portfolio.amenity.read',
  },
] as const;

export const rentalOperationsDestinations = rentalDestinations;

export const salesOperationsDestinations = [
  {
    key: 'sales:overview',
    label: 'Overview',
    href: '/sales',
    permission: 'listing.read',
  },
  {
    key: 'sales:buyers',
    label: 'Buyers',
    href: '/sales/buyers',
    permission: 'crm.lead.read',
  },
  {
    key: 'sales:properties',
    label: 'Properties for Sale',
    href: '/sales/properties',
    permission: 'listing.read',
  },
  {
    key: 'sales:deals',
    label: 'Deals',
    href: '/sales/deals',
    permission: 'sale-offer.read',
  },
] as const;

export const financeDestinations = [
  {
    key: 'finance:overview',
    label: 'Overview',
    href: '/finance',
    permission: 'finance.overview.read',
  },
  {
    key: 'finance:payments',
    label: 'Payments',
    href: '/finance/payments',
    permission: 'payment.read',
  },
  {
    key: 'finance:expenses',
    label: 'Expenses',
    href: '/finance/expenses',
    permission: 'expense.read',
  },
  {
    key: 'finance:owner-statements',
    label: 'Owner Statements',
    href: '/finance/owner-statements',
    permission: 'owner-statement.read',
  },
  {
    key: 'finance:owner-payouts',
    label: 'Owner Payouts',
    href: '/finance/owner-payouts',
    permission: 'payout.read',
  },
] as const;

export const commercialDestinations = [
  {
    key: 'commercial:rental-brokerage',
    label: 'Brokerage',
    href: '/commercial/rental-brokerage',
    permission: 'brokerage-deal.read',
  },
  {
    key: 'commercial:full-management',
    label: 'Full Management',
    href: '/commercial/full-management',
    permission: 'service-engagement.read',
  },
  {
    key: 'commercial:property-sales',
    label: 'Deals',
    href: '/sales/deals',
    permission: 'sale-offer.read',
  },
] as const;

export const reportingDestinations = [
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports',
    permission: 'report.read',
  },
] as const;

export const projectsDestinations = [
  {
    key: 'projects:construction',
    label: 'Construction',
    href: '/construction',
    permission: 'construction.read',
  },
  {
    key: 'projects:development',
    label: 'Development',
    href: '/development',
    permission: 'development.read',
  },
] as const;

export const operationsDestinations = [
  {
    key: 'operations:overview',
    label: 'Overview',
    href: '/operations/maintenance',
    permission: 'maintenance.read',
  },
  {
    key: 'operations:maintenance',
    label: 'Maintenance',
    href: '/operations/maintenance',
    permission: 'maintenance.read',
  },
  {
    key: 'operations:inspections',
    label: 'Inspections',
    href: '/operations/inspections',
    permission: 'inspection.read',
  },
] as const;

const ACTIVE_ITEM_ALIASES: Record<string, string[]> = {
  'service-engagements': ['service-engagements', 'engagement-register'],
  'projects:construction': ['projects:construction', 'crm:construction-enquiries'],
  'incomplete-work': ['incomplete-work', 'workflow-new'],
  'crm:leads': ['crm:leads', 'crm:rental-leads', 'crm:buyer-leads', 'crm:seller-leads'],
  'sales:buyers': ['sales:buyers', 'crm:buyer-leads'],
  'sales:deals': ['sales:deals', 'commercial:property-sales', 'commercial:offers'],
  'sales:properties': ['sales:properties', 'sale-listings'],
  // Canonical Properties lives under Portfolio; rental:* is a legacy route active key.
  properties: ['properties', 'rental:properties'],
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

export function crmNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(crmDestinations, permissions, navigate);
}

/** @deprecated Customers group removed from primary IA. */
export function customersNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return crmNavigation(permissions, navigate);
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
      key: 'roles',
      label: 'Roles & Permissions',
      href: '/admin?section=roles',
      permission: 'identity.role.read',
    },
    {
      key: 'settings',
      label: 'Settings',
      href: '/admin?section=settings&settingsSection=company',
      permission: 'organization.company.read',
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

/** Portfolio sidebar: Owners → Properties → Amenities (override ignored). */
export function portfolioNavigation(
  permissions: string[],
  navigate: (href: string) => void,
  _override?: NavigationItem[],
): NavigationItem[] {
  return authorizedTaskNavigation(portfolioDestinations, permissions, navigate);
}

export function propertiesNavigation(
  permissions: string[],
  navigate: (href: string) => void,
  _override?: NavigationItem[],
): NavigationItem[] {
  return portfolioNavigation(permissions, navigate).filter((item) => item.key === 'properties');
}

export function rentalNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(rentalDestinations, permissions, navigate);
}

export function salesNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(salesOperationsDestinations, permissions, navigate);
}

export function commercialNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(commercialDestinations, permissions, navigate);
}

export function projectsNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(projectsDestinations, permissions, navigate);
}

export function operationsNavigation(
  permissions: string[],
  navigate: (href: string) => void,
): NavigationItem[] {
  return authorizedTaskNavigation(operationsDestinations, permissions, navigate);
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
    return override.filter((item) => item.key === 'reports' || item.key === 'audit');
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
      id: 'portfolio',
      title: 'PORTFOLIO',
      items: portfolioNavigation(permissions, navigate, subNavigation?.portfolio),
    },
    {
      id: 'rental',
      title: 'RENTAL',
      items: rentalNavigation(permissions, navigate),
    },
    {
      id: 'sales',
      title: 'SALES',
      items: salesNavigation(permissions, navigate),
    },
    {
      id: 'operations',
      title: 'OPERATIONS',
      items: operationsNavigation(permissions, navigate),
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
      id: 'administration',
      title: 'ADMINISTRATION',
      items: companyNavigation(permissions, navigate, subNavigation),
    },
  ].filter((group) => group.items.length > 0);
}

export function expandedParentForActive(
  items: NavigationItem[],
  activeItem: string | undefined,
): string | undefined {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return undefined;
  for (const item of items) {
    if (item.children?.some((child) => child.key === normalized || item.key === normalized)) {
      return item.key;
    }
  }
  return undefined;
}

export function navigationItemIsActive(item: NavigationItem, activeItem: string | undefined): boolean {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return false;
  if (item.key === normalized) return true;
  return Boolean(item.children?.some((child) => child.key === normalized));
}

export function nextExpandedParent(
  current: string | undefined,
  next: string,
): string | undefined {
  return current === next ? undefined : next;
}
