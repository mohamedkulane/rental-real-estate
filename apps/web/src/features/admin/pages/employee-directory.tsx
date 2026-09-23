'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import type { FormEvent, ReactNode } from 'react';
import {
  BriefcaseBusiness,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { TableActionButton, TableActionGroup } from '@/components/shared/data-table';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';

type Branch = { id: string; code?: string; name?: string };
type Role = { id: string; code?: string; name?: string };
type Assignment = {
  id: string;
  branchId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  branch?: Branch;
};
type RoleAssignment = {
  id: string;
  branchId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  role: Role;
};
export type EmployeeRecord = {
  id: string;
  employeeNumber: string;
  displayName: string;
  accessMode: string;
  jobTitle?: string | null;
  hireDate?: string | null;
  active: boolean;
  user?: {
    id: string;
    emailNormalized: string;
    status: string;
    sessions?: { id: string; revokedAt?: string | null }[];
  } | null;
  branchAssignments: Assignment[];
  roles: RoleAssignment[];
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD] disabled:bg-slate-100';
const value = (form: FormData, key: string) => {
  const item = form.get(key);
  return typeof item === 'string' ? item.trim() : '';
};

function Panel({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close panel"
        onClick={onClose}
      />
      <section className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

function currentBranches(employee: EmployeeRecord, branches: Branch[], businessDate: string) {
  const now = businessDate;
  return employee.branchAssignments
    .filter(
      (assignment) =>
        assignment.effectiveFrom.slice(0, 10) <= now &&
        (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > now),
    )
    .map(
      (assignment) =>
        assignment.branch ?? branches.find((branch) => branch.id === assignment.branchId),
    )
    .filter((branch): branch is Branch => Boolean(branch));
}

export function EmployeeDirectory({
  records,
  branches,
  roles,
  businessDate,
  busy,
  canCreate,
  canUpdate,
  canManageRoles,
  onCreate,
  onUpdate,
  onStatus,
  onAssignRole,
  onLoadDetails,
}: {
  records: EmployeeRecord[];
  branches: Branch[];
  roles: Role[];
  businessDate: string;
  busy: boolean;
  canCreate: boolean;
  canUpdate: (record: EmployeeRecord) => boolean;
  canManageRoles: (record: EmployeeRecord) => boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, input: Record<string, unknown>) => Promise<void>;
  onStatus: (id: string, input: { active: boolean; reason: string }) => Promise<void>;
  onAssignRole: (id: string, input: Record<string, unknown>) => Promise<void>;
  onLoadDetails: (id: string) => Promise<EmployeeRecord>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [panel, setPanel] = useState<'create' | 'details' | 'edit' | 'status' | 'role' | null>(
    null,
  );
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const filtered = useMemo(
    () =>
      records.filter((employee) => {
        const search = query.trim().toLowerCase();
        const matches =
          !search ||
          [
            employee.displayName,
            employee.employeeNumber,
            employee.jobTitle,
            employee.user?.emailNormalized,
          ]
            .filter(Boolean)
            .some((item) => String(item).toLowerCase().includes(search));
        const accountRestricted =
          employee.user && ['SUSPENDED', 'DISABLED'].includes(employee.user.status);
        const matchesStatus =
          status === 'all' ||
          (status === 'active' && employee.active && !accountRestricted) ||
          (status === 'inactive' && !employee.active) ||
          (status === 'restricted' && Boolean(accountRestricted));
        return matches && matchesStatus;
      }),
    [query, records, status],
  );
  const pagination = usePagination(filtered);
  const close = () => setPanel(null);
  const detail = async (employee: EmployeeRecord) => {
    setSelected(employee);
    setPanel('details');
    setLoadingDetail(true);
    try {
      setSelected(await onLoadDetails(employee.id));
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <span>Team & access</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700">Employees</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage staff identity, branches, business roles, employment status, and login access.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setPanel('create')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0D47A1]"
          >
            <Plus className="h-4 w-4" /> Add employee
          </button>
        ) : null}
      </header>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employees</p>
          <strong className="mt-1 block text-xl">{records.length}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active</p>
          <strong className="mt-1 block text-xl text-[#0D47A1]">
            {records.filter((item) => item.active).length}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Login accounts
          </p>
          <strong className="mt-1 block text-xl">
            {records.filter((item) => item.user).length}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inactive</p>
          <strong className="mt-1 block text-xl text-amber-600">
            {records.filter((item) => !item.active).length}
          </strong>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">Search employees</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, employee number, title, or email…"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]"
            />
          </label>
          <SearchableSelect
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            <option value="active">Active staff</option>
            <option value="all">All staff</option>
            <option value="restricted">Login suspended or disabled</option>
            <option value="inactive">Employment inactive</option>
          </SearchableSelect>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[
                    'Employee',
                    'Job title',
                    'Branches',
                    'Role',
                    'Login account',
                    'Status',
                    'Actions',
                  ].map((header) => (
                    <th
                      key={header}
                      className={
                        'px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ' +
                        (header === 'Actions' ? 'text-right' : '')
                      }
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageItems.map((employee) => {
                  const employeeBranches = currentBranches(employee, branches, businessDate);
                  return (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void detail(employee)}
                          className="flex items-center gap-3 text-left"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {employee.displayName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                          <span>
                            <strong className="block text-sm text-slate-900">
                              {employee.displayName}
                            </strong>
                            <span className="text-xs text-slate-500">
                              {employee.employeeNumber}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {employee.jobTitle || 'Not assigned'}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {employeeBranches.length
                          ? employeeBranches.map((branch) => branch.name).join(', ')
                          : 'No current branch'}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {employee.roles.length
                          ? employee.roles
                              .map(
                                (assignment) =>
                                  assignment.role.name ?? humanize(assignment.role.code),
                              )
                              .join(', ')
                          : 'No role assigned'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="block text-xs font-semibold text-slate-700">
                          {employee.user?.emailNormalized ?? 'No login account'}
                        </span>
                        {employee.user ? (
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {humanize(employee.user.status)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={employee.active} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <TableActionGroup>
                          <TableActionButton tone="view" onClick={() => void detail(employee)}>
                            View
                          </TableActionButton>
                          {canUpdate(employee) ? (
                            <TableActionButton
                              tone="edit"
                              onClick={() => {
                                setSelected(employee);
                                setPanel('edit');
                              }}
                            >
                              Edit
                            </TableActionButton>
                          ) : null}
                          {canManageRoles(employee) ? (
                            <TableActionButton
                              tone="manage"
                              onClick={() => {
                                setSelected(employee);
                                setPanel('role');
                              }}
                            >
                              Role
                            </TableActionButton>
                          ) : null}
                          {canUpdate(employee) ? (
                            <TableActionButton
                              tone={employee.active ? 'danger' : 'create'}
                              onClick={() => {
                                setSelected(employee);
                                setPanel('status');
                              }}
                            >
                              {employee.active ? 'Deactivate' : 'Activate'}
                            </TableActionButton>
                          ) : null}
                        </TableActionGroup>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Users className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-bold">No matching employees</h2>
            <p className="mt-1 text-sm text-slate-500">Change the search or status filter.</p>
          </div>
        )}
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
      </section>
      {panel === 'create' ? (
        <Panel
          title="Add employee"
          description="Create the staff record and optionally create their login account."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const email = value(form, 'email');
              const password = value(form, 'password');
              void onCreate({
                displayName: value(form, 'displayName'),
                jobTitle: value(form, 'jobTitle') || undefined,
                hireDate: value(form, 'hireDate') || undefined,
                accessMode: value(form, 'accessMode'),
                branchId: value(form, 'branchId'),
                ...(email ? { email, password } : {}),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <Field label="Full name">
              <input name="displayName" required className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title">
                <input name="jobTitle" className={inputClass} />
              </Field>
              <Field label="Hire date">
                <input name="hireDate" type="date" className={inputClass} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Access scope">
                <SearchableSelect name="accessMode" required className={inputClass}>
                  <option value="BRANCH">One branch</option>
                  <option value="MULTI_BRANCH">Multiple branches</option>
                  <option value="COMPANY_WIDE">Company wide</option>
                </SearchableSelect>
              </Field>
              <Field label="Primary branch">
                <SearchableSelect searchable name="branchId" required className={inputClass}>
                  <option value="">Choose a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </SearchableSelect>
              </Field>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-bold">Optional login account</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email">
                  <input name="email" type="email" className={inputClass} autoComplete="off" />
                </Field>
                <Field label="Initial password" hint="At least 12 characters">
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
            </div>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Create employee'}
            </button>
          </form>
        </Panel>
      ) : null}
      {panel === 'edit' && selected ? (
        <Panel
          title="Edit employee"
          description="Update staff details. Every change is recorded."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onUpdate(selected.id, {
                displayName: value(form, 'displayName'),
                jobTitle: value(form, 'jobTitle'),
                hireDate: value(form, 'hireDate') || undefined,
                accessMode: value(form, 'accessMode'),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <Field label="Employee number" hint="The permanent employee number cannot be changed.">
              <input value={selected.employeeNumber} disabled className={inputClass} />
            </Field>
            <Field label="Full name">
              <input
                name="displayName"
                defaultValue={selected.displayName}
                required
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title">
                <input
                  name="jobTitle"
                  defaultValue={selected.jobTitle ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Hire date">
                <input
                  name="hireDate"
                  type="date"
                  defaultValue={selected.hireDate?.slice(0, 10) ?? ''}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Access scope">
              <SearchableSelect
                name="accessMode"
                defaultValue={selected.accessMode}
                className={inputClass}
              >
                <option value="BRANCH">One branch</option>
                <option value="MULTI_BRANCH">Multiple branches</option>
                <option value="COMPANY_WIDE">Company wide</option>
              </SearchableSelect>
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </Panel>
      ) : null}
      {panel === 'status' && selected ? (
        <Panel
          title={selected.active ? 'Deactivate employee' : 'Activate employee'}
          description={
            selected.active
              ? 'Login access will be disabled and active sessions will end. History is preserved.'
              : 'Employment becomes active. Login access must be re-enabled separately if it was disabled.'
          }
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void onStatus(selected.id, {
                active: !selected.active,
                reason: value(new FormData(event.currentTarget), 'reason'),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.displayName}</strong>
              <p className="mt-1 text-xs text-slate-500">{selected.employeeNumber}</p>
            </div>
            <Field label="Reason">
              <textarea name="reason" required minLength={3} rows={4} className={inputClass} />
            </Field>
            <button
              disabled={busy}
              className={
                'w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 ' +
                (selected.active
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[#0D47A1] hover:bg-[#0D47A1]')
              }
            >
              {busy ? 'Updating…' : selected.active ? 'Deactivate employee' : 'Activate employee'}
            </button>
          </form>
        </Panel>
      ) : null}
      {panel === 'role' && selected ? (
        <Panel
          title="Assign business role"
          description="Choose what the employee can do and where the role applies."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const branchId = value(form, 'branchId');
              void onAssignRole(selected.id, {
                roleId: value(form, 'roleId'),
                ...(branchId ? { branchId } : {}),
                effectiveFrom: value(form, 'effectiveFrom'),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <Field label="Employee">
              <input value={selected.displayName} disabled className={inputClass} />
            </Field>
            <Field label="Business role">
              <SearchableSelect searchable name="roleId" required className={inputClass}>
                <option value="">Choose a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name ?? humanize(role.code)}
                  </option>
                ))}
              </SearchableSelect>
            </Field>
            <Field label="Applies to">
              <SearchableSelect searchable name="branchId" className={inputClass}>
                <option value="">Company level</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SearchableSelect>
            </Field>
            <Field label="Effective from">
              <input
                name="effectiveFrom"
                type="date"
                defaultValue={businessDate}
                required
                className={inputClass}
              />
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Assigning…' : 'Assign role'}
            </button>
          </form>
        </Panel>
      ) : null}
      {panel === 'details' && selected ? (
        <Panel
          title={selected.displayName}
          description={selected.employeeNumber + ' · ' + (selected.jobTitle || 'No job title')}
          onClose={close}
        >
          {loadingDetail ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Employment status</p>
                  <p className="mt-1 text-sm font-bold">{humanize(selected.accessMode)} access</p>
                </div>
                <StatusBadge value={selected.active} />
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Job title', selected.jobTitle || 'Not recorded'],
                  [
                    'Hire date',
                    selected.hireDate
                      ? new Date(selected.hireDate).toLocaleDateString()
                      : 'Not recorded',
                  ],
                  ['Login email', selected.user?.emailNormalized || 'No login account'],
                  [
                    'Account status',
                    selected.user?.status ? humanize(selected.user.status) : 'Not applicable',
                  ],
                ].map(([term, item]) => (
                  <div key={term} className="rounded-lg border border-slate-200 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {term}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">{item}</dd>
                  </div>
                ))}
              </dl>
              <section>
                <h3 className="mb-2 text-sm font-bold">Current branches</h3>
                <div className="space-y-2">
                  {currentBranches(selected, branches, businessDate).map((branch) => (
                    <div
                      key={branch.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                    >
                      {branch.name}
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-bold">Assigned roles</h3>
                <div className="space-y-2">
                  {selected.roles.length ? (
                    selected.roles.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                      >
                        {assignment.role.name ?? humanize(assignment.role.code)}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No roles assigned.</p>
                  )}
                </div>
              </section>
              {canUpdate(selected) ? (
                <div className="flex gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setPanel('edit')}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0D47A1] px-3 py-2 text-xs font-bold text-white"
                  >
                    <Edit3 className="h-4 w-4" /> Edit employee
                  </button>
                  {canManageRoles(selected) ? (
                    <button
                      type="button"
                      onClick={() => setPanel('role')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                    >
                      <BriefcaseBusiness className="h-4 w-4" /> Assign role
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
