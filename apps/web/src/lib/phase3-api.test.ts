import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE,
  ApiError,
  apiCached,
  clearApiCache,
  isServiceUnavailable,
  userFacingError,
} from './phase3-api';

afterEach(() => {
  clearApiCache();
  vi.restoreAllMocks();
});

describe('cached API reads', () => {
  it('uses the same-origin API proxy by default', () => {
    expect(API_BASE).toBe('/api/backend');
  });
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

  it('recognizes transient service failures that should trigger readiness recovery', () => {
    expect(isServiceUnavailable(new TypeError('fetch failed'))).toBe(true);
    expect(isServiceUnavailable(new ApiError('gateway error', 502))).toBe(true);
    expect(isServiceUnavailable(new ApiError('validation error', 400))).toBe(false);
  });

  it('shows safe validation guidance returned by the API', () => {
    expect(
      userFacingError(
        new ApiError('Bad Request Exception', 400, [
          'code must be longer than or equal to 2 characters',
        ]),
      ),
    ).toBe('Code must be longer than or equal to 2 characters');
    expect(userFacingError(new ApiError('A reason is required.', 400))).toBe(
      'A reason is required.',
    );
  });

  it('preserves validation details from an unsuccessful API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            message: 'Bad Request Exception',
            details: ['name must be longer than or equal to 2 characters'],
          }),
      }),
    );

    await expect(apiCached('/roles')).rejects.toMatchObject({
      status: 400,
      details: ['name must be longer than or equal to 2 characters'],
    });
  });
});
