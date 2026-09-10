'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ContactRound,
  Home,
  Landmark,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { AccessScopeBadge } from './ui';
import {
  buildSidebarGroups,
  expandedParentForActive,
  navigationItemIsActive,
  nextExpandedParent,
  normalizeActiveItem,
  startNewDestinations,
  startNewNavigation,
  type NavigationItem,
  type SidebarGroup,
} from './navigation-model';

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

type NavItem = ShellSubItem & { icon?: LucideIcon };

const COMPANY_ICONS: Record<string, LucideIcon> = {
  company: Landmark,
  branches: Building2,
  employees: Users,
  users: UserCog,
  roles: ShieldCheck,
};

const PROPERTY_ICONS: Record<string, LucideIcon> = {
  parties: ContactRound,
  owners: Users,
  properties: Building2,
  spaces: Building2,
  amenities: Building2,
};

function decorateItems(items: NavigationItem[], icons: Record<string, LucideIcon>): NavItem[] {
  return items.map((item) => {
    const decorated: NavItem = { ...item };
    const icon = icons[item.key];
    if (icon) decorated.icon = icon;
    if (item.children?.length) {
      decorated.children = decorateItems(item.children, icons);
    }
    return decorated;
  });
}

function NavGroup({
  title,
  items,
  activeItem,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  activeItem: string | undefined;
  onNavigate: () => void;
}) {
  const normalizedActive = normalizeActiveItem(activeItem);
  const activeParent = expandedParentForActive(items, normalizedActive);
  const [expanded, setExpanded] = useState<string | undefined>(activeParent);

  useEffect(() => {
    if (activeParent) setExpanded(activeParent);
  }, [activeParent]);

  if (!items.length) return null;

  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const selected = navigationItemIsActive(item, normalizedActive);
        const hasChildren = Boolean(item.children?.length);
        const isExpanded = expanded === item.key;

        return (
          <div key={item.key}>
            <button
              type="button"
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-controls={hasChildren ? `nav-children-${item.key}` : undefined}
              aria-current={!hasChildren && selected ? 'page' : undefined}
              onClick={() => {
                if (hasChildren) {
                  setExpanded((current) => nextExpandedParent(current, item.key));
                  return;
                }
                item.onSelect?.();
                onNavigate();
              }}
              className={
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 ' +
                (selected
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-[#1E293B] hover:text-white')
              }
            >
              {Icon ? (
                <Icon
                  className={
                    'h-[18px] w-[18px] shrink-0 ' + (selected ? 'text-white' : 'text-slate-400')
                  }
                  aria-hidden="true"
                />
              ) : (
                <span
                  className={
                    'ml-1 h-1.5 w-1.5 shrink-0 rounded-full ' +
                    (selected ? 'bg-white' : 'bg-slate-600')
                  }
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {hasChildren ? (
                <ChevronRight
                  className={
                    'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ' +
                    (isExpanded ? 'rotate-90' : '')
                  }
                  aria-hidden="true"
                />
              ) : null}
            </button>
            {hasChildren ? (
              <div
                id={`nav-children-${item.key}`}
                className={
                  'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ' +
                  (isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')
                }
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 pb-1 pl-8 pt-1">
                    {item.children?.map((child) => {
                      const childSelected = child.key === normalizedActive;
                      return (
                        <button
                          key={child.key}
                          type="button"
                          aria-current={childSelected ? 'page' : undefined}
                          onClick={() => {
                            child.onSelect?.();
                            onNavigate();
                          }}
                          className={
                            'flex min-h-9 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 ' +
                            (childSelected
                              ? 'bg-[#2563EB]/20 text-white'
                              : 'text-slate-400 hover:bg-[#1E293B] hover:text-slate-100')
                          }
                        >
                          <span
                            className={
                              'h-1.5 w-1.5 shrink-0 rounded-full ' +
                              (childSelected ? 'bg-[#2563EB]' : 'bg-slate-600')
                            }
                            aria-hidden="true"
                          />
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function decorateSidebarGroups(groups: SidebarGroup[]): SidebarGroup[] {
  return groups.map((group) => {
    if (group.id === 'company') {
      return { ...group, items: decorateItems(group.items, COMPANY_ICONS) };
    }
    if (group.id === 'properties') {
      return { ...group, items: decorateItems(group.items, PROPERTY_ICONS) };
    }
    if (group.id === 'workflows') {
      return {
        ...group,
        items: group.items.map((item) => ({ ...item, icon: ClipboardList })),
      };
    }
    return group;
  });
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
  const [startNewOpen, setStartNewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const startNewTriggerRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeNavRef = useRef<HTMLButtonElement>(null);
  const navAsideRef = useRef<HTMLElement>(null);
  const startNewDialogRef = useRef<HTMLElement>(null);
  const startNewCloseRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const navigate = (href: string) => window.location.assign(href);
  const startNewItems = startNewNavigation(permissions, (href) => {
    setStartNewOpen(false);
    navigate(href);
  });

  const sidebarSubNavigation: {
    organization?: NavigationItem[];
    administration?: NavigationItem[];
    portfolio?: NavigationItem[];
  } = {};
  if (subNavigation.organization) sidebarSubNavigation.organization = subNavigation.organization;
  if (subNavigation.administration)
    sidebarSubNavigation.administration = subNavigation.administration;
  if (subNavigation.portfolio) sidebarSubNavigation.portfolio = subNavigation.portfolio;

  const sidebarGroups = decorateSidebarGroups(
    buildSidebarGroups({
      permissions,
      navigate,
      subNavigation: sidebarSubNavigation,
    }),
  );

  const dashboardSelected =
    active === 'overview' ||
    activeItem === 'profile' ||
    normalizeActiveItem(activeItem) === 'profile';

  const displayName = userDisplayName ?? branchLabel(accessMode, branches);
  const roleLabel = userRoleLabel ?? humanize(accessMode);
  const initials = userInitials(displayName);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!startNewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStartNewOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = startNewDialogRef.current?.querySelectorAll<HTMLElement>(
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
    startNewCloseRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startNewOpen]);

  useEffect(() => {
    if (!startNewOpen) startNewTriggerRef.current?.focus();
  }, [startNewOpen]);

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

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#020617] text-white shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <strong className="block truncate text-sm font-bold">RealEstate Pro</strong>
              <span className="block text-[11px] text-slate-400">Properties. People. Possibilities.</span>
            </div>
            <button
              type="button"
              ref={closeNavRef}
              className="rounded-md p-1.5 text-slate-400 hover:bg-[#1E293B] hover:text-white lg:hidden"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav
          className="sidebar-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5"
          aria-label="Main navigation"
        >
          <div>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              DASHBOARD
            </p>
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 ' +
                (dashboardSelected
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-[#1E293B] hover:text-white')
              }
            >
              <Home
                className={
                  'h-[18px] w-[18px] ' + (dashboardSelected ? 'text-white' : 'text-slate-400')
                }
                aria-hidden="true"
              />
              Dashboard
            </Link>
          </div>

          {sidebarGroups.map((group) => (
            <NavGroup
              key={group.id}
              title={group.title}
              items={group.items as NavItem[]}
              activeItem={activeItem}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-400">{roleLabel}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
            <div className="order-2 min-w-0 flex-1 lg:order-1 lg:max-w-xl">
              <label className="relative block">
                <span className="sr-only">Global search</span>
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search properties, owners, tenants, leads..."
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-20 text-sm text-slate-700 shadow-sm transition focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline">
                  Ctrl K
                </kbd>
              </label>
            </div>

            <div className="order-1 ml-12 flex w-full items-center justify-end gap-2 sm:ml-0 sm:w-auto lg:order-2 lg:ml-auto">
              {startNewItems.length ? (
                <button
                  ref={startNewTriggerRef}
                  type="button"
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#2563EB] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                  aria-haspopup="dialog"
                  aria-expanded={startNewOpen}
                  onClick={() => setStartNewOpen(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Start New</span>
                </button>
              ) : null}

              <button
                type="button"
                className="header-action relative"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  3
                </span>
              </button>

              <div
                className="hidden min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex"
                aria-label="Branch context"
              >
                <Building2 className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                <span className="truncate">{branchLabel(accessMode, branches)}</span>
              </div>

              <AccessScopeBadge mode={accessMode} branches={branches} />

              <div className="relative" ref={profileMenuRef}>
                <button
                  ref={profileTriggerRef}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-label="Open user menu"
                  onClick={() => setProfileOpen((value) => !value)}
                >
                  {initials}
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  >
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                      <p className="truncate text-xs text-slate-500">{roleLabel}</p>
                    </div>
                    <div className="px-3 py-2">
                      <AccessScopeBadge mode={accessMode} branches={branches} />
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {startNewOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 pt-20 backdrop-blur-[1px] sm:pt-24"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setStartNewOpen(false);
            }}
          >
            <section
              ref={startNewDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="start-new-title"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Workspace launcher
                  </p>
                  <h2 id="start-new-title" className="mt-1 text-lg font-bold text-slate-900">
                    Start New
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a task available to your current access.
                  </p>
                </div>
                <button
                  ref={startNewCloseRef}
                  type="button"
                  aria-label="Close Start New"
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                  onClick={() => setStartNewOpen(false)}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-2">
                {startNewItems.map((item) => {
                  const destination = startNewDestinations.find((entry) => entry.key === item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#2563EB]/40 hover:bg-[#EFF6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                      onClick={item.onSelect}
                    >
                      <span className="mt-0.5 rounded-lg bg-[#EFF6FF] p-2 text-[#2563EB]">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                        <span className="block text-xs text-slate-500">
                          {destination?.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
