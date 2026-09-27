import { describe, expect, it } from 'vitest';
import {
  isInterestedViewingOutcome,
  isNotInterestedViewingOutcome,
  nextPlacementStep,
  viewingInterestLabel,
} from './rental-placement';

describe('server-authoritative rental placement', () => {
  it('keeps the customer at viewing until the viewing is completed', () => {
    expect(nextPlacementStep({})).toBe('viewing');
    expect(nextPlacementStep({ viewingStatus: 'CONFIRMED' })).toBe(
      'viewing',
    );
  });

  it('moves an interested completed viewing to agreement', () => {
    expect(
      nextPlacementStep({ viewingStatus: 'COMPLETED', viewingOutcome: 'INTERESTED' }),
    ).toBe('agreement');
    expect(isInterestedViewingOutcome('INTERESTED')).toBe(true);
    expect(viewingInterestLabel('INTERESTED')).toBe('Interested');
  });

  it('keeps a not-interested outcome out of agreement and lease creation', () => {
    expect(
      nextPlacementStep({ viewingStatus: 'COMPLETED', viewingOutcome: 'NOT_INTERESTED' }),
    ).toBe('declined');
    expect(isNotInterestedViewingOutcome('NOT_INTERESTED')).toBe(true);
    expect(viewingInterestLabel('NOT_INTERESTED')).toBe('Not interested');
  });
});
