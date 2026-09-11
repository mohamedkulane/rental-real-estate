import { describe, expect, it } from 'vitest';
import {
  buildSidebarGroups,
  rentalNavigation,
  salesNavigation,
  companyNavigation,
  customersNavigation,
  expandedParentForActive,
  financeNavigation,
  navigationItemIsActive,
  nextExpandedParent,
  normalizeActiveItem,
  projectsNavigation,
  reportingNavigation,
  workflowsNavigation,
  crmNavigation,
  crmDestinations,
  authorizedTaskNavigation,
  leasingDestinations,
  marketingDestinations,
  startNewNavigation,
  type NavigationItem,
} from './navigation-model';

const items: NavigationItem[] = [
  {
    key: 'parties',
    label: 'Parties',
    children: [
      { key: 'parties:all', label: 'Party Register' },
      { key: 'parties:people', label: 'People' },
      { key: 'parties:organizations', label: 'Organizations' },
    ],
  },
  {
    key: 'properties',
    label: 'Properties',
    children: [
      { key: 'properties:overview', label: 'Property Register' },
      { key: 'properties:buildings', label: 'Buildings' },
    ],
  },
];

describe('hierarchical navigation model', () => {
  it('starts collapsed when there is no active child', () => {
    expect(expandedParentForActive(items, undefined)).toBeUndefined();
  });

  it('opens the parent that contains the active route child', () => {
    expect(expandedParentForActive(items, 'properties:buildings')).toBe('properties');
    expect(navigationItemIsActive(items[1]!, 'properties:buildings')).toBe(true);
  });

  it('supports one expanded parent at a time and allows collapse', () => {
    expect(nextExpandedParent(undefined, 'parties')).toBe('parties');
    expect(nextExpandedParent('parties', 'properties')).toBe('properties');
    expect(nextExpandedParent('properties', 'properties')).toBeUndefined();
  });

  it('uses human-readable child labels', () => {
    expect(items[0]?.children?.map((item) => item.label)).toEqual([
      'Party Register',
      'People',
      'Organizations',
    ]);
    expect(items.flatMap((item) => item.children ?? []).map((item) => item.label)).not.toContain(
      'PERSON',
    );
  });

  it('normalizes legacy active item aliases', () => {
    expect(normalizeActiveItem('engagement-register')).toBe('service-engagements');
    expect(normalizeActiveItem('crm:construction-enquiries')).toBe('projects:construction');
  });
});

describe('mockup sidebar groups', () => {
  const fullPermissions = [
    'organization.company.read',
    'organization.branch.read',
    'identity.employee.read',
    'identity.user.read',
    'identity.role.read',
    'crm.lead.read',
    'crm.followup.read',
    'crm.source.manage',
    'party.read',
    'owner.read',
    'portfolio.property.read',
    'portfolio.space.read',
    'portfolio.amenity.read',
    'service-engagement.read',
    'listing.read',
    'workflow.draft.update',
    'application.read',
    'reservation.read',
    'tenant.read',
    'lease.read',
    'renewal.read',
    'move-in.read',
    'workflow.draft.read',
    'governance.audit.read',
  ];

  it('builds business-aligned groups without finance when no routes exist', () => {
    const groups = buildSidebarGroups({ permissions: fullPermissions, navigate: () => undefined });
    expect(groups.map((group) => group.title)).toEqual([
      'CUSTOMERS',
      'PORTFOLIO',
      'RENTAL',
      'SALES',
      'WORKFLOWS',
      'OPERATIONS',
      'REPORTING',
      'ADMINISTRATION',
    ]);
    expect(groups.find((group) => group.title === 'FINANCE')).toBeUndefined();
  });

  it('keeps CRM items flat under customers', () => {
    const customers = customersNavigation(['crm.lead.read', 'crm.followup.read'], () => undefined);
    expect(customers.map((item) => item.label)).toEqual(['Leads', 'Pipeline', 'Follow-Ups']);
  });

  it('lists rental workspaces as a flat rental group', () => {
    const rental = rentalNavigation(
      ['listing.read', 'workflow.draft.update', 'viewing.read', 'lease.read'],
      () => undefined,
    );
    expect(rental.map((item) => item.label)).toEqual([
      'Rental Listings',
      'Rental Brokerage',
      'Full Management',
      'Viewings',
      'Lease Contracts',
    ]);
  });

  it('lists sales workspaces separately', () => {
    const sales = salesNavigation(['listing.read', 'workflow.draft.update'], () => undefined);
    expect(sales.map((item) => item.label)).toEqual(['Sale Listings', 'Property Sale']);
  });

  it('routes construction enquiries through projects', () => {
    expect(projectsNavigation(['crm.lead.read'], () => undefined)[0]?.label).toBe(
      'Construction Enquiries',
    );
  });

  it('omits empty groups for unauthorized users', () => {
    expect(buildSidebarGroups({ permissions: [], navigate: () => undefined })).toEqual([]);
    expect(companyNavigation([], () => undefined)).toEqual([]);
    expect(financeNavigation([], () => undefined)).toEqual([]);
    expect(workflowsNavigation([], () => undefined)).toEqual([]);
    expect(reportingNavigation([], () => undefined)).toEqual([]);
  });

  it('exposes Parties before Owners in the portfolio group', () => {
    const properties = buildSidebarGroups({
      permissions: ['party.read', 'owner.read'],
      navigate: () => undefined,
    }).find((group) => group.title === 'PORTFOLIO');
    expect(properties?.items.map((item) => item.label)).toEqual(['Parties', 'Owners']);
  });
});

describe('CRM task navigation', () => {
  it('exposes only explicitly permitted workspaces', () => {
    expect(crmNavigation([], () => undefined)).toEqual([]);
    expect(crmNavigation(['crm.followup.read'], () => undefined)).toEqual([]);
    expect(
      crmNavigation(['crm.followup.read', 'crm.lead.read'], () => undefined).map(
        (item) => item.label,
      ),
    ).toContain('Follow-ups');
    expect(crmNavigation(['crm.lead.read'], () => undefined).map((item) => item.label)).toEqual([
      'Lead Register',
      'Rental Leads',
      'Buyer Leads',
      'Seller Leads',
      'Construction Enquiries',
      'Pipeline',
    ]);
  });
  it('exposes implemented Viewings without future fake actions', () => {
    expect(crmDestinations.map((item) => item.href)).toEqual([
      '/crm/leads',
      '/crm/leads?intent=RENT',
      '/crm/leads?intent=BUY',
      '/crm/leads?intent=SELL',
      '/crm/leads?intent=CONSTRUCTION_SERVICE',
      '/crm/pipeline',
      '/crm/follow-ups',
      '/crm/lead-sources',
      '/crm/viewings',
    ]);
  });
  it('routes to the dedicated workspace', () => {
    let destination = '';
    crmNavigation(['crm.source.manage'], (href) => {
      destination = href;
    })[0]!.onSelect!();
    expect(destination).toBe('/crm/lead-sources');
  });
});

describe('Wave 1 Start New launcher', () => {
  it('only exposes implemented tasks for authorized users', () => {
    expect(startNewNavigation([], () => undefined)).toEqual([]);
    expect(startNewNavigation(['crm.lead.read'], () => undefined)).toEqual([]);
    expect(
      startNewNavigation(['crm.lead.create'], () => undefined).map((item) => item.label),
    ).toEqual(['Add Lead']);
  });

  it('routes Add Lead without exposing future-phase destinations', () => {
    let destination = '';
    startNewNavigation(['crm.lead.create'], (href) => {
      destination = href;
    })[0]!.onSelect!();
    expect(destination).toBe('/crm/leads/new');
  });
});

describe('Phase 5 task navigation', () => {
  it('keeps marketing and leasing workspaces permission-aware', () => {
    expect(authorizedTaskNavigation(marketingDestinations, [], () => undefined)).toEqual([]);
    expect(
      authorizedTaskNavigation(marketingDestinations, ['listing.read'], () => undefined).map(
        (item) => item.label,
      ),
    ).toEqual(['Rental Listings', 'Sale Listings']);
    expect(
      authorizedTaskNavigation(leasingDestinations, ['lease.read'], () => undefined).map(
        (item) => item.label,
      ),
    ).toEqual(['Lease Contracts']);
  });
});
