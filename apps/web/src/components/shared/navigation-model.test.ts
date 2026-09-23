import { describe, expect, it } from 'vitest';
import {
  buildSidebarGroups,
  rentalNavigation,
  salesNavigation,
  companyNavigation,
  expandedParentForActive,
  financeNavigation,
  navigationItemIsActive,
  nextExpandedParent,
  normalizeActiveItem,
  projectsNavigation,
  reportingNavigation,
  workflowsNavigation,
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
    ],
  },
  {
    key: 'properties',
    label: 'Properties',
    children: [{ key: 'properties:overview', label: 'Property Register' }],
  },
];

describe('hierarchical navigation model', () => {
  it('starts collapsed when there is no active child', () => {
    expect(expandedParentForActive(items, undefined)).toBeUndefined();
  });

  it('opens the parent that contains the active route child', () => {
    expect(expandedParentForActive(items, 'properties:overview')).toBe('properties');
    expect(navigationItemIsActive(items[1]!, 'properties:overview')).toBe(true);
  });

  it('supports one expanded parent at a time and allows collapse', () => {
    expect(nextExpandedParent(undefined, 'parties')).toBe('parties');
    expect(nextExpandedParent('parties', 'properties')).toBe('properties');
    expect(nextExpandedParent('properties', 'properties')).toBeUndefined();
  });

  it('normalizes legacy active item aliases', () => {
    expect(normalizeActiveItem('engagement-register')).toBe('service-engagements');
    expect(normalizeActiveItem('crm:construction-enquiries')).toBe('projects:construction');
  });
});

describe('simplified sidebar groups', () => {
  const fullPermissions = [
    'organization.company.read',
    'organization.branch.read',
    'identity.employee.read',
    'identity.user.read',
    'identity.role.read',
    'crm.lead.read',
    'portfolio.property.read',
    'service-engagement.read',
    'listing.read',
    'lease.read',
    'sale-offer.read',
    'maintenance.read',
    'inspection.read',
    'construction.read',
    'development.read',
    'finance.overview.read',
    'payment.read',
    'expense.read',
    'owner-statement.read',
    'payout.read',
    'report.read',
  ];

  it('builds business-aligned groups with portfolio properties', () => {
    const groups = buildSidebarGroups({ permissions: fullPermissions, navigate: () => undefined });
    expect(groups.map((group) => group.title)).toEqual([
      'PORTFOLIO',
      'RENTAL',
      'SALES',
      'OPERATIONS',
      'PROJECTS',
      'FINANCE',
      'REPORTING',
      'ADMINISTRATION',
    ]);
  });

  it('lists rental without properties duplicate', () => {
    expect(
      rentalNavigation(
        [
          'portfolio.property.read',
          'crm.lead.read',
          'service-engagement.read',
          'lease.read',
          'payment.read',
        ],
        () => undefined,
      ).map((item) => item.label),
    ).toEqual([
      'Overview',
      'Customers',
      'Brokerage',
      'Full Management',
      'Leases',
    ]);
  });

  it('lists portfolio properties in the portfolio folder', () => {
    expect(
      buildSidebarGroups({
        permissions: ['portfolio.property.read', 'owner.read', 'portfolio.amenity.read'],
        navigate: () => undefined,
      })
        .find((group) => group.title === 'PORTFOLIO')
        ?.items.map((item) => item.label),
    ).toEqual(['Owners', 'Properties', 'Amenities']);
  });

  it('lists sales as overview buyers properties deals', () => {
    expect(
      salesNavigation(
        ['listing.read', 'crm.lead.read', 'sale-offer.read'],
        () => undefined,
      ).map((item) => item.label),
    ).toEqual(['Overview', 'Buyers', 'Properties for Sale', 'Deals']);
  });

  it('keeps finance payments centralized', () => {
    expect(
      financeNavigation(
        ['finance.overview.read', 'payment.read', 'expense.read', 'owner-statement.read', 'payout.read'],
        () => undefined,
      ).map((item) => item.label),
    ).toEqual(['Overview', 'Payments', 'Expenses', 'Owner Statements', 'Owner Payouts']);
  });

  it('lists operations without vendors and work orders as primary', () => {
    expect(
      buildSidebarGroups({
        permissions: ['maintenance.read', 'inspection.read', 'vendor.read', 'work-order.read'],
        navigate: () => undefined,
      })
        .find((group) => group.title === 'OPERATIONS')
        ?.items.map((item) => item.label),
    ).toEqual(['Overview', 'Maintenance', 'Inspections']);
  });

  it('routes construction and development through projects', () => {
    expect(
      projectsNavigation(['construction.read', 'development.read'], () => undefined).map(
        (item) => item.label,
      ),
    ).toEqual(['Construction', 'Development']);
  });

  it('omits empty groups for unauthorized users', () => {
    expect(buildSidebarGroups({ permissions: [], navigate: () => undefined })).toEqual([]);
    expect(companyNavigation([], () => undefined)).toEqual([]);
    expect(financeNavigation([], () => undefined)).toEqual([]);
    expect(workflowsNavigation([], () => undefined)).toEqual([]);
    expect(reportingNavigation([], () => undefined)).toEqual([]);
  });

  it('lists administration as Branches, Employees, Roles & Permissions, Settings', () => {
    const visited: string[] = [];
    const items = companyNavigation(
      [
        'organization.company.read',
        'organization.branch.read',
        'identity.employee.read',
        'identity.role.read',
        'identity.user.read',
      ],
      (href) => {
        visited.push(href);
      },
    );
    expect(items.map((item) => item.label)).toEqual([
      'Branches',
      'Employees',
      'Roles & Permissions',
      'Settings',
    ]);
    items.find((item) => item.key === 'settings')!.onSelect!();
    expect(visited).toEqual(['/admin?section=settings&settingsSection=company']);
  });
});

describe('Start New launcher', () => {
  it('only exposes business tasks', () => {
    expect(startNewNavigation([], () => undefined)).toEqual([]);
    expect(
      startNewNavigation(['crm.lead.create'], () => undefined).map((item) => item.label),
    ).toEqual(['Add Rental Customer', 'Add Buyer']);
  });

  it('routes Add Rental Customer to workspace create drawer', () => {
    let destination = '';
    startNewNavigation(['crm.lead.create'], (href) => {
      destination = href;
    })[0]!.onSelect!();
    expect(destination).toBe('/rental/customers?create=1');
  });

  it('routes Start Rental Brokerage to commercial workspace drawer', () => {
    let destination = '';
    startNewNavigation(['service-engagement.create'], (href) => {
      destination = href;
    }).find((item) => item.key === 'start:rental-brokerage')!.onSelect!();
    expect(destination).toBe('/commercial/rental-brokerage?create=1');
  });

  it('includes record payment', () => {
    expect(
      startNewNavigation(['payment.create'], () => undefined).map((item) => item.label),
    ).toEqual(['Record Payment']);
  });
});

describe('legacy destination helpers', () => {
  it('keeps marketing and leasing permission-aware', () => {
    expect(authorizedTaskNavigation(marketingDestinations, [], () => undefined)).toEqual([]);
    expect(
      authorizedTaskNavigation(marketingDestinations, ['listing.read'], () => undefined).map(
        (item) => item.label,
      ),
    ).toEqual(['Properties for Sale']);
    expect(
      authorizedTaskNavigation(leasingDestinations, ['lease.read'], () => undefined).map(
        (item) => item.label,
      ),
    ).toEqual(['Leases']);
  });
});
