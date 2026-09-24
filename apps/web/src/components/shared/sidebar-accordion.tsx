'use client';

import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_EXPANDED_STORAGE_KEY,
  childIsActive,
  expandedGroupForActive,
  groupContainsActiveItem,
  type SidebarAccordionGroup,
} from './sidebar-navigation';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeSidebarCollapsed(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function SidebarAccordion({
  groups,
  activeItem,
  collapsed,
  onNavigate,
}: {
  groups: SidebarAccordionGroup[];
  activeItem?: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const activeGroupId = useMemo(() => expandedGroupForActive(groups, activeItem), [groups, activeItem]);
  const [expandedGroup, setExpandedGroup] = useState<string | undefined>(() => activeGroupId);
  const [flyoutGroup, setFlyoutGroup] = useState<string | undefined>();

  useEffect(() => {
    if (collapsed) setFlyoutGroup(undefined);
  }, [collapsed]);

  useEffect(() => {
    if (activeGroupId) setExpandedGroup(activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    if (collapsed || !expandedGroup) return;
    try {
      window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, expandedGroup);
    } catch {
      /* ignore storage failures */
    }
  }, [collapsed, expandedGroup]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore storage failures */
    }
  }, [collapsed]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) {
      setFlyoutGroup((current) => (current === groupId ? undefined : groupId));
      return;
    }
    setExpandedGroup((current) => (current === groupId ? undefined : groupId));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-0.5">
        {groups.map((group) => {
          const Icon = group.icon;
          const isOpen = collapsed ? flyoutGroup === group.id : expandedGroup === group.id;
          const groupActive = groupContainsActiveItem(group, activeItem);

          return (
            <div key={group.id} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`sidebar-group-${group.id}`}
                title={collapsed ? group.label : undefined}
                onClick={() => toggleGroup(group.id)}
                className={
                  'group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[14px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ' +
                  (groupActive
                    ? 'bg-[var(--primary-soft)] text-[#0F172A]'
                    : 'text-[#0F172A]/80 hover:bg-slate-50 hover:text-[#0F172A]')
                }
              >
                <Icon
                  className={
                    'ml-1 h-[18px] w-[18px] shrink-0 ' +
                    (groupActive ? 'text-[var(--primary)]' : 'text-[#0F172A]/55 group-hover:text-[var(--primary)]')
                  }
                  aria-hidden="true"
                />
                {!collapsed ? <span className="min-w-0 flex-1 truncate">{group.label}</span> : null}
                {!collapsed ? (
                  <ChevronRight
                    className={
                      'h-4 w-4 shrink-0 text-[#0F172A]/35 transition-transform duration-200 ' +
                      (isOpen ? 'rotate-90 text-[var(--primary)]' : '')
                    }
                    aria-hidden="true"
                  />
                ) : null}
              </button>

              {!collapsed && isOpen ? (
                <div id={`sidebar-group-${group.id}`} className="pb-1 pt-0.5">
                  <div className="ml-4 pl-2">
                    {group.children.map((child) => {
                      const selected = childIsActive(child.key, activeItem);
                      return (
                        <button
                          key={child.key}
                          type="button"
                          aria-current={selected ? 'page' : undefined}
                          onClick={() => {
                            child.onSelect?.();
                            onNavigate();
                          }}
                          className={
                            'relative flex min-h-9 w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ' +
                            (selected
                              ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary)]'
                              : 'text-[#0F172A]/65 hover:bg-slate-50 hover:text-[#0F172A]')
                          }
                        >
                          {selected ? (
                            <span
                              className="absolute -left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--primary)]"
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {collapsed && isOpen ? (
                <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs font-semibold text-[#0F172A]/50">{group.label}</p>
                  {group.children.map((child) => {
                    const selected = childIsActive(child.key, activeItem);
                    return (
                      <button
                        key={child.key}
                        type="button"
                        aria-current={selected ? 'page' : undefined}
                        onClick={() => {
                          child.onSelect?.();
                          setFlyoutGroup(undefined);
                          onNavigate();
                        }}
                        className={
                          'flex w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ' +
                          (selected
                            ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary)]'
                            : 'text-[#0F172A]/80 hover:bg-slate-50')
                        }
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function useSidebarLayoutState(activeItem?: string, groups: SidebarAccordionGroup[] = []) {
  const activeGroupId = useMemo(() => expandedGroupForActive(groups, activeItem), [groups, activeItem]);
  const storedCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readCollapsed,
    () => false,
  );
  const [collapsed, setCollapsed] = useState(storedCollapsed);

  useEffect(() => {
    setCollapsed(storedCollapsed);
  }, [storedCollapsed]);

  return { collapsed, setCollapsed, activeGroupId };
}
