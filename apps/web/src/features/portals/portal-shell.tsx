'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLoadingScreen } from '@/components/shared/loading-system';
import { ErrorState } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { api, apiCached, clearApiCache, type Principal, userFacingError } from '@/lib/phase3-api';

export type PortalTab = {
  key: string;
  label: string;
};

export function usePortalPrincipal(expectedKind: 'OWNER' | 'TENANT') {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void apiCached<Principal>('/auth/me')
      .then((value) => {
        if (!live) return;
        if (value.kind !== expectedKind) {
          if (value.kind === 'OWNER') router.replace('/portal/owner');
          else if (value.kind === 'TENANT') router.replace('/portal/tenant');
          else router.replace('/admin');
          return;
        }
        setPrincipal(value);
      })
      .catch((cause) => {
        if (!live) return;
        clearApiCache();
        router.replace('/login');
        setError(userFacingError(cause, 'Your session could not be verified.'));
      });
    return () => {
      live = false;
    };
  }, [expectedKind, router]);

  return { principal, error };
}

export function PortalShell({
  title,
  subtitle,
  principal,
  principalError,
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  title: string;
  subtitle?: string;
  principal: Principal | null;
  principalError?: string;
  tabs: PortalTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const ready = useClientReady();

  if (!ready) return <AppLoadingScreen title="Setting things up..." />;
  if (principalError) return <ErrorState message={principalError} />;
  if (!principal) return <AppLoadingScreen title="Setting things up..." />;

  const displayName = principal.displayName ?? title;

  return (
    <div className="min-h-screen bg-[var(--background)] font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-bold text-slate-900">{title}</strong>
              <span className="block truncate text-xs text-slate-500">
                {subtitle ?? displayName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden truncate text-sm font-medium text-slate-700 sm:inline">
              {displayName}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                void api('/auth/logout', { method: 'POST' }).finally(() => {
                  clearApiCache();
                  router.replace('/login');
                });
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav
          className="mx-auto max-w-[1200px] overflow-x-auto px-3 sm:px-5 md:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Portal sections"
        >
          <div className="flex gap-1 border-t border-slate-100 pt-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={
                  'shrink-0 rounded-t-lg px-3 py-2.5 text-[12px] font-semibold transition sm:px-4 sm:text-[13px] ' +
                  (activeTab === tab.key
                    ? 'border-b-2 border-emerald-600 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                }
                aria-current={activeTab === tab.key ? 'page' : undefined}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1200px] p-3 sm:p-5 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
