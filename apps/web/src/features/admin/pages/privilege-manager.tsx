'use client';

import { useMemo, useState } from 'react';
import { Save, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { EmptyState, LoadingState, PageHeader } from '@/components/shared/ui';
import { api, userFacingError } from '@/lib/phase3-api';
import { permissionDomain, permissionLabel } from '@/lib/presentation';

type UserRow = {
  id: string;
  emailNormalized: string;
  employee?: { employeeNumber?: string; party?: { displayName?: string } };
};
type Privilege = {
  id: string;
  code: string;
  description: string;
  inherited: boolean;
  override: boolean | null;
  enabled: boolean;
};
type PrivilegeResponse = {
  user: { id: string; email: string; displayName: string; employeeNumber: string | null };
  permissions: Privilege[];
};

export function PrivilegeManager({ users, canManage }: { users: UserRow[]; canManage: boolean }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [details, setDetails] = useState<PrivilegeResponse | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(userId: string) {
    setSelectedUserId(userId);
    setDetails(null);
    setError('');
    if (!userId) return;
    setLoading(true);
    try {
      const response = await api<PrivilegeResponse>('/users/' + userId + '/privileges');
      setDetails(response);
      setEnabled(
        new Set(response.permissions.filter((item) => item.enabled).map((item) => item.id)),
      );
    } catch (cause) {
      setError(userFacingError(cause, 'Unable to load user privileges.'));
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = (details?.permissions ?? []).filter((item) =>
      (item.code + ' ' + item.description + ' ' + permissionLabel(item.code))
        .toLowerCase()
        .includes(normalized),
    );
    return filtered.reduce<Record<string, Privilege[]>>((result, item) => {
      const domain = permissionDomain(item.code);
      (result[domain] ??= []).push(item);
      return result;
    }, {});
  }, [details, query]);

  async function save() {
    if (!details || reason.trim().length < 3) {
      setError('Enter a reason of at least 3 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<PrivilegeResponse>('/users/' + details.user.id + '/privileges', {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: [...enabled], reason: reason.trim() }),
      });
      setDetails(response);
      setEnabled(
        new Set(response.permissions.filter((item) => item.enabled).map((item) => item.id)),
      );
      setReason('');
      toast.success('User privileges updated.');
    } catch (cause) {
      setError(userFacingError(cause, 'Unable to update user privileges.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Team & access"
        title="Privileges"
        description="Choose the exact create, view, update, delete, and operational capabilities available to each user."
      />
      <div className="form-section rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          User account
          <SearchableSelect
            aria-label="User account"
            value={selectedUserId}
            onChange={(event) => void load(event.target.value)}
          >
            <option value="">Select a user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.employee?.party?.displayName ?? user.emailNormalized} — {user.emailNormalized}
              </option>
            ))}
          </SearchableSelect>
        </label>
      </div>
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <LoadingState label="Loading user privileges" />
      ) : !details ? (
        <EmptyState
          title="Select a user"
          description="Search for a user account above to review and manage its effective privileges."
        />
      ) : (
        <div className="form-section space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{details.user.displayName}</h2>
            <p className="text-sm text-slate-500">{details.user.email}</p>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search privileges..."
              className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3"
              aria-label="Search privileges"
            />
          </label>
          <div className="max-h-[55vh] space-y-5 overflow-y-auto scroll-smooth pr-1">
            {Object.entries(groups).map(([domain, permissions]) => (
              <fieldset key={domain} className="space-y-2">
                <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {domain}
                </legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {permissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-emerald-600"
                        checked={enabled.has(permission.id)}
                        disabled={!canManage || busy}
                        onChange={(event) => {
                          const next = new Set(enabled);
                          if (event.target.checked) next.add(permission.id);
                          else next.delete(permission.id);
                          setEnabled(next);
                        }}
                      />
                      <span>
                        <strong className="block text-sm text-slate-800">
                          {permissionLabel(permission.code)}
                        </strong>
                        <small className="text-slate-500">
                          {permission.description}
                          {permission.inherited ? ' · inherited from role' : ''}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {canManage ? (
            <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_auto]">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for this privilege change"
                className="min-h-11 rounded-lg border border-slate-300 px-3"
              />
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => void save()}
              >
                <Save className="h-4 w-4" /> {busy ? 'Saving...' : 'Save privileges'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
