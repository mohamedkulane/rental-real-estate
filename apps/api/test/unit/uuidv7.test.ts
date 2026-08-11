import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@rerms/shared';

describe('UUIDv7 identifiers', () => {
  it('sets the RFC version and variant bits and preserves timestamp ordering', () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_001_000);
    expect(earlier).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(later > earlier).toBe(true);
  });

  it('does not collide for multiple identifiers in the same millisecond', () => {
    const identifiers = new Set(Array.from({ length: 1_000 }, () => uuidv7(1_700_000_000_000)));
    expect(identifiers.size).toBe(1_000);
  });
});
