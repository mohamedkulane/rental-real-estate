import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
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
});
