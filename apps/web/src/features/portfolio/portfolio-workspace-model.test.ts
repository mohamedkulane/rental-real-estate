import { describe, expect, it } from 'vitest';
import {
  isAggregatePortfolioView,
  shouldLoadParentPortfolioList,
} from './portfolio-workspace-model';

describe('portfolio child workspace routing', () => {
  it('routes every non-directory owner, property, and space child to an aggregate workspace', () => {
    expect(isAggregatePortfolioView('owners', 'directory')).toBe(false);
    expect(isAggregatePortfolioView('owners', 'owned-properties')).toBe(true);
    expect(isAggregatePortfolioView('owners', 'documents')).toBe(true);
    for (const view of [
      'buildings',
      'ownership',
      'amenities',
      'documents',
      'branch-history',
      'activity',
    ]) {
      expect(isAggregatePortfolioView('properties', view)).toBe(true);
    }
    for (const view of [
      'hierarchy',
      'measurements',
      'profile',
      'amenities',
      'documents',
      'lifecycle',
    ]) {
      expect(isAggregatePortfolioView('spaces', view)).toBe(true);
    }
    expect(isAggregatePortfolioView('properties', 'overview')).toBe(false);
    expect(isAggregatePortfolioView('spaces', 'overview')).toBe(false);
  });

  it('never loads a parent directory before a focused aggregate workspace', () => {
    expect(shouldLoadParentPortfolioList('owners', 'owned-properties')).toBe(false);
    expect(shouldLoadParentPortfolioList('owners', 'documents')).toBe(false);
    expect(shouldLoadParentPortfolioList('properties', 'ownership')).toBe(false);
    expect(shouldLoadParentPortfolioList('properties', 'activity')).toBe(false);
    expect(shouldLoadParentPortfolioList('spaces', 'measurements')).toBe(false);
    expect(shouldLoadParentPortfolioList('spaces', 'documents')).toBe(false);
    expect(shouldLoadParentPortfolioList('properties', 'overview')).toBe(true);
    expect(shouldLoadParentPortfolioList('spaces', 'overview')).toBe(true);
  });
});
