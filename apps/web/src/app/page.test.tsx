import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn(() => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation', () => ({ redirect }));

describe('HomePage', () => {
  it('redirects unauthenticated entry to login', async () => {
    const { default: HomePage } = await import('./page');
    expect(() => HomePage()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
