import { describe, expect, it, vi } from 'vitest';

import {
  confirmRentableSpaceRetirement,
  RENTABLE_SPACE_RETIREMENT_CONFIRMATION,
} from './rentable-space-operations';

describe('rentable space lifecycle confirmation', () => {
  it('does not continue when permanent retirement is cancelled', () => {
    const confirmAction = vi.fn(() => false);

    expect(confirmRentableSpaceRetirement(confirmAction)).toBe(false);
    expect(confirmAction).toHaveBeenCalledWith(RENTABLE_SPACE_RETIREMENT_CONFIRMATION);
  });

  it('continues only when permanent retirement is confirmed', () => {
    expect(confirmRentableSpaceRetirement(() => true)).toBe(true);
  });
});
