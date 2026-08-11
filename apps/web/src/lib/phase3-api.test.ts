import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiCached, clearApiCache, userFacingError } from './phase3-api';

afterEach(() => {
  clearApiCache();
  vi.restoreAllMocks();
});

describe('cached API reads', () => {
  it('deduplicates concurrent and repeated reads within the active authenticated session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([{ id: 'branch-1' }]) });
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([apiCached('/branches'), apiCached('/branches')]);
    const third = await apiCached('/branches');
    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('does not reuse cached data after the authentication boundary clears the cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchMock);
    await apiCached('/branches');
    clearApiCache();
    await apiCached('/branches');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('user-facing API errors', () => {
  it('maps authorization and network failures to clear non-technical guidance', () => {
    expect(userFacingError(new ApiError('internal policy detail', 403))).toBe(
      'You do not have permission to complete this action.',
    );
    expect(userFacingError(new TypeError('fetch failed'))).toBe(
      'We could not reach the service. Check your connection and try again.',
    );
  });
});
