'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Home,
  Landmark,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { AccessScopeBadge } from './ui';

export type ShellSection = 'overview' | 'organization' | 'portfolio' | 'administration';
export type ShellSubItem = { key: string; label: string; onSelect: () => void };

type NavItem = ShellSubItem & { icon?: typeof Home | undefined };

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
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const selected = activeItem === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              item.onSelect();
              onNavigate();
            }}
            className={
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
              (selected
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white')
            }
          >
            {Icon ? (
              <Icon
                className={
                  'h-[18px] w-[18px] ' + (selected ? 'text-emerald-400' : 'text-slate-400')
                }
                aria-hidden="true"
              />
            ) : (
              <span
                className={
                  'ml-1 h-1.5 w-1.5 rounded-full ' + (selected ? 'bg-emerald-400' : 'bg-slate-600')
                }
                aria-hidden="true"
              />
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {selected ? (
              <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AppShell({
  active,
  activeItem,
  subNavigation = {},
  accessMode,
  accessBranches,
  permissions,
  onLogout,
  children,
}: {
  active: ShellSection;
  activeItem?: string;
  subNavigation?: Partial<Record<ShellSection, ShellSubItem[]>>;
  accessMode: string;
  accessBranches?: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const organization = subNavigation.organization ?? [];
  const administration = subNavigation.administration ?? [];
  const portfolio = subNavigation.portfolio ?? [];
  const pick = (items: ShellSubItem[], keys: string[], icons: Record<string, typeof Home> = {}) =>
    keys
      .map((key) => items.find((item) => item.key === key))
      .filter((item): item is ShellSubItem => Boolean(item))
      .map((item) => ({ ...item, icon: icons[item.key] }));

  const go = (key: string, label: string, url: string, icon: typeof Home): NavItem => ({
    key,
    label,
    icon,
    onSelect: () => window.location.assign(url),
  });
  const can = (permission: string) => permissions.includes(permission);
  const allowed = (permission: string, item: NavItem): NavItem[] => (can(permission) ? [item] : []);
  const companySetup = organization.length
    ? pick(organization, ['company', 'branches'], { company: Landmark, branches: Building2 })
    : [
        ...allowed(
          'organization.company.read',
          go('company', 'Company', '/admin?section=company', Landmark),
        ),
        ...allowed(
          'organization.branch.read',
          go('branches', 'Branches', '/admin?section=branches', Building2),
        ),
      ];
  const localTeamAccess = [
    ...pick(organization, ['employees'], { employees: Users }),
    ...pick(administration, ['users', 'roles'], {
      users: UserCog,
      roles: ShieldCheck,
      permissions: ShieldCheck,
    }),
  ];
  const teamAccess = localTeamAccess.length
    ? localTeamAccess
    : [
        ...allowed(
          'identity.employee.read',
          go('employees', 'Employees', '/admin?section=employees', Users),
        ),
        ...allowed(
          'identity.user.read',
          go('users', 'User accounts', '/admin?section=users', UserCog),
        ),
        ...allowed(
          'identity.role.read',
          go('roles', 'Roles & permissions', '/admin?section=roles', ShieldCheck),
        ),
      ];
  const portfolioItems = portfolio.length
    ? portfolio
    : [
        ...allowed(
          'party.read',
          go('parties', 'People & organizations', '/portfolio?section=parties', Users),
        ),
        ...allowed('owner.read', go('owners', 'Owners', '/portfolio?section=owners', Users)),
        ...allowed(
          'portfolio.property.read',
          go('properties', 'Properties', '/portfolio?section=properties', Building2),
        ),
        ...allowed(
          'portfolio.space.read',
          go('spaces', 'Rentable spaces', '/portfolio?section=spaces', Building2),
        ),
        ...allowed(
          'portfolio.amenity.read',
          go('amenities', 'Amenities', '/portfolio?section=amenities', Building2),
        ),
      ];
  const oversight = administration.length
    ? pick(administration, ['audit'], { audit: ClipboardList })
    : allowed(
        'governance.audit.read',
        go('audit', 'Audit log', '/admin?section=audit', ClipboardList),
      );
  const settings = organization.length
    ? pick(organization, ['settings'], { settings: Settings })
    : allowed(
        'organization.company.read',
        go('settings', 'Settings', '/admin?section=settings', Settings),
      );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
        aria-label="Open navigation"
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
        className={
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white shadow-xl transition-transform duration-200 lg:translate-x-0 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <strong className="block truncate text-sm font-bold">Rental Operations</strong>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Staff workspace
            </span>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          className="sidebar-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5"
          aria-label="Main navigation"
        >
          <div>
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ' +
                (active === 'overview'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white')
              }
            >
              <Home
                className={
                  'h-[18px] w-[18px] ' +
                  (active === 'overview' ? 'text-emerald-400' : 'text-slate-400')
                }
              />
              Overview
            </Link>
          </div>
          <NavGroup
            title="Company setup"
            items={companySetup}
            activeItem={activeItem}
            onNavigate={() => setOpen(false)}
          />
          <NavGroup
            title="Team & access"
            items={teamAccess}
            activeItem={activeItem}
            onNavigate={() => setOpen(false)}
          />
          <NavGroup
            title="Portfolio"
            items={portfolioItems}
            activeItem={activeItem}
            onNavigate={() => setOpen(false)}
          />
          <NavGroup
            title="Oversight"
            items={oversight}
            activeItem={activeItem}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
          <div className="ml-12 lg:ml-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Rental Operations
            </p>
            <p className="text-sm font-semibold text-slate-700">Secure staff workspace</p>
          </div>
          <div className="flex items-center gap-2">
            {settings[0] ? (
              <button
                type="button"
                onClick={settings[0].onSelect}
                className="header-action"
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            ) : null}
            <AccessScopeBadge mode={accessMode} branches={accessBranches ?? []} />
            <button type="button" className="header-action" onClick={onLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
