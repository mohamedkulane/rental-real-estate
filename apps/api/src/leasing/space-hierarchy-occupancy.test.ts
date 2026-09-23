import { describe, expect, it, vi } from 'vitest';
import { assertHierarchyOccupancyAvailable } from './space-hierarchy-occupancy';

function db(overrides: { lease?: unknown; reservation?: unknown } = {}) {
  return {
    $queryRaw: vi.fn()
      .mockResolvedValueOnce([{ id: 'parent-space' }])
      .mockResolvedValueOnce([]),
    lease: { findFirst: vi.fn().mockResolvedValue(overrides.lease ?? null) },
    reservation: { findFirst: vi.fn().mockResolvedValue(overrides.reservation ?? null) },
  };
}

describe('space hierarchy occupancy', () => {
  const base = {
    companyId: 'company-1',
    rentableSpaceId: 'room-1',
    businessDate: '2026-09-19',
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-11-01T00:00:00.000Z'),
  };

  it('rejects a child lease while a parent lease overlaps the period', async () => {
    await expect(
      assertHierarchyOccupancyAvailable(db({ lease: { leaseNumber: 'L-1' } }), base),
    ).rejects.toThrow('parent unit lease L-1');
  });

  it('rejects a whole-unit lease while a child lease overlaps the period', async () => {
    const database = db();
    database.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'room-1' }]);
    database.lease.findFirst.mockResolvedValue({ leaseNumber: 'L-2' });
    await expect(
      assertHierarchyOccupancyAvailable(database, { ...base, rentableSpaceId: 'apartment-1' }),
    ).rejects.toThrow('room lease L-2');
  });

  it('allows an unoccupied space', async () => {
    const database = db();
    await expect(assertHierarchyOccupancyAvailable(database, base)).resolves.toBeUndefined();
  });
});
