import { describe, expect, it } from 'vitest';
import {
  getStatusTermKey,
  getTerm,
  getTermEnglish,
  getTermSomali,
  terminologyDictionary,
} from './dictionary';

describe('terminology dictionary', () => {
  it('keeps English as the primary label for every term', () => {
    for (const [key, term] of Object.entries(terminologyDictionary)) {
      expect(term.english.length, key).toBeGreaterThan(0);
      expect(term.somali.length, key).toBeGreaterThan(0);
    }
  });

  it('returns stable helpers for core real-estate terms', () => {
    expect(getTermEnglish('rentableSpace')).toBe('Rentable Space');
    expect(getTermSomali('rentableSpace')).toContain('kireyn');
    expect(getTerm('serviceEngagement').descriptionSomali).toContain('adeegga');
  });

  it('maps operational statuses to guidance keys', () => {
    expect(getStatusTermKey('DRAFT')).toBe('statusDraft');
    expect(getStatusTermKey('ACTIVE')).toBe('statusActive');
  });
});
