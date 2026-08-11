'use client';

import {
  Clock3,
  Eye,
  KeyRound,
  MoreHorizontal,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { AccessScopeBadge, StatusBadge } from '@/components/shared/ui';

export type UserAccountRecord = {
  id: string;
  emailNormalized: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    employeeNumber: string;
    accessMode: string;
    party?: { displayName?: string };
    branchAssignments: { branchId: string }[];
  };
  sessions: {
    id: string;
    createdAt: string;
    expiresAt: string;
    revokedAt?: string | null;
    revocationReason?: string | null;
  }[];
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
const format = (input: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(input),
  );

function Drawer({
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
      className="fixed inset-0 z-[80] flex justify-end bg-slate-950/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </aside>
    </div>
  );
}

export function UserAccountDirectory({
  records,
  busy,
  canChangeStatus,
  canRevokeSession,
  onStatus,
  onRevoke,
}: {
  records: UserAccountRecord[];
  busy: boolean;
  canChangeStatus: (record: UserAccountRecord) => boolean;
  canRevokeSession: (record: UserAccountRecord) => boolean;
  onStatus: (userId: string, input: Record<string, unknown>) => Promise<void>;
  onRevoke: (sessionId: string, reason: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<UserAccountRecord | null>(null);
  const [mode, setMode] = useState<'view' | 'status' | 'revoke' | null>(null);
  const [selectedSession, setSelectedSession] = useState<
    UserAccountRecord['sessions'][number] | null
  >(null);
  const filtered = useMemo(
    () =>
      records.filter((account) => {
        const search = query.trim().toLowerCase();
        return (
          (!search ||
            [
              account.emailNormalized,
              account.employee.party?.displayName,
              account.employee.employeeNumber,
            ]
              .join(' ')
              .toLowerCase()
              .includes(search)) &&
          (status === 'all' || account.status === status)
        );
      }),
    [records, query, status],
  );
  const pagination = usePagination(filtered);
  useEffect(() => pagination.setPage(1), [query, status]);
  const open = (account: UserAccountRecord, next: 'view' | 'status') => {
    setSelected(account);
    setMode(next);
  };
  const close = () => {
    setSelected(null);
    setSelectedSession(null);
    setMode(null);
  };
  const activeSessions = (account: UserAccountRecord) =>
    account.sessions.filter(
      (session) => !session.revokedAt && new Date(session.expiresAt) > new Date(),
    );
  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Team & access
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">User accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review login access in one place. Open an account to manage status and individual
          sessions.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500">All accounts</span>
          <strong className="mt-1 block text-2xl">{records.length}</strong>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="text-xs font-semibold text-emerald-700">Active accounts</span>
          <strong className="mt-1 block text-2xl text-emerald-800">
            {records.filter((item) => item.status === 'ACTIVE').length}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500">Open sessions</span>
          <strong className="mt-1 block text-2xl">
            {records.reduce((total, item) => total + activeSessions(item).length, 0)}
          </strong>
        </div>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_200px]">
          <label className="relative">
            <span className="sr-only">Search user accounts</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee, number or email…"
              className={inputClass + ' pl-9'}
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
            aria-label="Filter account status"
          >
            <option value="all">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {[
                  'Employee',
                  'Login email',
                  'Access scope',
                  'Open sessions',
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
              {pagination.pageItems.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => open(account, 'view')}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span>
                        <strong className="block text-sm">
                          {account.employee.party?.displayName || 'Staff member'}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {account.employee.employeeNumber}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                    {account.emailNormalized}
                  </td>
                  <td className="px-5 py-4">
                    <AccessScopeBadge mode={account.employee.accessMode} />
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {activeSessions(account).length}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge value={account.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <details className="relative inline-block">
                      <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400">
                        <MoreHorizontal className="h-5 w-5" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                        <button
                          type="button"
                          onClick={() => open(account, 'view')}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" /> View account
                        </button>
                        {canChangeStatus(account) ? (
                          <button
                            type="button"
                            onClick={() => open(account, 'status')}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <ShieldAlert className="h-4 w-4" /> Change status
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No matching user accounts.</div>
        ) : null}
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
      </section>
      {mode === 'view' && selected ? (
        <Drawer
          title={selected.employee.party?.displayName || selected.employee.employeeNumber}
          description="Login identity, access scope, and session history."
          onClose={close}
        >
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Login email
                </span>
                <strong className="mt-1 block break-all text-sm">{selected.emailNormalized}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account status
                </span>
                <div className="mt-1">
                  <StatusBadge value={selected.status} />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Employee
                </span>
                <strong className="mt-1 block text-sm">{selected.employee.employeeNumber}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Access scope
                </span>
                <div className="mt-1">
                  <AccessScopeBadge mode={selected.employee.accessMode} />
                </div>
              </div>
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold">Sessions</h3>
                <span className="text-xs font-semibold text-slate-500">
                  {activeSessions(selected).length} open
                </span>
              </div>
              <div className="space-y-2">
                {selected.sessions.length ? (
                  selected.sessions.slice(0, 10).map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            value={
                              session.revokedAt
                                ? 'REVOKED'
                                : new Date(session.expiresAt) > new Date()
                                  ? 'ACTIVE'
                                  : 'EXPIRED'
                            }
                          />
                          <span className="text-xs font-semibold text-slate-600">
                            Started {format(session.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Expires {format(session.expiresAt)}
                          {session.revocationReason ? ' · ' + session.revocationReason : ''}
                        </p>
                      </div>
                      {canRevokeSession(selected) &&
                      !session.revokedAt &&
                      new Date(session.expiresAt) > new Date() ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSelectedSession(session);
                            setMode('revoke');
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          <KeyRound className="h-4 w-4" /> Revoke
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    No sessions recorded.
                  </p>
                )}
              </div>
              {selected.sessions.length > 10 ? (
                <p className="mt-3 text-xs text-slate-500">Showing the 10 most recent sessions.</p>
              ) : null}
            </section>
          </div>
        </Drawer>
      ) : null}
      {mode === 'revoke' && selected && selectedSession ? (
        <Drawer
          title="Revoke session"
          description="End this single login session while leaving the account available."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void onRevoke(selectedSession.id, value(new FormData(event.currentTarget), 'reason'))
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.emailNormalized}</strong>
              <p className="mt-1 text-xs text-slate-500">
                Session started {format(selectedSession.createdAt)}
              </p>
            </div>
            <label className="space-y-1.5 text-sm font-semibold">
              Revocation reason
              <textarea name="reason" required minLength={3} rows={4} className={inputClass} />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Revoking…' : 'Revoke this session'}
            </button>
          </form>
        </Drawer>
      ) : null}
      {mode === 'status' && selected ? (
        <Drawer
          title="Change account status"
          description="Suspending or disabling an account ends its active sessions."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onStatus(selected.id, {
                status: value(form, 'status'),
                reason: value(form, 'reason'),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.emailNormalized}</strong>
              <p className="mt-1 text-xs text-slate-500">
                Current status: {humanize(selected.status)}
              </p>
            </div>
            <label className="space-y-1.5 text-sm font-semibold">
              New status
              <select name="status" defaultValue={selected.status} className={inputClass}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Reason
              <input name="reason" required minLength={3} className={inputClass} />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy ? 'Updating…' : 'Save account status'}
            </button>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
