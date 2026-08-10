import { describe, expect, it } from 'vitest';
import {
  formatDate,
  humanize,
  permissionDomain,
  permissionLabel,
  statusTone,
} from './presentation';

describe('presentation helpers', () => {
  it('turns backend values into readable business labels', () => {
    expect(humanize('COMPANY_WIDE')).toBe('Company Wide');
    expect(humanize('rent_collection_only')).toBe('Rent Collection Only');
  });

  it('uses a human-friendly fallback when a date is absent', () => {
    expect(formatDate(undefined)).toBe('No date recorded');
    expect(formatDate('invalid')).toBe('No date recorded');
  });

  it('groups and labels technical permissions without exposing raw arrays', () => {
    expect(permissionDomain('organization.branch.read')).toBe('Organization');
    expect(permissionLabel('portfolio.property.update')).toBe('Property Update');
  });

  it('maps statuses to semantic visual families', () => {
    expect(statusTone('ACTIVE')).toBe('positive');
    expect(statusTone('PENDING_REVIEW')).toBe('warning');
    expect(statusTone('SUSPENDED')).toBe('negative');
    expect(statusTone('INACTIVE')).toBe('negative');
    expect(statusTone('DRAFT')).toBe('neutral');
  });
});
