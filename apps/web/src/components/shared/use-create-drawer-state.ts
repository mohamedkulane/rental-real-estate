'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Opens a workspace create drawer from `?create=1` and clears the param on close. */
export function useCreateDrawerState(paramKey = 'create') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get(paramKey) === '1';
  const [open, setOpen] = useState(fromQuery);

  useEffect(() => {
    if (fromQuery) setOpen(true);
  }, [fromQuery]);

  const clearCreateParam = useCallback(() => {
    if (searchParams.get(paramKey) !== '1') return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete(paramKey);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [paramKey, pathname, router, searchParams]);

  const openCreate = useCallback(() => {
    setOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setOpen(false);
    clearCreateParam();
  }, [clearCreateParam]);

  return { createOpen: open, openCreate, closeCreate };
}
