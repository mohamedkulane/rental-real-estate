import { describe, expect, it } from 'vitest';
import {
  isInterestedViewingOutcome,
  isNotInterestedViewingOutcome,
} from '../../src/rental/viewing-outcome';

describe('viewing outcome helpers', () => {
  it('treats exact INTERESTED as interested', () => {
    expect(isInterestedViewingOutcome('INTERESTED')).toBe(true);
    expect(isInterestedViewingOutcome('interested')).toBe(true);
  });

  it('never treats NOT_INTERESTED as interested', () => {
    expect(isInterestedViewingOutcome('NOT_INTERESTED')).toBe(false);
    expect(isNotInterestedViewingOutcome('NOT_INTERESTED')).toBe(true);
  });

  it('rejects vague completion notes', () => {
    expect(isInterestedViewingOutcome('Customer reviewing interest with owner terms')).toBe(
      false,
    );
  });
});
