import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiCached, clearApiCache, SESSION_KEY, userFacingError } from './phase3-api';

const storage = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

afterEach(() => {
  clearApiCache();
  storage.clear();
  vi.restoreAllMocks();
});

describe('cached API reads', () => {
  it('deduplicates concurrent and repeated reads for the same signed-in user', async () => {
    storage.set(SESSION_KEY, 'session-a');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([{ id: 'branch-1' }]) });
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([apiCached('/branches'), apiCached('/branches')]);
    const third = await apiCached('/branches');
    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps cached data isolated by session token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchMock);
    storage.set(SESSION_KEY, 'session-a');
    await apiCached('/branches');
    storage.set(SESSION_KEY, 'session-b');
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
