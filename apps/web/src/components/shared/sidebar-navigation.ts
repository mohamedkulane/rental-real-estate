import type { LucideIcon } from 'lucide-react';
import {
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  ContactRound,
  FileBarChart,
  KeyRound,
  Landmark,
  Settings,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import {
  buildSidebarGroups,
  companyNavigation,
  customersNavigation,
  financeNavigation,
  normalizeActiveItem,
  projectsNavigation,
  propertiesNavigation,
  rentalNavigation,
  reportingNavigation,
  salesNavigation,
  workflowsNavigation,
  type NavigationItem,
} from './navigation-model';

export type SidebarAccordionGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavigationItem[];
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  customers: ContactRound,
  portfolio: Building2,
  rental: KeyRound,
  sales: ShoppingBag,
  workflows: ClipboardList,
  operations: Wrench,
  finance: BriefcaseBusiness,
  reporting: FileBarChart,
  administration: Settings,
};

const ACTIVE_GROUP_ALIASES: Record<string, string> = {
  viewings: 'rental',
  'service-engagements': 'portfolio',
  'engagement-register': 'portfolio',
  'workflow-new': 'workflows',
  'incomplete-work': 'workflows',
  'start:rental-brokerage': 'rental',
  'start:full-management': 'rental',
  'start:property-sale': 'sales',
  applications: 'rental',
  reservations: 'rental',
  tenants: 'rental',
  leases: 'rental',
  renewals: 'rental',
  'move-ins': 'rental',
  'rental-listings': 'rental',
  'sale-listings': 'sales',
  company: 'administration',
  branches: 'administration',
  employees: 'administration',
  users: 'administration',
  roles: 'administration',
  audit: 'reporting',
  parties: 'portfolio',
  owners: 'portfolio',
  properties: 'portfolio',
  spaces: 'portfolio',
  amenities: 'portfolio',
  'crm:leads': 'customers',
  'crm:pipeline': 'customers',
  'crm:follow-ups': 'customers',
  'crm:sources': 'customers',
  'projects:construction': 'operations',
};

export function resolveSidebarGroupId(activeItem: string | undefined): string | undefined {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return undefined;
  if (ACTIVE_GROUP_ALIASES[normalized]) return ACTIVE_GROUP_ALIASES[normalized];
  if (normalized.startsWith('crm:')) return 'customers';
  if (normalized.startsWith('start:')) {
    if (normalized.includes('rental') || normalized.includes('management')) return 'rental';
    if (normalized.includes('sale')) return 'sales';
    if (normalized.includes('onboarding')) return 'workflows';
  }
  return undefined;
}

export function groupContainsActiveItem(
  group: SidebarAccordionGroup,
  activeItem: string | undefined,
): boolean {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return false;
  if (resolveSidebarGroupId(normalized) === group.id) return true;
  return group.children.some(
    (child) => child.key === normalized || normalized.startsWith(`${child.key}:`),
  );
}

export function expandedGroupForActive(
  groups: SidebarAccordionGroup[],
  activeItem: string | undefined,
): string | undefined {
  const resolved = resolveSidebarGroupId(activeItem);
  if (resolved && groups.some((group) => group.id === resolved)) return resolved;
  return groups.find((group) => groupContainsActiveItem(group, activeItem))?.id;
}

export function childIsActive(childKey: string, activeItem: string | undefined): boolean {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return false;
  return childKey === normalized;
}

export function buildSidebarAccordion(options: {
  permissions: string[];
  navigate: (href: string) => void;
  subNavigation?: {
    organization?: NavigationItem[];
    administration?: NavigationItem[];
    portfolio?: NavigationItem[];
  };
}): SidebarAccordionGroup[] {
  const { permissions, navigate, subNavigation } = options;

  const groups: Array<Omit<SidebarAccordionGroup, 'icon'> & { icon?: LucideIcon }> = [
    {
      id: 'customers',
      label: 'Customers',
      children: customersNavigation(permissions, navigate),
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      children: propertiesNavigation(permissions, navigate, subNavigation?.portfolio),
    },
    {
      id: 'rental',
      label: 'Rental',
      children: rentalNavigation(permissions, navigate),
    },
    {
      id: 'sales',
      label: 'Sales',
      children: salesNavigation(permissions, navigate),
    },
    {
      id: 'workflows',
      label: 'Workflows',
      children: workflowsNavigation(permissions, navigate),
    },
    {
      id: 'operations',
      label: 'Operations',
      children: projectsNavigation(permissions, navigate),
    },
    {
      id: 'finance',
      label: 'Finance',
      children: financeNavigation(permissions, navigate),
    },
    {
      id: 'reporting',
      label: 'Reporting',
      children: reportingNavigation(permissions, navigate, subNavigation?.administration),
    },
    {
      id: 'administration',
      label: 'Administration',
      children: companyNavigation(permissions, navigate, subNavigation),
    },
  ];

  return groups
    .filter((group) => group.children.length > 0)
    .map((group) => ({
      ...group,
      icon: group.icon ?? GROUP_ICONS[group.id] ?? Landmark,
    }));
}

/** @deprecated Use buildSidebarAccordion for sidebar rendering. */
export { buildSidebarGroups };

export const SIDEBAR_EXPANDED_STORAGE_KEY = 'horizon.sidebar.expanded-group';
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'horizon.sidebar.collapsed';
