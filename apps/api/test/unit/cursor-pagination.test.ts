import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { cursorPage } from '../../src/common/cursor-pagination';

describe('cursorPage', () => {
  it('returns a stable next cursor without leaking the lookahead row', () => {
    const rows = ['a', 'b', 'c'].map((id) => ({ id }));
    expect(cursorPage(rows, 2, (row) => row.id)).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      pageInfo: { hasNextPage: true, nextCursor: 'b' },
    });
  });

  it('terminates without a duplicate cursor when the final page is short', () => {
    expect(cursorPage([{ id: 'c' }], 2, (row) => row.id)).toEqual({
      items: [{ id: 'c' }],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
  });
});
