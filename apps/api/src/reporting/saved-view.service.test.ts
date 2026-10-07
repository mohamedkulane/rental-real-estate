import { describe, expect, it, vi } from 'vitest';
import { SavedViewService } from './saved-view.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

const principal = {
  kind: 'STAFF',
  userId: 'user-1',
  companyId: 'company-1',
} as AuthenticatedPrincipal;

describe('SavedViewService', () => {
  it('stores only bounded scalar filter payloads for the current user', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'view-1' });
    const service = new SavedViewService({ savedView: { create } } as never);

    await service.create(principal, {
      workspace: 'viewings',
      name: 'My upcoming viewings',
      filters: { search: 'Amina', status: 'UPCOMING', page: 1 },
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        companyId: 'company-1',
        userId: 'user-1',
        workspace: 'viewings',
        filters: { search: 'Amina', status: 'UPCOMING', page: 1 },
      },
    });
  });

  it('rejects nested or oversized filter values', async () => {
    const service = new SavedViewService({ savedView: { create: vi.fn() } } as never);

    await expect(
      service.create(principal, {
        workspace: 'payments',
        name: 'Invalid',
        filters: { where: { status: 'OPEN' } },
      }),
    ).rejects.toThrow('must be a scalar or short scalar list');
  });
});
