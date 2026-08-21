'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/app-shell';
import { WorkspaceLoading } from '@/components/shared/ui';
import { api, clearApiCache, type Principal, userFacingError } from '@/lib/phase3-api';

export function usePortfolioPrincipal() {
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

export function PortfolioDetailShell({
  principal,
  activeItem,
  breadcrumbs,
  children,
}: {
  principal: Principal | null;
  activeItem: string;
  breadcrumbs: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  if (!principal) return <WorkspaceLoading label="Checking your secure session" />;
  return (
    <AppShell
      active="portfolio"
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
      <nav
        className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"
        aria-label="Breadcrumb"
      >
        {breadcrumbs.map((label, index) => (
          <span className="contents" key={label + '-' + index}>
            {index ? <span aria-hidden="true">/</span> : null}
            <span className={index === breadcrumbs.length - 1 ? 'text-slate-900' : ''}>
              {label}
            </span>
          </span>
        ))}
      </nav>
      {children}
    </AppShell>
  );
}
