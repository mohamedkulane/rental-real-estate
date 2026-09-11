'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_EXPANDED_STORAGE_KEY,
  childIsActive,
  expandedGroupForActive,
  groupContainsActiveItem,
  type SidebarAccordionGroup,
} from './sidebar-navigation';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function SidebarAccordion({
  groups,
  activeItem,
  collapsed,
  onCollapsedChange,
  onNavigate,
}: {
  groups: SidebarAccordionGroup[];
  activeItem?: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onNavigate: () => void;
}) {
  const activeGroupId = useMemo(() => expandedGroupForActive(groups, activeItem), [groups, activeItem]);
  const [expandedGroup, setExpandedGroup] = useState<string | undefined>(() => activeGroupId);
  const [flyoutGroup, setFlyoutGroup] = useState<string | undefined>();

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
      <div className="mb-2 hidden px-2 lg:flex lg:justify-end">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            setFlyoutGroup(undefined);
            onCollapsedChange(!collapsed);
          }}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

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
                  'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ' +
                  (groupActive
                    ? 'bg-emerald-50/80 text-emerald-900'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900')
                }
              >
                <Icon
                  className={
                    'h-[18px] w-[18px] shrink-0 ' +
                    (groupActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600')
                  }
                  aria-hidden="true"
                />
                {!collapsed ? <span className="min-w-0 flex-1 truncate">{group.label}</span> : null}
                {!collapsed ? (
                  <ChevronRight
                    className={
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ' +
                      (isOpen ? 'rotate-90' : '')
                    }
                    aria-hidden="true"
                  />
                ) : null}
              </button>

              {!collapsed && isOpen ? (
                <div id={`sidebar-group-${group.id}`} className="pb-1 pt-0.5">
                  <div className="ml-3 border-l border-slate-200 pl-2">
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
                            'relative flex min-h-9 w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ' +
                            (selected
                              ? 'bg-emerald-50 text-emerald-900 before:absolute before:-left-2 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-emerald-600'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                          }
                        >
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {collapsed && isOpen ? (
                <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs font-semibold text-slate-500">{group.label}</p>
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
                          'flex w-full rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors ' +
                          (selected
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'text-slate-700 hover:bg-slate-50')
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  return { collapsed, setCollapsed, activeGroupId };
}
