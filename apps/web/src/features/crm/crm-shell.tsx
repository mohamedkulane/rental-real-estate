'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/app-shell';
import { AppLoadingScreen } from '@/components/shared/loading-system';
import { ErrorState } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { api, apiCached, clearApiCache, type Principal, userFacingError } from '@/lib/phase3-api';
import styles from './crm-workspace.module.css';

export function useCrmPrincipal() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void apiCached<Principal>('/auth/me')
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

export function CrmShell({
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
      active="crm"
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
      <div className={styles.workspace}>{children}</div>
    </AppShell>
  );
}
