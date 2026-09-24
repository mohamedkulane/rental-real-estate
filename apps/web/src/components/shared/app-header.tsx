'use client';

import type { RefObject } from 'react';
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { humanize } from '@/lib/presentation';
import { api } from '@/lib/phase3-api';
import {
  startNewDestinations,
  startNewNavigation,
} from './navigation-model';

type SearchResult = {
  type: string;
  id: string;
  label: string;
  context: string;
  branch?: string;
  href: string;
};

type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  linkPath?: string | null;
  status: string;
  createdAt: string;
};

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
  companyName,
  userDisplayName,
  userRoleLabel,
  onLogout,
}: {
  permissions: string[];
  accessMode: string;
  accessBranches?: Array<{ id: string; code: string; name: string }>;
  companyName?: string;
  userDisplayName?: string;
  userRoleLabel?: string;
  onLogout: () => void;
}) {
  const router = useRouter();
  const branches = accessBranches;
  const [startNewOpen, setStartNewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const startNewTriggerRef = useRef<HTMLButtonElement>(null);
  const startNewDialogRef = useRef<HTMLElement>(null);
  const startNewCloseRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  const canSearch = permissions.includes('search.read');
  const navigate = (href: string) => router.push(href);
  const startNewItems = startNewNavigation(permissions, (href) => {
    setStartNewOpen(false);
    navigate(href);
  });

  const displayName = userDisplayName ?? branchLabel(accessMode, branches);
  const roleLabel = userRoleLabel ?? humanize(accessMode);
  const initials = userInitials(displayName);
  const branchName = branchLabel(accessMode, branches);
  const workspaceName = companyName?.trim() || branchName;

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api<{ items: NotificationItem[]; unreadCount: number }>('/notifications');
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!canSearch) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void api<{ items: SearchResult[] }>(`/search?q=${encodeURIComponent(trimmed)}`)
        .then((data) => setSearchResults(data.items))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [canSearch, searchQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
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
    if (!profileOpen && !notificationsOpen && !searchOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileOpen && !profileMenuRef.current?.contains(target)) setProfileOpen(false);
      if (notificationsOpen && !notificationPanelRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }
      if (searchOpen && !searchPanelRef.current?.contains(target)) setSearchOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [notificationsOpen, profileOpen, searchOpen]);

  async function markNotificationRead(id?: string) {
    await api(`/notifications/read${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
      method: 'POST',
    });
    await loadNotifications();
  }

  function selectSearchResult(result: SearchResult) {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(result.href);
  }

  return (
    <>
      <header className="app-header sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="app-header-inner">
          <div className="app-header-left">
            {canSearch ? (
              <div className="relative" ref={searchPanelRef}>
                <label className="app-header-search">
                  <span className="sr-only">Global search</span>
                  <Search className="app-header-search-icon" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search properties, owners, tenants, leads..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={searchOpen}
                    aria-controls="global-search-results"
                  />
                  <kbd className="app-header-search-kbd">Ctrl K</kbd>
                </label>
                {searchOpen && searchQuery.trim().length >= 2 ? (
                  <div
                    id="global-search-results"
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                  >
                    {searchLoading ? (
                      <p className="px-4 py-3 text-sm text-slate-500">Searching...</p>
                    ) : searchResults.length ? (
                      <ul>
                        {searchResults.map((result) => (
                          <li key={`${result.type}-${result.id}`}>
                            <button
                              type="button"
                              role="option"
                              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                              onClick={() => selectSearchResult(result)}
                            >
                              <span className="mt-0.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                {humanize(result.type)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900">
                                  {result.label}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {result.context}
                                  {result.branch ? ` · ${result.branch}` : ''}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-3 text-sm text-slate-500">No matching records found.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
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
              <Building2 className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <span className="truncate">{workspaceName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </button>

            <div className="relative" ref={notificationPanelRef}>
              <button
                type="button"
                className="app-header-icon-button relative"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  void loadNotifications();
                }}
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="app-header-notification-badge">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Notifications</p>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--primary)]"
                        onClick={() => void markNotificationRead()}
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  {notifications.length ? (
                    <ul className="max-h-80 overflow-y-auto">
                      {notifications.map((item) => (
                        <li key={item.id} className="border-b border-slate-50 last:border-b-0">
                          <button
                            type="button"
                            role="menuitem"
                            className={
                              'flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50 ' +
                              (item.status === 'UNREAD' ? 'bg-[var(--primary-soft)]' : '')
                            }
                            onClick={() => {
                              void markNotificationRead(item.id);
                              setNotificationsOpen(false);
                              if (item.linkPath) navigate(item.linkPath);
                            }}
                          >
                            <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                            <span className="text-xs text-slate-500">{item.body}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-6 text-sm text-slate-500">No notifications yet.</p>
                  )}
                </div>
              ) : null}
            </div>

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
            className="start-new-dialog w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
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
                    className="start-new-item flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                    onClick={item.onSelect}
                  >
                    <span className="start-new-item-icon mt-0.5 rounded-lg bg-[var(--primary-soft)] p-2 text-[var(--primary)]">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="start-new-item-title block text-sm font-bold text-slate-900">{item.label}</span>
                      <span className="start-new-item-description block text-xs text-slate-500">
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
