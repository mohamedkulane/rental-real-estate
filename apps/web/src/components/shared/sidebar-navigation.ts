import type { LucideIcon } from 'lucide-react';
import {
  BriefcaseBusiness,
  Building2,
  FileBarChart,
  HardHat,
  KeyRound,
  Landmark,
  Settings,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import {
  buildSidebarGroups,
  companyNavigation,
  financeNavigation,
  operationsNavigation,
  portfolioNavigation,
  projectsNavigation,
  normalizeActiveItem,
  rentalNavigation,
  reportingNavigation,
  salesNavigation,
  type NavigationItem,
} from './navigation-model';

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'rerms.sidebar.collapsed';
export const SIDEBAR_EXPANDED_STORAGE_KEY = 'rerms.sidebar.expandedGroup';

export type SidebarAccordionGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavigationItem[];
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  rental: KeyRound,
  portfolio: Building2,
  sales: ShoppingBag,
  operations: Wrench,
  projects: HardHat,
  finance: BriefcaseBusiness,
  reporting: FileBarChart,
  administration: Settings,
};

const ACTIVE_GROUP_ALIASES: Record<string, string> = {
  viewings: 'rental',
  'service-engagements': 'rental',
  'engagement-register': 'rental',
  'start:rental-brokerage': 'rental',
  'start:full-management': 'rental',
  'start:add-rental-customer': 'rental',
  'start:add-property': 'portfolio',
  'start:add-buyer': 'sales',
  'start:property-sale': 'sales',
  'start:record-payment': 'finance',
  'rental:overview': 'rental',
  'rental:customers': 'rental',
  'rental:properties': 'portfolio',
  applications: 'rental',
  reservations: 'rental',
  tenants: 'rental',
  leases: 'rental',
  renewals: 'rental',
  'move-ins': 'rental',
  'rental-listings': 'rental',
  'sale-listings': 'sales',
  'sales:overview': 'sales',
  'sales:buyers': 'sales',
  'sales:properties': 'sales',
  'sales:deals': 'sales',
  company: 'administration',
  branches: 'administration',
  employees: 'administration',
  settings: 'administration',
  roles: 'administration',
  users: 'administration',
  audit: 'administration',
  permissions: 'administration',
  reports: 'reporting',
  parties: 'portfolio',
  owners: 'portfolio',
  properties: 'portfolio',
  'properties:overview': 'portfolio',
  'properties:buildings': 'portfolio',
  spaces: 'portfolio',
  'spaces:overview': 'portfolio',
  amenities: 'portfolio',
  'crm:leads': 'sales',
  'crm:pipeline': 'sales',
  'crm:follow-ups': 'sales',
  'crm:sources': 'administration',
  'crm:buyer-leads': 'sales',
  'projects:construction': 'projects',
  'projects:development': 'projects',
  'operations:overview': 'operations',
  'operations:maintenance': 'operations',
  'operations:inspections': 'operations',
  'finance:overview': 'finance',
  'finance:payments': 'finance',
  'finance:owner-statements': 'finance',
  'finance:owner-payouts': 'finance',
  'finance:expenses': 'finance',
  'commercial:rental-brokerage': 'rental',
  'commercial:brokerage-deals': 'rental',
  'commercial:full-management': 'rental',
  'commercial:property-sales': 'sales',
  'commercial:property-sales-pipeline': 'sales',
  'commercial:offers': 'sales',
  'commercial:settlements': 'sales',
};

export function resolveSidebarGroupId(activeItem: string | undefined): string | undefined {
  const normalized = normalizeActiveItem(activeItem);
  if (!normalized) return undefined;
  if (ACTIVE_GROUP_ALIASES[normalized]) return ACTIVE_GROUP_ALIASES[normalized];
  if (normalized.startsWith('crm:')) return 'sales';
  if (normalized.startsWith('start:')) {
    if (normalized.includes('rental') || normalized.includes('management') || normalized.includes('property')) {
      if (normalized.includes('sale') || normalized.includes('buyer')) return 'sales';
      if (normalized.includes('payment')) return 'finance';
      return 'rental';
    }
    if (normalized.includes('sale') || normalized.includes('buyer')) return 'sales';
    if (normalized.includes('payment')) return 'finance';
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
  if (childKey === normalized) return true;
  // Portfolio sections use keys like properties:overview / owners:directory
  if (normalized.startsWith(`${childKey}:`)) return true;
  return false;
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
      id: 'portfolio',
      label: 'Portfolio',
      children: portfolioNavigation(permissions, navigate, subNavigation?.portfolio),
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
      id: 'operations',
      label: 'Operations',
      children: operationsNavigation(permissions, navigate),
    },
    {
      id: 'projects',
      label: 'Projects',
      children: projectsNavigation(permissions, navigate),
    },
    {
      id: 'finance',
      label: 'Finance',
      children: financeNavigation(permissions, navigate),
    },
    {
      id: 'reporting',
      label: 'Reports',
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

export { buildSidebarGroups, normalizeActiveItem };
