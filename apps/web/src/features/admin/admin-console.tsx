'use client';

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Building2,
  GitBranch,
  MapPinned,
  Plus,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/shared/app-shell';
import {
  EmptyState,
  ErrorState,
  Feedback,
  FormSection,
  LoadingState,
  PageHeader,
  StatusBadge,
  WorkspaceLoading,
} from '@/components/shared/ui';
import { formatDate, humanize, permissionDomain, permissionLabel } from '@/lib/presentation';
import { EmployeeDirectory, type EmployeeRecord } from './pages/employee-directory';
import { BranchDirectory, type BranchRecord } from './pages/branch-directory';
import { SettingsPanel, type CompanySettings } from './pages/settings-panel';
import { RoleManager, type PermissionRecord, type RoleRecord } from './pages/role-manager';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { UserAccountDirectory, type UserAccountRecord } from './pages/user-account-directory';
import type { Principal } from '@/lib/phase3-api';
import {
  api,
  apiCached,
  ApiError,
  clearApiCache,
  canPerformAcrossBranches,
  canPerformInBranch,
  hasCompanyPermission,
  hasPermission,
  userFacingError,
} from '@/lib/phase3-api';

type Row = Record<string, unknown>;
type Catalog = {
  id: string;
  code?: string;
  name?: string;
  displayName?: string;
  employeeNumber?: string;
};
type SectionKey =
  | 'profile'
  | 'company'
  | 'branches'
  | 'employees'
  | 'roles'
  | 'permissions'
  | 'users'
  | 'audit'
  | 'settings';
type Section = {
  key: SectionKey;
  label: string;
  description: string;
  permission?: string;
  path?: string;
};
type DashboardSnapshot = {
  branches: Row[];
  employees: Row[];
  owners: Row[];
  properties: Row[];
  spaces: Row[];
  activity: Row[];
};
const emptyDashboard: DashboardSnapshot = {
  branches: [],
  employees: [],
  owners: [],
  properties: [],
  spaces: [],
  activity: [],
};

const sections: Section[] = [
  {
    key: 'profile',
    label: 'My workspace',
    description: 'Your account, access scope, and authorized capabilities.',
  },
  {
    key: 'company',
    label: 'Company',
    description: 'Core company identity and operating preferences.',
    permission: 'organization.company.read',
    path: '/company',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Company identity, regional preferences, and security guidance.',
    permission: 'organization.company.read',
    path: '/company',
  },
  {
    key: 'branches',
    label: 'Branches',
    description: 'Operating locations available within your authorized scope.',
    permission: 'organization.branch.read',
    path: '/branches',
  },
  {
    key: 'employees',
    label: 'Employees',
    description: 'Staff records, assigned roles, branches, and user-account status.',
    permission: 'identity.employee.read',
    path: '/employees',
  },
  {
    key: 'roles',
    label: 'Roles & permissions',
    description:
      'Create understandable business roles and control the capabilities assigned to each role.',
    permission: 'identity.role.read',
    path: '/roles',
  },
  {
    key: 'permissions',
    label: 'Permissions',
    description: 'Readable capability catalog grouped by business domain.',
    permission: 'identity.permission.read',
    path: '/permissions',
  },
  {
    key: 'users',
    label: 'Users & sessions',
    description: 'Login accounts, access state, and revocable sessions.',
    permission: 'identity.user.read',
    path: '/users',
  },
  {
    key: 'audit',
    label: 'Audit trail',
    description: 'Sensitive and administrative activity in your authorized scope.',
    permission: 'governance.audit.read',
    path: '/audit',
  },
];

const stringValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};
const asRows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object')
    : value && typeof value === 'object'
      ? [value as Row]
      : [];
const text = (value: unknown, fallback = 'Not recorded') =>
  typeof value === 'string' && value.trim() ? value : fallback;
const object = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const array = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object')
    : [];

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <article className="metric-card">
      <span className="metric-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <tr key={index}>
              {cells.map((cell, cellIndex) => (
                <td data-label={headers[cellIndex]} key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminConsole() {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [active, setActive] = useState<SectionKey>('profile');
  const [data, setData] = useState<unknown>(null);
  const [catalogs, setCatalogs] = useState<{
    branches: Catalog[];
    roles: Catalog[];
    permissions: Catalog[];
    employees: Catalog[];
    users: Row[];
  }>({ branches: [], roles: [], permissions: [], employees: [], users: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(emptyDashboard);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(
    async (section: Section, current: Principal) => {
      setLoading(true);
      setError('');
      try {
        const result =
          section.key === 'profile' ? current : await apiCached<unknown>(section.path ?? '');
        setData(result);
        if (section.key !== 'profile')
          setCatalogs((existing) => ({
            ...existing,
            ...(section.key === 'branches' ? { branches: result as Catalog[] } : {}),
            ...(section.key === 'employees' ? { employees: result as Catalog[] } : {}),
            ...(section.key === 'roles' ? { roles: result as Catalog[] } : {}),
            ...(section.key === 'permissions' ? { permissions: result as Catalog[] } : {}),
            ...(section.key === 'users' ? { users: result as Row[] } : {}),
          }));
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        setError(userFacingError(cause, 'Unable to load this section.'));
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const loadCatalogs = useCallback(async (section: SectionKey, current: Principal) => {
    const needsBranches = section === 'employees';
    const needsRoles = section === 'employees' || section === 'permissions';
    const needsPermissions = section === 'roles' || section === 'permissions';
    const requests = await Promise.all([
      needsBranches && hasPermission(current, 'organization.branch.read')
        ? apiCached<Catalog[]>('/branches')
        : null,
      needsRoles && hasPermission(current, 'identity.role.read')
        ? apiCached<Catalog[]>('/roles')
        : null,
      needsPermissions && hasPermission(current, 'identity.permission.read')
        ? apiCached<Catalog[]>('/permissions')
        : null,
    ]);
    setCatalogs((existing) => ({
      ...existing,
      ...(requests[0] ? { branches: requests[0] } : {}),
      ...(requests[1] ? { roles: requests[1] } : {}),
      ...(requests[2] ? { permissions: requests[2] } : {}),
    }));
  }, []);

  const loadDashboardData = useCallback(async (current: Principal) => {
    setDashboardLoading(true);
    const request = async (permission: string, path: string) =>
      hasPermission(current, permission) ? apiCached<Row[]>(path).catch(() => []) : [];
    const [branches, employees, owners, properties, spaces, activity] = await Promise.all([
      request('organization.branch.read', '/branches'),
      request('identity.employee.read', '/employees'),
      request('owner.read', '/owners'),
      request('portfolio.property.read', '/properties'),
      request('portfolio.space.read', '/rentable-spaces'),
      request('governance.audit.read', '/audit'),
    ]);
    setDashboard({ branches, employees, owners, properties, spaces, activity });
    setDashboardLoading(false);
  }, []);

  useEffect(() => {
    apiCached<Principal>('/auth/me')
      .then(async (current) => {
        setPrincipal(current);
        const requestedKey = new URLSearchParams(window.location.search).get('section');
        const requested = sections.find(
          (section) =>
            section.key === requestedKey &&
            (!section.permission || hasPermission(current, section.permission)),
        );
        if (requested) {
          setActive(requested.key);
          await Promise.all([load(requested, current), loadCatalogs(requested.key, current)]);
        } else {
          setData(current);
          setLoading(false);
        }
        if (!requested || requested.key === 'profile') await loadDashboardData(current);
        else setDashboardLoading(false);
      })
      .catch(() => {
        clearApiCache();
        router.replace('/login');
      })
      .finally(() => setDashboardLoading(false));
  }, [load, loadCatalogs, loadDashboardData, router]);

  const visible = useMemo(
    () =>
      principal
        ? sections.filter(
            (section) => !section.permission || hasPermission(principal, section.permission),
          )
        : [],
    [principal],
  );
  const selected = visible.find((section) => section.key === active) ?? visible[0] ?? sections[0]!;
  const rawRecords = asRows(data);
  const records = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rawRecords.filter((row) => {
      const matchesQuery =
        !normalizedQuery || JSON.stringify(row).toLowerCase().includes(normalizedQuery);
      if (!matchesQuery || statusFilter === 'all') return matchesQuery;
      const rowStatus =
        typeof row.active === 'boolean'
          ? row.active
            ? 'active'
            : 'inactive'
          : text(row.status, '').toLowerCase();
      return rowStatus === statusFilter;
    });
  }, [data, query, statusFilter]);
  const listPagination = usePagination(records);

  async function choose(section: Section) {
    if (!principal || section.key === active) return;
    setActive(section.key);
    setSuccess('');
    setQuery('');
    setStatusFilter('all');
    setShowForm(false);
    await Promise.all([
      load(section, principal),
      loadCatalogs(section.key, principal),
      section.key === 'profile' ? loadDashboardData(principal) : Promise.resolve(),
    ]);
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clearApiCache();
      router.replace('/login');
    }
  }
  async function mutate(
    event: FormEvent<HTMLFormElement>,
    path: string,
    method: string,
    body: Row,
    message: string,
  ) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      clearApiCache();
      event.currentTarget.reset();
      setSuccess(message);
      setShowForm(false);
      toast.success(message);
      if (principal) {
        await Promise.all([load(selected, principal), loadCatalogs(selected.key, principal)]);
      }
    } catch (cause) {
      const message = userFacingError(cause, 'The change could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function mutateAction(path: string, method: string, body: Row, message: string) {
    if (busy || !principal) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      clearApiCache();
      setSuccess(message);
      toast.success(message);
      await Promise.all([load(selected, principal), loadCatalogs(selected.key, principal)]);
    } catch (cause) {
      const messageText = userFacingError(cause, 'The change could not be saved.');
      setError(messageText);
      toast.error(messageText);
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  function renderForm() {
    if (!principal) return null;
    if (active === 'company' && hasPermission(principal, 'organization.company.update'))
      return (
        <FormSection
          title="Update company"
          description="Keep the business name and reporting timezone current."
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                '/company',
                'PATCH',
                {
                  displayName: stringValue(form, 'displayName'),
                  timezone: stringValue(form, 'timezone'),
                },
                'Company details updated.',
              );
            }}
          >
            <label>
              Company display name
              <input name="displayName" required />
            </label>
            <label>
              Reporting timezone
              <input name="timezone" defaultValue="Africa/Nairobi" required />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? 'Saving...' : 'Save company'}
            </button>
          </form>
        </FormSection>
      );
    if (active === 'branches' && hasPermission(principal, 'organization.branch.create'))
      return (
        <FormSection
          title="Add branch"
          description="Create a new operating location for the company."
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                '/branches',
                'POST',
                { name: stringValue(form, 'name') },
                'Branch created.',
              );
            }}
          >
            <label>
              Branch name
              <input name="name" required maxLength={120} />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? 'Creating...' : 'Create branch'}
            </button>
          </form>
        </FormSection>
      );
    if (active === 'employees' && hasPermission(principal, 'identity.employee.create'))
      return (
        <div className="stack">
          <FormSection
            title="Create employee"
            description="Optionally create a login account at the same time."
          >
            <form
              className="form-grid"
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                void mutate(
                  event,
                  '/employees',
                  'POST',
                  {
                    displayName: stringValue(form, 'displayName'),
                    accessMode: stringValue(form, 'accessMode'),
                    branchId: stringValue(form, 'branchId'),
                    email: stringValue(form, 'email') || undefined,
                    password: stringValue(form, 'password') || undefined,
                  },
                  'Employee created.',
                );
              }}
            >
              <label>
                Full name
                <input name="displayName" required />
              </label>
              <label>
                Access scope
                <select name="accessMode" required>
                  <option value="BRANCH">Branch Restricted</option>
                  <option value="MULTI_BRANCH">Multiple Branches</option>
                  <option value="COMPANY_WIDE">Company Wide</option>
                </select>
              </label>
              <label>
                Primary branch
                <select name="branchId" required>
                  <option value="">Choose a branch</option>
                  {catalogs.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Login email (optional)
                <input name="email" type="email" autoComplete="off" />
              </label>
              <label>
                Initial password (optional)
                <input name="password" type="password" minLength={12} autoComplete="new-password" />
              </label>
              <button className="button primary full" disabled={busy}>
                {busy ? 'Creating...' : 'Create employee'}
              </button>
            </form>
          </FormSection>
          {hasPermission(principal, 'identity.role.manage') ? (
            <FormSection
              title="Assign role"
              description="Choose an employee and business role; no internal identifiers are required."
            >
              <form
                className="form-grid"
                onSubmit={(event) => {
                  const form = new FormData(event.currentTarget);
                  const employeeId = stringValue(form, 'employeeId');
                  void mutate(
                    event,
                    `/employees/${employeeId}/roles`,
                    'POST',
                    {
                      roleId: stringValue(form, 'roleId'),
                      branchId: stringValue(form, 'branchId') || undefined,
                      effectiveFrom: new Date().toISOString().slice(0, 10),
                    },
                    'Role assigned.',
                  );
                }}
              >
                <label>
                  Employee
                  <select name="employeeId" required>
                    <option value="">Choose an employee</option>
                    {catalogs.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employeeNumber} - {employee.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select name="roleId" required>
                    <option value="">Choose a role</option>
                    {catalogs.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name ?? humanize(role.code)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Role scope
                  <select name="branchId">
                    <option value="">Company level</option>
                    {catalogs.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button primary full" disabled={busy}>
                  {busy ? 'Assigning...' : 'Assign role'}
                </button>
              </form>
            </FormSection>
          ) : null}
        </div>
      );
    if (active === 'roles' && hasPermission(principal, 'identity.role.manage'))
      return (
        <FormSection
          title="Create role"
          description="Use a clear business name; grant capabilities from the Permissions view."
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                '/roles',
                'POST',
                {
                  code: stringValue(form, 'code'),
                  name: stringValue(form, 'name'),
                  description: stringValue(form, 'description') || undefined,
                },
                'Role created.',
              );
            }}
          >
            <label>
              Role code
              <input name="code" required />
            </label>
            <label>
              Role name
              <input name="name" required />
            </label>
            <label className="full">
              Description
              <input name="description" />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? 'Creating...' : 'Create role'}
            </button>
          </form>
        </FormSection>
      );
    if (active === 'permissions' && hasPermission(principal, 'identity.role.manage'))
      return (
        <FormSection
          title="Grant capability"
          description="Capabilities are presented in readable business language."
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              const roleId = stringValue(form, 'roleId');
              void mutate(
                event,
                `/roles/${roleId}/permissions`,
                'POST',
                { permissionId: stringValue(form, 'permissionId') },
                'Capability granted.',
              );
            }}
          >
            <label>
              Role
              <select name="roleId" required>
                <option value="">Choose a role</option>
                {catalogs.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name ?? humanize(role.code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Capability
              <select name="permissionId" required>
                <option value="">Choose a capability</option>
                {catalogs.permissions.map((permission) => (
                  <option key={permission.id} value={permission.id}>
                    {permissionDomain(permission.code ?? '')} -{' '}
                    {permissionLabel(permission.code ?? '')}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? 'Granting...' : 'Grant capability'}
            </button>
          </form>
        </FormSection>
      );
    if (active === 'users' && hasPermission(principal, 'identity.user.suspend'))
      return (
        <div className="stack">
          <FormSection
            title="Change account status"
            description="Changing status may end the user's active sessions."
          >
            <form
              className="form-grid"
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                const userId = stringValue(form, 'userId');
                void mutate(
                  event,
                  `/users/${userId}/status`,
                  'PATCH',
                  { status: stringValue(form, 'status'), reason: stringValue(form, 'reason') },
                  'Account status updated.',
                );
              }}
            >
              <label>
                User account
                <select name="userId" required>
                  <option value="">Choose a user</option>
                  {catalogs.users.map((user) => (
                    <option key={text(user.id)} value={text(user.id)}>
                      {text(user.emailNormalized)} - {text(object(user.employee).employeeNumber)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" required>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </label>
              <label className="full">
                Reason
                <input name="reason" required minLength={3} />
              </label>
              <button className="button danger full" disabled={busy}>
                {busy ? 'Updating...' : 'Update account status'}
              </button>
            </form>
          </FormSection>
          {hasPermission(principal, 'identity.session.revoke') ? (
            <FormSection
              title="Revoke session"
              description="Select a recognizable account session; internal session IDs remain hidden."
            >
              <form
                className="form-grid"
                onSubmit={(event) => {
                  const form = new FormData(event.currentTarget);
                  const sessionId = stringValue(form, 'sessionId');
                  void mutate(
                    event,
                    `/auth/sessions/${sessionId}/revoke`,
                    'POST',
                    { reason: stringValue(form, 'reason') },
                    'Session revoked.',
                  );
                }}
              >
                <label className="full">
                  Active session
                  <select name="sessionId" required>
                    <option value="">Choose a session</option>
                    {catalogs.users.flatMap((user) =>
                      array(user.sessions)
                        .filter((session) => !session.revokedAt)
                        .map((session) => (
                          <option key={text(session.id)} value={text(session.id)}>
                            {text(user.emailNormalized)} - started{' '}
                            {formatDate(session.createdAt, true)}
                          </option>
                        )),
                    )}
                  </select>
                </label>
                <label className="full">
                  Revocation reason
                  <input name="reason" required minLength={3} />
                </label>
                <button className="button danger full" disabled={busy}>
                  {busy ? 'Revoking...' : 'Revoke session'}
                </button>
              </form>
            </FormSection>
          ) : null}
        </div>
      );
    return null;
  }

  function renderRecords() {
    if (!records.length)
      return (
        <EmptyState
          title={`No ${selected.label.toLowerCase()} found`}
          description="There are no records in your authorized scope yet."
        />
      );
    if (active === 'profile') {
      const propertyGroups = Object.entries(
        Object.groupBy(dashboard.properties, (property) => humanize(text(property.propertyType))),
      ).sort(([, left], [, right]) => (right?.length ?? 0) - (left?.length ?? 0));
      const totalProperties = dashboard.properties.length;
      return (
        <div className="dashboard-stack">
          <div className="metric-grid" aria-label="Current workspace totals">
            <MetricCard
              label="Branches"
              value={dashboardLoading ? '...' : dashboard.branches.length}
              icon={<GitBranch />}
            />
            <MetricCard
              label="Employees"
              value={dashboardLoading ? '...' : dashboard.employees.length}
              icon={<UsersRound />}
            />
            <MetricCard
              label="Owners"
              value={dashboardLoading ? '...' : dashboard.owners.length}
              icon={<UsersRound />}
            />
            <MetricCard
              label="Properties"
              value={dashboardLoading ? '...' : dashboard.properties.length}
              icon={<Building2 />}
            />
            <MetricCard
              label="Rentable spaces"
              value={dashboardLoading ? '...' : dashboard.spaces.length}
              icon={<MapPinned />}
            />
          </div>
          {dashboardLoading ? (
            <LoadingState label="Preparing your portfolio overview" compact />
          ) : (
            <div className="dashboard-grid">
              <section className="card dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Portfolio</p>
                    <h2>Recent properties</h2>
                  </div>
                  <StatusBadge value={String(dashboard.properties.length) + ' records'} />
                </div>
                {dashboard.properties.length ? (
                  <div className="recent-list">
                    {dashboard.properties.slice(0, 5).map((property) => (
                      <article className="recent-row" key={text(property.id)}>
                        <span className="record-icon">
                          <Building2 />
                        </span>
                        <div>
                          <strong>{text(property.name)}</strong>
                          <small>
                            {text(property.propertyCode)} ...{' '}
                            {humanize(text(property.propertyType))} ... {text(property.city)}
                          </small>
                        </div>
                        <StatusBadge value={text(property.status)} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No properties yet"
                    description="Properties in your authorized scope will appear here."
                  />
                )}
              </section>
              <section className="card dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Current mix</p>
                    <h2>Property types</h2>
                  </div>
                </div>
                {propertyGroups.length ? (
                  <div className="distribution-list">
                    {propertyGroups.map(([label, items]) => {
                      const count = items?.length ?? 0;
                      const percentage = totalProperties
                        ? Math.round((count / totalProperties) * 100)
                        : 0;
                      return (
                        <div className="distribution-row" key={label}>
                          <div>
                            <span>{label}</span>
                            <strong>{count}</strong>
                          </div>
                          <span className="distribution-track">
                            <span style={{ width: String(percentage) + '%' }} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No distribution yet"
                    description="Property types will be summarized after records are added."
                  />
                )}
              </section>
              <section className="card dashboard-panel dashboard-activity">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Governance</p>
                    <h2>Recent activity</h2>
                  </div>
                  <Activity aria-hidden="true" />
                </div>
                {dashboard.activity.length ? (
                  <div className="activity-list">
                    {dashboard.activity.slice(0, 5).map((item, index) => (
                      <article className="activity-row" key={text(item.id, String(index))}>
                        <span className="activity-dot" />
                        <div>
                          <strong>{humanize(text(item.action))}</strong>
                          <small>
                            {humanize(text(item.entityType))} ...{' '}
                            {formatDate(item.occurredAt, true)}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No recent activity"
                    description="Authorized audit activity will appear here when available."
                  />
                )}
              </section>
            </div>
          )}
        </div>
      );
    }
    if (active === 'company') {
      const company = records[0]!;
      return (
        <div className="card">
          <div className="summary-grid">
            <div className="summary-item">
              <small>Company</small>
              <strong>{text(company.displayName, text(company.legalName, 'Company'))}</strong>
            </div>
            <div className="summary-item">
              <small>Timezone</small>
              <strong>{text(company.timezone)}</strong>
            </div>
            <div className="summary-item">
              <small>Status</small>
              <StatusBadge value={company.active as boolean} />
            </div>
          </div>
        </div>
      );
    }
    if (active === 'branches')
      return (
        <DataTable
          headers={['Branch', 'Contact', 'Status']}
          rows={listPagination.pageItems.map((row) => [
            [
              <div className="primary-cell" key="p">
                <strong>{text(row.name)}</strong>
                <small>{text(row.code)}</small>
              </div>,
            ],
            [text(row.email, text(row.phone, 'No contact recorded'))],
            [<StatusBadge key="s" value={row.active as boolean} />],
          ])}
        />
      );
    if (active === 'employees')
      return (
        <DataTable
          headers={['Employee', 'User account', 'Access', 'Roles', 'Status']}
          rows={listPagination.pageItems.map((row) => {
            const user = object(row.user);
            const roles = array(row.roles);
            return [
              [
                <div className="primary-cell" key="p">
                  <strong>{text(row.displayName)}</strong>
                  <small>{text(row.employeeNumber)}</small>
                </div>,
              ],
              [text(user.emailNormalized, 'No login account')],
              [humanize(text(row.accessMode))],
              [
                roles.length
                  ? roles
                      .map((assignment) =>
                        text(
                          object(assignment.role).name,
                          humanize(text(object(assignment.role).code)),
                        ),
                      )
                      .join(', ')
                  : 'No roles assigned',
              ],
              [
                <StatusBadge
                  key="s"
                  value={user.status ? text(user.status) : (row.active as boolean)}
                />,
              ],
            ];
          })}
        />
      );
    if (active === 'roles')
      return (
        <DataTable
          headers={['Role', 'Capabilities', 'Status']}
          rows={listPagination.pageItems.map((row) => {
            const permissions = array(row.permissions);
            return [
              [
                <div className="primary-cell" key="p">
                  <strong>{text(row.name, humanize(text(row.code)))}</strong>
                  <small>{text(row.description, 'Business access role')}</small>
                </div>,
              ],
              [
                <details key="d">
                  <summary>{permissions.length} Permissions</summary>
                  <div className="permission-groups">
                    {Object.entries(
                      Object.groupBy(permissions, (assignment) =>
                        permissionDomain(text(object(assignment.permission).code)),
                      ),
                    ).map(([domain, items]) => (
                      <div className="permission-group" key={domain}>
                        <h3>{domain}</h3>
                        <div className="permission-list">
                          {items?.map((assignment, index) => (
                            <span className="permission-chip" key={index}>
                              {permissionLabel(text(object(assignment.permission).code))}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>,
              ],
              [<StatusBadge key="s" value={row.active as boolean} />],
            ];
          })}
        />
      );
    if (active === 'permissions') {
      const groups = Object.groupBy(listPagination.pageItems, (row) =>
        permissionDomain(text(row.code)),
      );
      return (
        <div className="permission-groups">
          {Object.entries(groups).map(([domain, items]) => (
            <section className="card" key={domain}>
              <h2>{domain}</h2>
              <div className="permission-list">
                {items?.map((permission) => (
                  <span className="permission-chip" key={text(permission.id)}>
                    {permissionLabel(text(permission.code))}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      );
    }
    if (active === 'users')
      return (
        <DataTable
          headers={['User account', 'Employee', 'Access scope', 'Status', 'Sessions']}
          rows={listPagination.pageItems.map((row) => {
            const employee = object(row.employee);
            const sessions = array(row.sessions);
            return [
              [
                <div className="primary-cell" key="p">
                  <strong>{text(row.emailNormalized)}</strong>
                  <small>Created {formatDate(row.createdAt)}</small>
                </div>,
              ],
              [text(employee.employeeNumber)],
              [humanize(text(employee.accessMode))],
              [<StatusBadge key="s" value={text(row.status)} />],
              [
                <details key="d">
                  <summary>
                    {sessions.filter((session) => !session.revokedAt).length} active
                  </summary>
                  {sessions.map((session, index) => (
                    <p className="meta" key={index}>
                      {session.revokedAt ? 'Revoked' : 'Active'} · Started{' '}
                      {formatDate(session.createdAt, true)} · Expires{' '}
                      {formatDate(session.expiresAt, true)}
                    </p>
                  ))}
                </details>,
              ],
            ];
          })}
        />
      );
    return (
      <DataTable
        headers={['Activity', 'Record type', 'Time', 'Context']}
        rows={listPagination.pageItems.map((row) => [
          [
            <div className="primary-cell" key="p">
              <strong>{humanize(text(row.action))}</strong>
              <small>{text(row.actorLabel, 'Staff action')}</small>
            </div>,
          ],
          [humanize(text(row.entityType))],
          [formatDate(row.occurredAt, true)],
          [text(row.reason, 'No additional note')],
        ])}
      />
    );
  }

  if (!principal) return <WorkspaceLoading label="Checking your secure session" />;
  const shellActive =
    active === 'profile'
      ? 'overview'
      : ['company', 'branches', 'employees', 'settings'].includes(active)
        ? 'organization'
        : 'administration';
  const subNavigation = {
    overview: visible
      .filter((section) => section.key === 'profile')
      .map((section) => ({
        key: section.key,
        label: section.label,
        onSelect: () => void choose(section),
      })),
    organization: visible
      .filter((section) => ['company', 'branches', 'employees', 'settings'].includes(section.key))
      .map((section) => ({
        key: section.key,
        label: section.label,
        onSelect: () => void choose(section),
      })),
    administration: visible
      .filter((section) => ['roles', 'permissions', 'users', 'audit'].includes(section.key))
      .map((section) => ({
        key: section.key,
        label: section.label,
        onSelect: () => void choose(section),
      })),
  };
  const targetBranchIds = (record: EmployeeRecord | UserAccountRecord): string[] => {
    const employee = 'employee' in record ? record.employee : record;
    return employee.branchAssignments
      .map((assignment) => assignment.branchId)
      .filter((branchId): branchId is string => Boolean(branchId));
  };
  const canManageEmployee = (permission: string, record: EmployeeRecord): boolean =>
    record.accessMode === 'COMPANY_WIDE' || targetBranchIds(record).length === 0
      ? hasCompanyPermission(principal, permission)
      : canPerformAcrossBranches(principal, permission, targetBranchIds(record));
  const canManageUser = (permission: string, record: UserAccountRecord): boolean =>
    record.employee.accessMode === 'COMPANY_WIDE' || targetBranchIds(record).length === 0
      ? hasCompanyPermission(principal, permission)
      : canPerformAcrossBranches(principal, permission, targetBranchIds(record));
  const activeForm = renderForm();
  const supportsSearch = !['profile', 'company', 'permissions', 'settings'].includes(active);
  const supportsStatusFilter = ['branches', 'employees', 'roles', 'users'].includes(active);
  const actionLabel =
    active === 'company'
      ? 'Edit company'
      : active === 'users'
        ? 'Manage access'
        : active === 'permissions'
          ? 'Assign permissions'
          : active === 'branches'
            ? 'Add branch'
            : `Add ${selected.label.replace(/s$/, '').toLowerCase()}`;
  return (
    <AppShell
      active={shellActive}
      activeItem={active}
      subNavigation={subNavigation}
      accessMode={principal.accessMode}
      onLogout={() => void logout()}
    >
      {active === 'employees' ? (
        <>
          {error ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading employee directory" />
          ) : (
            <EmployeeDirectory
              records={records as EmployeeRecord[]}
              branches={catalogs.branches}
              roles={catalogs.roles}
              busy={busy}
              canCreate={hasPermission(principal, 'identity.employee.create')}
              canUpdate={(record) => canManageEmployee('identity.employee.update', record)}
              canManageRoles={(record) => canManageEmployee('identity.role.manage', record)}
              onCreate={(input) => mutateAction('/employees', 'POST', input, 'Employee created.')}
              onUpdate={(employeeId, input) =>
                mutateAction('/employees/' + employeeId, 'PATCH', input, 'Employee updated.')
              }
              onStatus={(employeeId, input) =>
                mutateAction(
                  '/employees/' + employeeId + '/status',
                  'PATCH',
                  input,
                  input.active ? 'Employee activated.' : 'Employee deactivated.',
                )
              }
              onAssignRole={(employeeId, input) =>
                mutateAction('/employees/' + employeeId + '/roles', 'POST', input, 'Role assigned.')
              }
              onLoadDetails={(employeeId) => api<EmployeeRecord>('/employees/' + employeeId)}
            />
          )}
        </>
      ) : active === 'branches' ? (
        <>
          {error ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading branches" />
          ) : (
            <BranchDirectory
              records={records as BranchRecord[]}
              busy={busy}
              canCreate={hasCompanyPermission(principal, 'organization.branch.create')}
              canUpdate={(record) =>
                canPerformInBranch(principal, 'organization.branch.update', record.id)
              }
              onCreate={(input) => mutateAction('/branches', 'POST', input, 'Branch created.')}
              onUpdate={(branchId, input) =>
                mutateAction('/branches/' + branchId, 'PATCH', input, 'Branch updated.')
              }
            />
          )}
        </>
      ) : active === 'roles' ? (
        <>
          {error ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading roles and permissions" />
          ) : (
            <RoleManager
              records={records as RoleRecord[]}
              permissions={catalogs.permissions as PermissionRecord[]}
              busy={busy}
              canManage={hasCompanyPermission(principal, 'identity.role.manage')}
              onCreate={(input) => mutateAction('/roles', 'POST', input, 'Business role created.')}
              onUpdate={(roleId, input) =>
                mutateAction('/roles/' + roleId, 'PATCH', input, 'Business role updated.')
              }
              onGrant={(roleId, permissionId) =>
                mutateAction(
                  '/roles/' + roleId + '/permissions',
                  'POST',
                  { permissionId },
                  'Capability added.',
                )
              }
              onRevoke={(roleId, permissionId, reason) =>
                mutateAction(
                  '/roles/' + roleId + '/permissions/' + permissionId,
                  'DELETE',
                  { reason },
                  'Capability removed.',
                )
              }
            />
          )}
        </>
      ) : active === 'users' ? (
        <>
          {error ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading user accounts" />
          ) : (
            <UserAccountDirectory
              records={records as UserAccountRecord[]}
              busy={busy}
              canChangeStatus={(record) => canManageUser('identity.user.suspend', record)}
              canRevokeSession={(record) => canManageUser('identity.session.revoke', record)}
              onStatus={(userId, input) =>
                mutateAction(
                  '/users/' + userId + '/status',
                  'PATCH',
                  input,
                  'Account status updated.',
                )
              }
              onRevoke={(sessionId, reason) =>
                mutateAction(
                  '/auth/sessions/' + sessionId + '/revoke',
                  'POST',
                  { reason },
                  'Session revoked.',
                )
              }
            />
          )}
        </>
      ) : active === 'settings' ? (
        <>
          {error ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading settings" />
          ) : (
            <SettingsPanel
              company={(rawRecords[0] ?? {}) as CompanySettings}
              busy={busy}
              canUpdate={hasCompanyPermission(principal, 'organization.company.update')}
              onSave={(input) => mutateAction('/company', 'PATCH', input, 'Settings saved.')}
            />
          )}
        </>
      ) : (
        <>
          <PageHeader
            eyebrow={active === 'audit' ? 'Governance' : 'Organization & access'}
            title={selected.label}
            description={selected.description}
            action={
              activeForm ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                    type="button"
                    onClick={() => setShowForm(true)}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {actionLabel}
                  </button>
                </div>
              ) : undefined
            }
          />
          {error ? <Feedback kind="error">{error}</Feedback> : null}
          {success ? <Feedback kind="success">{success}</Feedback> : null}
          {supportsSearch ? (
            <div className="list-toolbar" role="search">
              <div className="list-tools">
                <label className="search-control">
                  <span className="sr-only">Search {selected.label.toLowerCase()}</span>
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${selected.label.toLowerCase()}...`}
                  />
                </label>
                {supportsStatusFilter ? (
                  <label>
                    <span className="sr-only">Filter by status</span>
                    <select
                      className="status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                ) : null}
              </div>
              <p className="result-count" aria-live="polite">
                {records.length} of {rawRecords.length} records
              </p>
            </div>
          ) : null}
          <div className="content-grid">
            <section className="stack">
              {loading ? (
                <LoadingState />
              ) : error ? (
                <ErrorState message={error} onRetry={() => void load(selected, principal)} />
              ) : (
                renderRecords()
              )}
              {!loading && ['permissions', 'audit'].includes(active) ? (
                <PaginationControls
                  page={listPagination.page}
                  pageCount={listPagination.pageCount}
                  total={records.length}
                  onPageChange={listPagination.setPage}
                />
              ) : null}
            </section>
          </div>
          {showForm && activeForm ? (
            <>
              <button
                className="drawer-scrim"
                aria-label="Close form"
                onClick={() => setShowForm(false)}
              />
              <aside
                className="form-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-drawer-title"
              >
                <div className="drawer-header">
                  <div>
                    <h2 id="form-drawer-title">{actionLabel}</h2>
                    <p>Complete the required information, then save your changes.</p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close form"
                    onClick={() => setShowForm(false)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                {activeForm}
              </aside>
            </>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
