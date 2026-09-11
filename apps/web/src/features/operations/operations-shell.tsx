'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/app-shell';
import { AppLoadingScreen } from '@/components/shared/loading-system';
import { useClientReady } from '@/lib/client-ready';
import { api, clearApiCache, type Principal, userFacingError } from '@/lib/phase3-api';

export function useOperationsPrincipal() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void api<Principal>('/auth/me')
      .then((record) => {
        if (live) setPrincipal(record);
      })
      .catch((cause) => {
        if (live) setError(userFacingError(cause, 'Your session could not be verified.'));
      });
    return () => {
      live = false;
    };
  }, []);
  return { principal, error };
}

export function OperationsShell({
  principal,
  activeItem,
  children,
}: {
  principal: Principal | null;
  activeItem: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ready = useClientReady();
  if (!ready) return <AppLoadingScreen title="Setting things up..." />;
  if (!principal) return <AppLoadingScreen title="Setting things up..." />;
  return (
    <AppShell
      active="commercial"
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
