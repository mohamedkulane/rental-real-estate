'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Home, Landmark, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { AppHeader } from './app-header';
import {
  normalizeActiveItem,
  type NavigationItem,
} from './navigation-model';
import { SidebarAccordion, useSidebarLayoutState } from './sidebar-accordion';
import { buildSidebarAccordion } from './sidebar-navigation';
export type ShellSection =
  | 'overview'
  | 'organization'
  | 'portfolio'
  | 'commercial'
  | 'crm'
  | 'administration'
  | 'projects'
  | 'workflows';

export type ShellSubItem = NavigationItem;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

function branchLabel(
  accessMode: string,
  branches: Array<{ id: string; code: string; name: string }>,
): string {
  if (accessMode === 'COMPANY_WIDE') return 'Company Wide';
  if (branches.length === 1) return branches[0]?.name ?? 'Assigned Branch';
  if (branches.length > 1) return `${branches.length} Branches`;
  return humanize(accessMode);
}

function userInitials(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function AppShell({
  active,
  activeItem,
  subNavigation = {},
  accessMode,
  accessBranches,
  permissions,
  onLogout,
  userDisplayName,
  userRoleLabel,
  children,
}: {
  active: ShellSection;
  activeItem?: string;
  subNavigation?: Partial<
    Record<'organization' | 'administration' | 'portfolio' | 'commercial', ShellSubItem[]>
  >;
  accessMode: string;
  accessBranches?: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
  onLogout: () => void;
  userDisplayName?: string;
  userRoleLabel?: string;
  children: ReactNode;
}) {
  const branches = accessBranches ?? [];
  const [open, setOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeNavRef = useRef<HTMLButtonElement>(null);
  const navAsideRef = useRef<HTMLElement>(null);

  const navigate = (href: string) => window.location.assign(href);

  const sidebarSubNavigation: {
    organization?: NavigationItem[];
    administration?: NavigationItem[];
    portfolio?: NavigationItem[];
  } = {};
  if (subNavigation.organization) sidebarSubNavigation.organization = subNavigation.organization;
  if (subNavigation.administration)
    sidebarSubNavigation.administration = subNavigation.administration;
  if (subNavigation.portfolio) sidebarSubNavigation.portfolio = subNavigation.portfolio;

  const sidebarGroups = buildSidebarAccordion({
    permissions,
    navigate,
    subNavigation: sidebarSubNavigation,
  });
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebarLayoutState(
    activeItem,
    sidebarGroups,
  );
  const isDesktop = useIsDesktop();
  const sidebarWidthClass = isDesktop && sidebarCollapsed ? 'w-16' : 'w-[252px]';
  const contentOffsetClass = isDesktop && sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-[252px]';
  const accordionCollapsed = isDesktop && sidebarCollapsed;
  const dashboardSelected =
    active === 'overview' ||
    activeItem === 'profile' ||
    normalizeActiveItem(activeItem) === 'profile';

  const displayName = userDisplayName ?? branchLabel(accessMode, branches);
  const roleLabel = userRoleLabel ?? humanize(accessMode);
  const initials = userInitials(displayName);

  useEffect(() => {
    if (!open) {
      menuTriggerRef.current?.focus();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = navAsideRef.current?.querySelectorAll<HTMLElement>(
        'button, a, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    closeNavRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="min-h-screen bg-[var(--background)] font-sans text-slate-900">
      <button
        type="button"
        ref={menuTriggerRef}
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        ref={navAsideRef}
        id="main-navigation"
        className={
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white text-slate-900 shadow-sm transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ' +
          sidebarWidthClass +
          ' ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className={'border-b border-slate-200 py-5 ' + (sidebarCollapsed ? 'px-2' : 'px-5')}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            {!accordionCollapsed ? (
              <div className="min-w-0 flex-1 leading-tight">
                <strong className="block truncate text-sm font-bold text-slate-900">Horizon</strong>
                <span className="block text-[11px] text-slate-500">Real Estate Operations</span>
              </div>
            ) : null}            <button
              type="button"
              ref={closeNavRef}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav
          className="sidebar-scrollbar flex-1 overflow-y-auto px-2 py-4 lg:px-3"
          aria-label="Main navigation"
        >
          <div className="mb-2">
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              title="Dashboard"
              className={
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ' +
                (dashboardSelected
                  ? 'bg-emerald-50 text-emerald-900'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900')
              }
            >
              <Home
                className={
                  'h-[18px] w-[18px] shrink-0 ' +
                  (dashboardSelected ? 'text-emerald-700' : 'text-slate-400')
                }
                aria-hidden="true"
              />
              {!accordionCollapsed ? <span>Dashboard</span> : null}
            </Link>
          </div>

          <SidebarAccordion
            groups={sidebarGroups}
            activeItem={activeItem}
            collapsed={accordionCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            onNavigate={() => setOpen(false)}
          />
        </nav>

        {!accordionCollapsed ? (
          <div className="border-t border-slate-200 px-4 py-4">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{roleLabel}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            </div>
          </div>
        ) : null}
      </aside>

      <div className={'min-h-screen ' + contentOffsetClass}>
        <AppHeader
          permissions={permissions}
          accessMode={accessMode}
          accessBranches={branches}
          userDisplayName={displayName}
          userRoleLabel={roleLabel}
          onLogout={onLogout}
        />

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
