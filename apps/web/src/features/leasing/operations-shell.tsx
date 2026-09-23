'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/app-shell';
import { AppLoadingScreen } from '@/components/shared/loading-system';
import { ErrorState } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { api, apiCached, clearApiCache, type Principal, userFacingError } from '@/lib/phase3-api';

export function useOperationsPrincipal() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void apiCached<Principal>('/auth/me').then((value) => live && setPrincipal(value)).catch((cause) => live && setError(userFacingError(cause)));
    return () => { live = false; };
  }, []);
  return { principal, error };
}

export function OperationsShell({ principal, error, activeItem, children }: { principal: Principal | null; error?: string; activeItem: string; children: ReactNode }) {
  const router = useRouter();
  const ready = useClientReady();
  if (!ready) return <AppLoadingScreen title="Setting things up..." />;
  if (error) return <ErrorState message={error} />;
  if (!principal) return <AppLoadingScreen title="Setting things up..." />;
  return <AppShell active="commercial" activeItem={activeItem} accessMode={principal.accessMode} accessBranches={principal.branches} permissions={principal.permissions} onLogout={() => { void api('/auth/logout', { method: 'POST' }).finally(() => { clearApiCache(); router.replace('/login'); }); }}>{children}</AppShell>;
}
