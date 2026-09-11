'use client';

import { useEffect, useState } from 'react';

/** Avoid SSR/client markup mismatches for auth-gated shells and locale-sensitive UI. */
export function useClientReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
