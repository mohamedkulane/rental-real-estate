'use client';

import Link from 'next/link';
import { ClipboardList, Eye, HardHat, Wrench } from 'lucide-react';
import { DataTableSurface } from '@/components/shared/data-table';
import { DataTableEmpty } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/ui';
import { hasPermission } from '@/lib/phase3-api';
import { OperationsShell, useOperationsPrincipal } from './operations-shell';

const workspaces = [
  {
    label: 'Maintenance',
    description: 'Review and assign property or tenant maintenance requests.',
    href: '/operations/maintenance',
    permission: 'maintenance.read',
    icon: Wrench,
  },
  {
    label: 'Work Orders',
    description: 'Schedule and track work assigned to service providers.',
    href: '/operations/work-orders',
    permission: 'maintenance.read',
    icon: ClipboardList,
  },
  {
    label: 'Inspections',
    description: 'Plan inspections and review property condition activity.',
    href: '/operations/inspections',
    permission: 'inspection.read',
    icon: Eye,
  },
  {
    label: 'Vendors',
    description: 'Manage the service providers available to operations teams.',
    href: '/operations/vendors',
    permission: 'vendor.read',
    icon: HardHat,
  },
] as const;

export function OperationsOverview() {
  const { principal } = useOperationsPrincipal();
  const visibleWorkspaces = principal
    ? workspaces.filter((workspace) => hasPermission(principal, workspace.permission))
    : [];

  return (
    <OperationsShell principal={principal} activeItem="operations:overview">
      <PageHeader
        eyebrow="Operations"
        title="Operations Overview"
        description="Move quickly between maintenance, work orders, inspections, and vendors."
      />

      {principal && !visibleWorkspaces.length ? (
        <DataTableEmpty
          title="Access restricted"
          description="Your current access does not include an Operations workspace."
        />
      ) : (
        <DataTableSurface>
          <header className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Operations workspaces</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a workspace to review operational records and next actions.
            </p>
          </header>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleWorkspaces.map((workspace) => {
              const Icon = workspace.icon;
              return (
                <Link
                  key={workspace.href}
                  href={workspace.href}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                >
                  <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition group-hover:bg-[var(--primary-soft)] group-hover:text-[var(--primary)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{workspace.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{workspace.description}</p>
                </Link>
              );
            })}
          </div>
        </DataTableSurface>
      )}
    </OperationsShell>
  );
}
