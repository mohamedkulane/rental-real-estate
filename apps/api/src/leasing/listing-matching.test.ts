import { describe, expect, it } from 'vitest';
import { PropertyType } from '@prisma/client';
import { preferPropertyTypeMatches, propertyTypeMatchesPreference } from './listing.service';

describe('rental property type matching', () => {
  it('recognizes a property outside the customer preferred types', () => {
    expect(
      propertyTypeMatchesPreference(PropertyType.APARTMENT_BUILDING, [
        PropertyType.HOUSE,
        PropertyType.VILLA,
      ]),
    ).toBe(false);
  });

  it('accepts one of the customer preferred types', () => {
    expect(
      propertyTypeMatchesPreference(PropertyType.VILLA, [
        PropertyType.HOUSE,
        PropertyType.VILLA,
      ]),
    ).toBe(true);
  });

  it('does not constrain matching when no type preference was provided', () => {
    expect(propertyTypeMatchesPreference(PropertyType.APARTMENT_BUILDING, [])).toBe(true);
  });

  it('prefers the requested types when at least one is available', () => {
    const items = [
      { id: 'villa', reasonKeys: ['property_type_match'] },
      { id: 'apartment', reasonKeys: [] },
    ];
    expect(preferPropertyTypeMatches(items, [PropertyType.VILLA]).map((item) => item.id)).toEqual([
      'villa',
    ]);
  });

  it('keeps alternatives when no requested type is available', () => {
    const items = [
      { id: 'apartment', reasonKeys: [] },
      { id: 'house', reasonKeys: [] },
    ];
    expect(preferPropertyTypeMatches(items, [PropertyType.VILLA]).map((item) => item.id)).toEqual([
      'apartment',
      'house',
    ]);
  });
});
