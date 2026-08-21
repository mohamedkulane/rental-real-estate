import { describe, expect, it } from 'vitest';
import {
  expandedParentForActive,
  navigationItemIsActive,
  nextExpandedParent,
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
});
