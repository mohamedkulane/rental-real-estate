'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/app-shell';
import { AppLoadingScreen } from '@/components/shared/loading-system';
import { ErrorState } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { api, clearApiCache, type Principal, userFacingError } from '@/lib/phase3-api';

export function useRentalPrincipal() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void api<Principal>('/auth/me')
      .then((value) => live && setPrincipal(value))
      .catch(
        (cause) => live && setError(userFacingError(cause, 'Your session could not be verified.')),
      );
    return () => {
      live = false;
    };
  }, []);
  return { principal, error };
}

export function RentalShell({
  principal,
  principalError,
  activeItem,
  children,
}: {
  principal: Principal | null;
  principalError?: string;
  activeItem: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ready = useClientReady();
  if (!ready) return <AppLoadingScreen title="Setting things up..." />;
  if (principalError) return <ErrorState message={principalError} />;
  if (!principal) return <AppLoadingScreen title="Setting things up..." />;
  return (
    <AppShell
      active="overview"
      activeItem={activeItem}
      accessMode={principal.accessMode}
      accessBranches={principal.branches}
      permissions={principal.permissions}
      onLogout={() => {
        void api('/auth/logout', { method: 'POST' }).finally(() => {
          clearApiCache();
          router.replace('/login');
        });
      }}
    >
      {children}
    </AppShell>
  );
}
