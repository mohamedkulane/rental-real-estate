import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  firstSearchableOptionValue,
  isStatusSelection,
  matchesSearchableOption,
  searchableOptionText,
} from './searchable-select';

describe('SearchableSelect helpers', () => {
  it('searches the complete visible label when an option contains multiple text nodes', () => {
    const option = createElement('option', { value: 'owner-id' }, [
      'Fadumo Ali Mohamed',
      ' — ',
      'Owner',
    ]);
    expect(searchableOptionText(option)).toBe('Fadumo Ali Mohamed — Owner');
  });

  it('disables option search for status selectors', () => {
    expect(isStatusSelection('status')).toBe(true);
    expect(isStatusSelection(undefined, 'Status')).toBe(true);
    expect(isStatusSelection(undefined, undefined, 'status-filter')).toBe(true);
    expect(isStatusSelection('partyId', 'Person or organization')).toBe(false);
  });

  it('matches option labels without regard to letter case', () => {
    const option = createElement('option', { value: 'branch-id' }, 'Hodan Branch');

    expect(matchesSearchableOption(option, 'HODAN')).toBe(true);
    expect(matchesSearchableOption(option, 'hodan')).toBe(true);
  });

  it('automatically resolves a partial query to the first matching selection', () => {
    const options = [
      createElement('option', { value: '' }, 'Choose a property'),
      createElement('option', { value: 'property-1' }, 'PROP-0001 — Barwaaqo Residence Tower'),
      createElement('option', { value: 'property-2' }, 'PR-610B50CC — Daryeel Business Centre'),
    ];

    expect(firstSearchableOptionValue(options, 'BARW')).toBe('property-1');
    expect(firstSearchableOptionValue(options, 'daryeel')).toBe('property-2');
    expect(firstSearchableOptionValue(options, 'missing')).toBeUndefined();
  });
});
