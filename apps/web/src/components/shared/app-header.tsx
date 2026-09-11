'use client';

import type { RefObject } from 'react';
import {
  Bell,
  Building2,
  ChevronDown,
  Landmark,
  LogOut,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { humanize } from '@/lib/presentation';
import {
  startNewDestinations,
  startNewNavigation,
} from './navigation-model';

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

export function AppHeader({
  permissions,
  accessMode,
  accessBranches = [],
  userDisplayName,
  userRoleLabel,
  onLogout,
}: {
  permissions: string[];
  accessMode: string;
  accessBranches?: Array<{ id: string; code: string; name: string }>;
  userDisplayName?: string;
  userRoleLabel?: string;
  onLogout: () => void;
}) {
  const branches = accessBranches;
  const [startNewOpen, setStartNewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const startNewTriggerRef = useRef<HTMLButtonElement>(null);
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

  const displayName = userDisplayName ?? branchLabel(accessMode, branches);
  const roleLabel = userRoleLabel ?? humanize(accessMode);
  const initials = userInitials(displayName);
  const branchName = branchLabel(accessMode, branches);

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
    <>
      <header className="app-header sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="app-header-inner">
          <div className="app-header-left">
            <div className="app-header-brand hidden xl:flex" aria-hidden="true">
              <span className="app-header-brand-mark">
                <Landmark className="h-4 w-4" />
              </span>
              <span className="app-header-brand-copy">
                <strong>Horizon</strong>
                <span>Real Estate</span>
              </span>
            </div>
            <label className="app-header-search">
              <span className="sr-only">Global search</span>
              <Search className="app-header-search-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search properties, owners, tenants, leads..."
              />
              <kbd className="app-header-search-kbd">Ctrl K</kbd>
            </label>
          </div>

          <div className="app-header-actions">
            {startNewItems.length ? (
              <button
                ref={startNewTriggerRef}
                type="button"
                className="app-header-start-new"
                aria-haspopup="dialog"
                aria-expanded={startNewOpen}
                onClick={() => setStartNewOpen(true)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">+ Start New</span>
              </button>
            ) : null}

            <button
              type="button"
              className="app-header-branch hidden md:inline-flex"
              aria-label="Current branch"
            >
              <Building2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="truncate">{branchName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </button>

            <button type="button" className="app-header-icon-button relative" aria-label="Notifications">
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span className="app-header-notification-badge">3</span>
            </button>

            <div className="relative" ref={profileMenuRef}>
              <button
                ref={profileTriggerRef}
                type="button"
                className="app-header-profile"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Open user menu"
                onClick={() => setProfileOpen((value) => !value)}
              >
                <span className="app-header-avatar">{initials}</span>
                <span className="app-header-profile-copy hidden lg:block">
                  <strong>{displayName}</strong>
                  <span>{roleLabel}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-400 lg:block" aria-hidden="true" />
              </button>
              {profileOpen ? (
                <div role="menu" className="app-header-profile-menu">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{roleLabel}</p>
                  </div>
                  <div className="border-b border-slate-100 px-3 py-2 md:hidden">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Branch
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{branchName}</p>
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
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
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                    onClick={item.onSelect}
                  >
                    <span className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-700">
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
    </>
  );
}

export type AppHeaderSearchRef = RefObject<HTMLInputElement | null>;
