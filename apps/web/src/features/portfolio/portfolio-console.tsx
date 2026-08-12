'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
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
import styles from './portfolio-console.module.css';
import { PortfolioActions } from './portfolio-actions';
import { AppShell } from '@/components/shared/app-shell';
import { EmptyState, LoadingState, StatusBadge, WorkspaceLoading } from '@/components/shared/ui';
import { humanize } from '@/lib/presentation';
import { PropertyRegistry, type PropertyRecord } from './pages/property-registry';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { PartyDirectory, type PartyRecord } from './pages/party-directory';
import { OwnerDirectory, type OwnerRecord } from './pages/owner-directory';
import { AmenityDirectory, type AmenityRecord } from './pages/amenity-directory';

type Tab = 'parties' | 'owners' | 'properties' | 'spaces' | 'amenities';
type Branch = { id: string; code: string; name: string };
type Party = PartyRecord;
type Owner = OwnerRecord;
type Property = PropertyRecord;
type Space = {
  id: string;
  propertyId: string;
  spaceCode: string;
  name: string;
  status: string;
  type: { code: string; name: string };
  versions: { usableArea: string | null; areaUnit: string | null }[];
  childRelations: { parentSpaceId: string; effectiveTo: string | null }[];
};
type Amenity = AmenityRecord;

const today = () => new Date().toISOString().slice(0, 10);
const tabs: { key: Tab; label: string; permission: string }[] = [
  { key: 'parties', label: 'Parties', permission: 'party.read' },
  { key: 'owners', label: 'Owners', permission: 'owner.read' },
  { key: 'properties', label: 'Properties', permission: 'portfolio.property.read' },
  { key: 'spaces', label: 'Rentable spaces', permission: 'portfolio.space.read' },
  { key: 'amenities', label: 'Amenities', permission: 'portfolio.amenity.read' },
];

const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

export function PortfolioConsole() {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [active, setActive] = useState<Tab>('properties');
  const [records, setRecords] = useState<Party[] | Owner[] | Property[] | Space[] | Amenity[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);

  const loadTab = useCallback(async (tab: Tab, filter = '') => {
    const path =
      tab === 'spaces' && filter
        ? `/rentable-spaces?propertyId=${filter}`
        : `/${tab === 'spaces' ? 'rentable-spaces' : tab}`;
    const result = await apiCached<Party[] | Owner[] | Property[] | Space[] | Amenity[]>(path);
    setRecords(result);
    if (tab === 'parties') setParties(result as Party[]);
    if (tab === 'properties') setProperties(result as Property[]);
    if (tab === 'spaces') setSpaces(result as Space[]);
    if (tab === 'owners') setOwners(result as Owner[]);
  }, []);

  useEffect(() => {
    api<Principal>('/auth/me')
      .then(async (current) => {
        setPrincipal(current);
        const requested = new URLSearchParams(window.location.search).get('section');
        const first =
          tabs.find((item) => item.key === requested && hasPermission(current, item.permission))
            ?.key ??
          tabs.find((item) => hasPermission(current, item.permission))?.key ??
          'properties';
        setActive(first);
        const [branchData, partyData, propertyData, ownerData] = await Promise.all([
          (first === 'properties' || first === 'parties') &&
          hasPermission(current, 'organization.branch.read')
            ? apiCached<Branch[]>('/branches')
            : null,
          first === 'owners' && hasPermission(current, 'party.read')
            ? apiCached<Party[]>('/parties')
            : null,
          first === 'spaces' && hasPermission(current, 'portfolio.property.read')
            ? apiCached<Property[]>('/properties')
            : null,
          first === 'properties' && hasPermission(current, 'owner.read')
            ? apiCached<Owner[]>('/owners')
            : null,
        ]);
        if (branchData) setBranches(branchData);
        if (partyData) setParties(partyData);
        if (propertyData) setProperties(propertyData);
        await loadTab(first);
        if (ownerData) setOwners(ownerData);
        setLoading(false);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [loadTab, router]);

  const visibleTabs = principal
    ? tabs.filter((tab) => hasPermission(principal, tab.permission))
    : [];
  const canManageSpaces = principal
    ? ['portfolio.space.create', 'portfolio.space.update', 'portfolio.space.partition'].some(
        (permission) => hasPermission(principal, permission),
      )
    : false;
  const spacePagination = usePagination(spaces);
  const activePropertyBranchIds = (property: PropertyRecord): string[] => {
    const currentDate = today();
    return property.branchAssignments
      .filter(
        (assignment) =>
          assignment.effectiveFrom.slice(0, 10) <= currentDate &&
          (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > currentDate),
      )
      .map((assignment) => assignment.branchId);
  };
  const canAcross = (permission: string, branchIds: string[]): boolean =>
    principal
      ? branchIds.length
        ? canPerformAcrossBranches(principal, permission, branchIds)
        : hasCompanyPermission(principal, permission)
      : false;
  const partyCreateBranches = branches.filter(
    (branch) => principal && canPerformInBranch(principal, 'party.create', branch.id),
  );
  const propertyCreateBranches = branches.filter(
    (branch) => principal && canPerformInBranch(principal, 'portfolio.property.create', branch.id),
  );

  async function loadDependencies(tab: Tab) {
    if (!principal) return;
    const [branchData, partyData, propertyData, ownerData] = await Promise.all([
      (tab === 'properties' || tab === 'parties') &&
      hasPermission(principal, 'organization.branch.read')
        ? apiCached<Branch[]>('/branches')
        : null,
      tab === 'owners' && hasPermission(principal, 'party.read')
        ? apiCached<Party[]>('/parties')
        : null,
      tab === 'spaces' && hasPermission(principal, 'portfolio.property.read')
        ? apiCached<Property[]>('/properties')
        : null,
      tab === 'properties' && hasPermission(principal, 'owner.read')
        ? apiCached<Owner[]>('/owners')
        : null,
    ]);
    if (branchData) setBranches(branchData);
    if (partyData) setParties(partyData);
    if (propertyData) setProperties(propertyData);
    if (ownerData) setOwners(ownerData);
  }
  async function choose(tab: Tab) {
    if (tab === active) return;
    setLoading(true);
    setActive(tab);
    setError('');
    setSuccess('');
    setShowActions(false);
    try {
      await Promise.all([
        loadTab(tab, tab === 'spaces' ? propertyFilter : ''),
        loadDependencies(tab),
      ]);
    } catch (cause) {
      setError(userFacingError(cause, 'Unable to load records.'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshProperties(message?: string) {
    clearApiCache();
    await loadTab('properties');
    if (message) {
      setSuccess(message);
      toast.success(message);
    }
  }

  async function propertyMutation(
    path: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body: Record<string, unknown>,
    message: string,
  ) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await refreshProperties(message);
    } catch (cause) {
      const messageText = userFacingError(cause, 'The property change could not be saved.');
      setError(messageText);
      toast.error(messageText);
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function portfolioMutation(
    path: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
    message: string,
  ) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      clearApiCache();
      await loadTab(active, active === 'spaces' ? propertyFilter : '');
      if (active === 'parties') setParties(await apiCached<Party[]>('/parties'));
      setSuccess(message);
      toast.success(message);
    } catch (cause) {
      const messageText = userFacingError(cause, 'The record could not be saved.');
      setError(messageText);
      toast.error(messageText);
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clearApiCache();
      router.replace('/login');
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: object,
    message: string,
  ) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      clearApiCache();
      event.currentTarget.reset();
      setSuccess(message);
      await loadTab(active, active === 'spaces' ? propertyFilter : '');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) router.replace('/login');
      const message = userFacingError(cause, 'The record could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function partyForm(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const kind = formValue(form, 'kind');
    const displayName = formValue(form, 'displayName');
    const names = displayName.split(/\s+/);
    const profile =
      kind === 'PERSON'
        ? {
            person: {
              givenName: names[0] ?? displayName,
              familyName: names.slice(1).join(' ') || 'Unknown',
            },
          }
        : { organization: { legalName: displayName } };
    void submit(
      event,
      '/parties',
      {
        kind,
        displayName,
        ...profile,
        contacts: formValue(form, 'contact')
          ? [
              {
                type: formValue(form, 'contactType'),
                value: formValue(form, 'contact'),
                primary: true,
              },
            ]
          : undefined,
      },
      'Party created.',
    );
  }

  function ownerForm(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    void submit(
      event,
      '/owners',
      {
        partyId: formValue(form, 'partyId'),
        status: 'ACTIVE',
      },
      'Owner profile created.',
    );
  }

  function propertyForm(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    void submit(
      event,
      '/properties',
      {
        name: formValue(form, 'name'),
        propertyType: formValue(form, 'propertyType'),
        branchId: formValue(form, 'branchId'),
        effectiveFrom: today(),
        city: formValue(form, 'city'),
        addressLine1: formValue(form, 'addressLine1') || undefined,
      },
      'Draft property created. Add ownership before activation.',
    );
  }

  function spaceForm(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const typeCode = formValue(form, 'typeCode');
    const area = formValue(form, 'usableArea');
    void submit(
      event,
      '/rentable-spaces',
      {
        propertyId: formValue(form, 'propertyId'),
        parentSpaceId: formValue(form, 'parentSpaceId') || undefined,
        typeCode,
        name: formValue(form, 'name'),
        effectiveFrom: today(),
        usableArea: area || undefined,
        areaUnit: area ? formValue(form, 'areaUnit') : undefined,
        ...(typeCode === 'LAND'
          ? { land: { permittedUse: formValue(form, 'permittedUse') || 'General use' } }
          : {}),
      },
      'Rentable space created.',
    );
  }

  function renderForm() {
    if (!principal) return null;
    if (active === 'parties' && hasPermission(principal, 'party.create'))
      return (
        <form className={styles.form} onSubmit={partyForm}>
          <h2>Add a party</h2>
          <div className={styles.row}>
            <label>
              Party kind
              <select name="kind">
                <option value="PERSON">Person</option>
                <option value="ORGANIZATION">Organization</option>
              </select>
            </label>
          </div>
          <label>
            Display or legal name
            <input name="displayName" required minLength={2} />
          </label>
          <div className={styles.row}>
            <label>
              Contact type
              <select name="contactType">
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </label>
            <label>
              Contact (optional)
              <input name="contact" />
            </label>
          </div>
          <button className={styles.submit} disabled={busy}>
            Create party
          </button>
        </form>
      );
    if (active === 'owners' && hasPermission(principal, 'owner.create'))
      return (
        <form className={styles.form} onSubmit={ownerForm}>
          <h2>Create owner profile</h2>
          <label>
            Party
            <select name="partyId" required>
              <option value="">Choose a party</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyNumber} — {party.displayName}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.submit} disabled={busy}>
            Create owner
          </button>
        </form>
      );
    if (active === 'properties' && hasPermission(principal, 'portfolio.property.create'))
      return (
        <form className={styles.form} onSubmit={propertyForm}>
          <h2>Add a draft property</h2>
          <div className={styles.row}>
            <label>
              Property type
              <select name="propertyType">
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="MIXED_USE">Mixed use</option>
                <option value="VACANT_LAND">Vacant land</option>
              </select>
            </label>
          </div>
          <label>
            Property name
            <input name="name" required />
          </label>
          <div className={styles.row}>
            <label>
              Operating branch
              <select name="branchId" required>
                <option value="">Choose a branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <input name="city" required />
            </label>
          </div>
          <label>
            Address (optional)
            <input name="addressLine1" />
          </label>
          <button className={styles.submit} disabled={busy}>
            Create draft property
          </button>
        </form>
      );
    if (active === 'spaces' && hasPermission(principal, 'portfolio.space.create'))
      return (
        <form className={styles.form} onSubmit={spaceForm}>
          <h2>Add a rentable space</h2>
          <label>
            Property
            <select
              name="propertyId"
              required
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
            >
              <option value="">Choose a property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.propertyCode} — {property.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.row}>
            <label>
              Type
              <select name="typeCode">
                <option value="ENTIRE_PROPERTY">Entire property</option>
                <option value="HALL">Hall</option>
                <option value="APARTMENT">Apartment</option>
                <option value="ROOM">Room</option>
                <option value="SHOP">Shop</option>
                <option value="OFFICE">Office</option>
                <option value="LAND">Land</option>
              </select>
            </label>
          </div>
          <label>
            Space name
            <input name="name" required />
          </label>
          <label>
            Parent space (optional)
            <select name="parentSpaceId">
              <option value="">Standalone / top level</option>
              {spaces
                .filter((space) => !propertyFilter || space.propertyId === propertyFilter)
                .map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.spaceCode} — {space.name}
                  </option>
                ))}
            </select>
          </label>
          <div className={styles.row}>
            <label>
              Usable area
              <input name="usableArea" inputMode="decimal" />
            </label>
            <label>
              Area unit
              <select name="areaUnit">
                <option value="SQM">Square metres</option>
                <option value="SQFT">Square feet</option>
                <option value="ACRE">Acres</option>
                <option value="HECTARE">Hectares</option>
              </select>
            </label>
          </div>
          <label>
            Land permitted use (land only)
            <input name="permittedUse" />
          </label>
          <button className={styles.submit} disabled={busy}>
            Create space
          </button>
        </form>
      );
    return (
      <div>
        <h2>Reference catalog</h2>
        <p>This catalog is maintained centrally and is available for assignments.</p>
      </div>
    );
  }

  function renderRecords() {
    if (!records.length)
      return (
        <EmptyState
          title={`No ${tabs.find((tab) => tab.key === active)?.label.toLowerCase()} found`}
          description="There are no records in your authorized scope yet. Use the form to create the first record when permitted."
        />
      );
    if (active === 'parties')
      return (records as Party[]).map((item) => (
        <article className={styles.record} key={item.id}>
          <strong>{item.displayName}</strong>
          <small>
            {item.partyNumber} · {humanize(item.kind)}
          </small>
          <StatusBadge value={item.active} />
        </article>
      ));
    if (active === 'owners')
      return (records as Owner[]).map((item) => (
        <article className={styles.record} key={item.partyId}>
          <strong>{item.party.displayName}</strong>
          <small>{item.ownerNumber}</small>
          <StatusBadge value={item.status} />
        </article>
      ));
    if (active === 'properties')
      return (records as Property[]).map((item) => (
        <article className={styles.record} key={item.id}>
          <strong>{item.name}</strong>
          <small>
            {item.propertyCode} · {humanize(item.propertyType)} · {item.city}
          </small>
          <StatusBadge value={item.status} />
        </article>
      ));
    if (active === 'amenities')
      return (records as Amenity[]).map((item) => (
        <article className={styles.record} key={item.id}>
          <strong>{item.name}</strong>
          <small>{item.code}</small>
        </article>
      ));
    const list = records as Space[];
    const propertyName = (propertyId: string) =>
      properties.find((property) => property.id === propertyId)?.name ?? 'Property not loaded';
    const parentName = (space: Space) => {
      const parentId = space.childRelations.find(
        (relation) => !relation.effectiveTo,
      )?.parentSpaceId;
      return parentId
        ? (list.find((candidate) => candidate.id === parentId)?.name ?? 'Parent space')
        : 'None';
    };
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {['Rentable space', 'Property', 'Type', 'Parent', 'Area', 'Status', 'Actions'].map(
                (header) => (
                  <th
                    key={header}
                    className={
                      'px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ' +
                      (header === 'Actions' ? 'text-right' : '')
                    }
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {spacePagination.pageItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-4">
                  <strong className="block text-sm text-slate-900">{item.name}</strong>
                  <span className="text-xs text-slate-500">{item.spaceCode}</span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {propertyName(item.propertyId)}
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">{item.type.name}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{parentName(item)}</td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {item.versions[0]?.usableArea ?? 'Not set'} {item.versions[0]?.areaUnit ?? ''}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge value={item.status} />
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => setShowActions(true)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {canManageSpaces ? 'Manage' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!principal) return <WorkspaceLoading label="Checking your secure session" />;
  return (
    <AppShell
      active="portfolio"
      activeItem={active}
      subNavigation={{
        portfolio: visibleTabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          onSelect: () => void choose(tab.key),
        })),
      }}
      accessMode={principal.accessMode}
      accessBranches={principal.branches}
      permissions={principal.permissions}
      onLogout={() => void logout()}
    >
      {active === 'parties' ? (
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
            <LoadingState label="Loading people and organizations" />
          ) : (
            <PartyDirectory
              records={records as PartyRecord[]}
              branches={partyCreateBranches}
              busy={busy}
              canCreate={partyCreateBranches.length > 0}
              canUpdate={(record) => canAcross('party.update', record.scopeBranchIds)}
              onCreate={(input) =>
                portfolioMutation('/parties', 'POST', input, 'Person or organization created.')
              }
              onUpdate={(partyId, input) =>
                portfolioMutation('/parties/' + partyId, 'PATCH', input, 'Record updated.')
              }
              onLoadDetails={(partyId) =>
                api<PartyRecord>('/parties/' + partyId).catch((cause: unknown) => {
                  const message = userFacingError(cause, 'Unable to load the complete record.');
                  setError(message);
                  toast.error(message);
                  throw cause;
                })
              }
            />
          )}
        </>
      ) : active === 'owners' ? (
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
            <LoadingState label="Loading property owners" />
          ) : (
            <OwnerDirectory
              records={records as OwnerRecord[]}
              parties={parties}
              busy={busy}
              canCreate={(record) => canAcross('owner.create', record.scopeBranchIds)}
              canUpdate={(record) => canAcross('owner.update', record.scopeBranchIds)}
              onCreate={(input) =>
                portfolioMutation('/owners', 'POST', input, 'Owner profile created.')
              }
              onUpdate={(partyId, input) =>
                portfolioMutation('/owners/' + partyId, 'PATCH', input, 'Owner profile updated.')
              }
              onLoadDetails={(partyId) =>
                api<OwnerRecord>('/owners/' + partyId).catch((cause: unknown) => {
                  const message = userFacingError(cause, 'Unable to load owner properties.');
                  setError(message);
                  toast.error(message);
                  throw cause;
                })
              }
            />
          )}
        </>
      ) : active === 'amenities' ? (
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
            <LoadingState label="Loading amenities catalog" />
          ) : (
            <AmenityDirectory
              records={records as AmenityRecord[]}
              busy={busy}
              canManage={hasCompanyPermission(principal, 'portfolio.amenity.manage')}
              onCreate={(input) =>
                portfolioMutation('/amenities', 'POST', input, 'Amenity created.')
              }
              onUpdate={(amenityId, input) =>
                portfolioMutation('/amenities/' + amenityId, 'PATCH', input, 'Amenity updated.')
              }
            />
          )}
        </>
      ) : active === 'properties' ? (
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
            <LoadingState label="Loading property registry" />
          ) : (
            <PropertyRegistry
              records={records as PropertyRecord[]}
              branches={branches}
              owners={owners}
              creatableBranchIds={propertyCreateBranches.map((branch) => branch.id)}
              busy={busy}
              canCreate={propertyCreateBranches.length > 0}
              canUpdate={(record) =>
                canAcross('portfolio.property.update', activePropertyBranchIds(record))
              }
              canReadOwnership={(record) =>
                canAcross('portfolio.ownership.read', activePropertyBranchIds(record))
              }
              canManageOwnership={(record) =>
                canAcross('portfolio.ownership.manage', activePropertyBranchIds(record))
              }
              onCreate={(input) =>
                propertyMutation('/properties', 'POST', input, 'Draft property created.')
              }
              onUpdate={(propertyId, input) =>
                propertyMutation('/properties/' + propertyId, 'PATCH', input, 'Property updated.')
              }
              onTransition={(propertyId, action, reason) =>
                propertyMutation(
                  '/properties/' + propertyId + '/' + action,
                  'POST',
                  { reason },
                  'Property lifecycle updated.',
                )
              }
              onDiscard={(propertyId, reason) =>
                propertyMutation(
                  '/properties/' + propertyId + '/draft',
                  'DELETE',
                  { reason },
                  'Draft property discarded.',
                )
              }
              onReplaceOwnership={(propertyId, input) =>
                propertyMutation(
                  '/properties/' + propertyId + '/ownership',
                  'PUT',
                  input,
                  'Ownership updated successfully.',
                )
              }
              onLoadDetails={(propertyId) => api<PropertyRecord>('/properties/' + propertyId)}
            />
          )}
        </>
      ) : (
        <section className="space-y-6">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Portfolio
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Rentable spaces
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Canonical rentable spaces, measurements, hierarchy, and retirement history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowActions(true)}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              {canManageSpaces ? 'Add or manage' : 'View space details'}
            </button>
          </header>
          {error ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {active === 'spaces' ? (
            <label className="block max-w-md space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Filter by property</span>
              <select
                value={propertyFilter}
                onChange={(event) => {
                  setPropertyFilter(event.target.value);
                  void loadTab('spaces', event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">All properties</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.propertyCode} — {property.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="font-bold">Authorized records</h2>
              <span className="text-xs font-semibold text-slate-500">{records.length} records</span>
            </div>
            <div className="w-full min-w-0">
              {loading ? <LoadingState label="Loading portfolio records" /> : renderRecords()}
            </div>
            <PaginationControls
              page={spacePagination.page}
              pageCount={spacePagination.pageCount}
              total={spaces.length}
              onPageChange={spacePagination.setPage}
            />
          </section>
          {showActions ? (
            <div
              className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35"
              role="dialog"
              aria-modal="true"
              aria-label="Portfolio actions"
            >
              <button
                type="button"
                className="absolute inset-0"
                aria-label="Close actions"
                onClick={() => setShowActions(false)}
              />
              <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      {tabs.find((tab) => tab.key === active)?.label} actions
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Complete the required information and save the change.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowActions(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-6">
                  {renderForm()}
                  <PortfolioActions
                    principal={principal}
                    active={active}
                    records={records}
                    spaces={spaces}
                    branches={branches}
                    onSaved={async () => {
                      await loadTab(active, active === 'spaces' ? propertyFilter : '');
                      setShowActions(false);
                    }}
                  />
                </div>
              </aside>
            </div>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}
