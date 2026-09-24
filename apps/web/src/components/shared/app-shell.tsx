'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  ChevronsLeft,
  ChevronsRight,
  Home,
  Menu,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { humanize } from '@/lib/presentation';
import { api } from '@/lib/phase3-api';
import { AppHeader } from './app-header';
import {
  normalizeActiveItem,
  type NavigationItem,
} from './navigation-model';
import { SidebarAccordion, useSidebarLayoutState } from './sidebar-accordion';
import { buildSidebarAccordion } from './sidebar-navigation';

const MINT = '#0F766E';
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

function subscribeDesktop(onStoreChange: () => void) {
  const media = window.matchMedia('(min-width: 1024px)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function readDesktop() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, readDesktop, () => false);
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

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
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
  const router = useRouter();
  const branches = accessBranches ?? [];
  const [open, setOpen] = useState(false);
  const [companyBrand, setCompanyBrand] = useState<{
    name?: string | null;
    displayName?: string | null;
    logoMetadata?: {
      url?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
    } | null;
  }>({});
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeNavRef = useRef<HTMLButtonElement>(null);
  const navAsideRef = useRef<HTMLElement>(null);

  const navigate = (href: string) => router.push(href);

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
  const sidebarWidthClass = isDesktop && sidebarCollapsed ? 'w-[72px]' : 'w-[252px]';
  const contentOffsetClass = isDesktop && sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[252px]';
  const accordionCollapsed = isDesktop && sidebarCollapsed;
  const dashboardSelected =
    active === 'overview' ||
    activeItem === 'profile' ||
    normalizeActiveItem(activeItem) === 'profile';

  const displayName = userDisplayName ?? branchLabel(accessMode, branches);
  const roleLabel = userRoleLabel ?? humanize(accessMode);

  useEffect(() => {
    if (!permissions.includes('organization.company.read')) return;
    const refreshCompanyBrand = () => {
      void api<typeof companyBrand>('/company')
        .then(setCompanyBrand)
        .catch(() => undefined);
    };
    refreshCompanyBrand();
    window.addEventListener('company-brand-updated', refreshCompanyBrand);
    return () => window.removeEventListener('company-brand-updated', refreshCompanyBrand);
  }, [permissions]);

  const companyName = companyBrand.displayName || companyBrand.name || displayName;
  const primaryColor = /^#[0-9A-Fa-f]{6}$/.test(companyBrand.logoMetadata?.primaryColor ?? '')
    ? companyBrand.logoMetadata!.primaryColor!
    : '#215E61';
  const accentColor = /^#[0-9A-Fa-f]{6}$/.test(companyBrand.logoMetadata?.accentColor ?? '')
    ? companyBrand.logoMetadata!.accentColor!
    : '#2563EB';
  const brandStyle = {
    '--primary': primaryColor,
    '--primary-hover': `color-mix(in srgb, ${primaryColor} 84%, #000)`,
    '--primary-soft': `${primaryColor}18`,
    '--primary-accent': accentColor,
    '--info': accentColor,
    '--info-soft': `${accentColor}18`,
  } as CSSProperties;

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
    <div
      className="app-brand-root min-h-screen bg-[var(--background)] font-sans text-slate-900"
      style={brandStyle}
    >
      <button
        type="button"
        ref={menuTriggerRef}
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 text-[#0F172A] shadow-sm lg:hidden"
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
          className="fixed inset-0 z-40 bg-[#0F172A]/40 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        ref={navAsideRef}
        id="main-navigation"
        className={
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-[#F8FAFC] text-[#0F172A] shadow-sm transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ' +
          sidebarWidthClass +
          ' ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className={'border-b border-slate-200/80 py-4 ' + (sidebarCollapsed ? 'px-2' : 'px-3')}>
          <div
            className={'flex items-center gap-2.5 ' + (accordionCollapsed ? 'justify-center' : '')}
          >
            {companyBrand.logoMetadata?.url ? (
              <img
                src={companyBrand.logoMetadata.url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-[var(--primary)]/20"
              />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: MINT }}
              >
                <Home className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            {!accordionCollapsed ? (
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[15px] font-bold text-[#0F172A]">
                  {companyName}
                </strong>
                <span className="block truncate text-[11px] font-medium text-[#0F172A]/55">
                  Real Estate Management
                </span>
              </span>
            ) : null}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[#0F172A]/60 transition hover:bg-[#E6F4F1] hover:text-[#0F766E] lg:inline-flex"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                ref={closeNavRef}
                className="rounded-md p-1.5 text-[#0F172A]/60 hover:bg-[#E6F4F1] hover:text-[#0F766E] lg:hidden"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <nav
          className="sidebar-scrollbar flex-1 overflow-y-auto px-2 py-3 lg:px-3"
          aria-label="Main navigation"
        >
          <div className="mb-1">
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              title="Dashboard"
              className={
                'relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/25 ' +
                (dashboardSelected
                  ? 'bg-[#E6F4F1] text-[#0F172A]'
                  : 'text-[#0F172A]/80 hover:bg-slate-50')
              }
            >
              {dashboardSelected ? (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#0F766E]"
                  aria-hidden="true"
                />
              ) : null}
              <Home
                className={
                  'ml-1 h-[18px] w-[18px] shrink-0 ' +
                  (dashboardSelected ? 'text-[#0F766E]' : 'text-[#0F172A]/55')
                }
                aria-hidden="true"
              />
              {!accordionCollapsed ? <span>Dashboard</span> : null}
            </Link>
          </div>

          <SidebarAccordion
            groups={sidebarGroups}
            {...(activeItem ? { activeItem } : {})}
            collapsed={accordionCollapsed}
            onNavigate={() => setOpen(false)}
          />
        </nav>
        <div
          className={
            'mt-auto border-t border-slate-200/80 p-2 ' + (accordionCollapsed ? 'px-1.5' : 'px-3')
          }
        >
          <div
            className={
              'flex items-center gap-2.5 rounded-xl px-2 py-2 ' +
              (accordionCollapsed ? 'justify-center' : '')
            }
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: MINT }}
            >
              {userInitials(displayName)}
            </span>
            {!accordionCollapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-[#0F172A]">
                    {displayName}
                  </strong>
                  <span className="block truncate text-[11px] text-[#0F172A]/50">{roleLabel}</span>
                </span>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-[#0F172A]/40 hover:bg-[#E6F4F1] hover:text-[#0F766E]"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={onLogout}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </aside>

      <div className={'min-h-screen ' + contentOffsetClass}>
        <AppHeader
          permissions={permissions}
          accessMode={accessMode}
          accessBranches={branches}
          userDisplayName={displayName}
          userRoleLabel={roleLabel}
          companyName={companyName}
          onLogout={onLogout}
        />

        <main className="mx-auto w-full max-w-[1600px] p-3 sm:p-5 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
