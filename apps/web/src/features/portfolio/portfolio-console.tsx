'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

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
  pageItems,
  type CursorPage,
  userFacingError,
} from '@/lib/phase3-api';
import styles from './portfolio-console.module.css';
import { RentableSpaceOperations, type RentableSpaceDetailTab } from './rentable-space-operations';
import { AppShell } from '@/components/shared/app-shell';
import { EmptyState, LoadingState, StatusBadge, WorkspaceLoading } from '@/components/shared/ui';
import { humanize } from '@/lib/presentation';
import {
  PropertyRegistry,
  type PropertyDetailTab,
  type PropertyRecord,
} from './pages/property-registry';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { PartyDirectory, type PartyRecord } from './pages/party-directory';
import { OwnerDirectory, type OwnerDetailTab, type OwnerRecord } from './pages/owner-directory';
import { AmenityDirectory, type AmenityRecord } from './pages/amenity-directory';
import { PORTFOLIO_NAVIGATION, portfolioNavigationView } from './portfolio-ia';
import {
  OwnerSectionWorkspace,
  PropertySectionWorkspace,
  SpaceSectionWorkspace,
} from './portfolio-section-workspaces';
import { isAggregatePortfolioView } from './portfolio-workspace-model';

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
  building?: { id: string; name: string; buildingCode: string } | null;
};
type Amenity = AmenityRecord;
type SpaceType = { id: string; code: string; name: string };
type Building = { id: string; buildingCode: string; name: string; status: string };

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
  const [activeView, setActiveView] = useState('overview');
  const [records, setRecords] = useState<Party[] | Owner[] | Property[] | Space[] | Amenity[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceTypes, setSpaceTypes] = useState<SpaceType[]>([]);
  const [spaceBuildings, setSpaceBuildings] = useState<Building[]>([]);
  const [spaceTypeCode, setSpaceTypeCode] = useState('ENTIRE_PROPERTY');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceBuildingFilter, setSpaceBuildingFilter] = useState('');
  const [spaceTypeFilter, setSpaceTypeFilter] = useState('');
  const [spaceStatusFilter, setSpaceStatusFilter] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const spaceFilterQuery = {
    search: spaceSearch,
    buildingId: spaceBuildingFilter,
    typeCode: spaceTypeFilter,
    status: spaceStatusFilter,
  };
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [pageInfo, setPageInfo] = useState({
    nextCursor: null as string | null,
    hasNextPage: false,
  });

  const loadTab = useCallback(
    async (
      tab: Tab,
      filter = '',
      cursor: string | null = null,
      spaceFilters?: { search?: string; buildingId?: string; typeCode?: string; status?: string },
    ) => {
      const resource = tab === 'spaces' ? 'rentable-spaces' : tab;
      const parameters = new URLSearchParams();
      if (tab !== 'amenities') parameters.set('limit', '10');
      if (tab === 'spaces' && filter) parameters.set('propertyId', filter);
      if (tab === 'spaces' && spaceFilters?.search) parameters.set('search', spaceFilters.search);
      if (tab === 'spaces' && spaceFilters?.buildingId)
        parameters.set('buildingId', spaceFilters.buildingId);
      if (tab === 'spaces' && spaceFilters?.typeCode)
        parameters.set('typeCode', spaceFilters.typeCode);
      if (tab === 'spaces' && spaceFilters?.status) parameters.set('status', spaceFilters.status);
      if (cursor) parameters.set('cursor', cursor);
      const path = `/${resource}${parameters.size ? `?${parameters.toString()}` : ''}`;
      const response = await apiCached<CursorPage<unknown> | unknown[]>(path);
      const result = pageItems(response) as Party[] | Owner[] | Property[] | Space[] | Amenity[];
      setRecords(result);
      setPageInfo(
        Array.isArray(response) ? { nextCursor: null, hasNextPage: false } : response.pageInfo,
      );
      if (tab === 'parties') setParties(result as Party[]);
      if (tab === 'properties') setProperties(result as Property[]);
      if (tab === 'spaces') setSpaces(result as Space[]);
      if (tab === 'owners') setOwners(result as Owner[]);
    },
    [],
  );

  useEffect(() => {
    api<Principal>('/auth/me')
      .then(async (current) => {
        setPrincipal(current);
        const parameters = new URLSearchParams(window.location.search);
        const requested = parameters.get('section');
        const first =
          tabs.find((item) => item.key === requested && hasPermission(current, item.permission))
            ?.key ??
          tabs.find((item) => hasPermission(current, item.permission))?.key ??
          'properties';
        setActive(first);
        setActiveView(portfolioNavigationView(first, parameters.get('view')));
        const [branchData, partyData, propertyData, ownerData] = await Promise.all([
          (first === 'properties' || first === 'parties') &&
          hasPermission(current, 'organization.branch.read')
            ? apiCached<Branch[]>('/branches')
            : null,
          first === 'owners' && hasPermission(current, 'party.read')
            ? apiCached<CursorPage<Party>>('/parties').then(pageItems)
            : null,
          first === 'spaces' && hasPermission(current, 'portfolio.property.read')
            ? apiCached<CursorPage<Property>>('/properties').then(pageItems)
            : null,
          first === 'properties' && hasPermission(current, 'owner.read')
            ? apiCached<CursorPage<Owner>>('/owners').then(pageItems)
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

  useEffect(() => {
    if (!principal || !hasPermission(principal, 'portfolio.space.read')) return;
    apiCached<SpaceType[]>('/rentable-spaces/types')
      .then(setSpaceTypes)
      .catch(() => setSpaceTypes([]));
  }, [principal]);

  useEffect(() => {
    if (!propertyFilter) {
      setSpaceBuildings([]);
      return;
    }
    apiCached<Building[]>(`/properties/${propertyFilter}/buildings`)
      .then(setSpaceBuildings)
      .catch(() => setSpaceBuildings([]));
  }, [propertyFilter]);
  const visibleTabs = principal
    ? tabs.filter((tab) => hasPermission(principal, tab.permission))
    : [];
  const canManageSpaces = principal
    ? ['portfolio.space.create', 'portfolio.space.update', 'portfolio.space.partition'].some(
        (permission) => hasPermission(principal, permission),
      )
    : false;
  const activePropertyBranchIds = (property: PropertyRecord): string[] => {
    const currentDate = principal?.businessDate ?? '';
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
        ? apiCached<CursorPage<Party>>('/parties').then(pageItems)
        : null,
      tab === 'spaces' && hasPermission(principal, 'portfolio.property.read')
        ? apiCached<CursorPage<Property>>('/properties').then(pageItems)
        : null,
      tab === 'properties' && hasPermission(principal, 'owner.read')
        ? apiCached<CursorPage<Owner>>('/owners').then(pageItems)
        : null,
    ]);
    if (branchData) setBranches(branchData);
    if (partyData) setParties(partyData);
    if (propertyData) setProperties(propertyData);
    if (ownerData) setOwners(ownerData);
  }
  const resetCursor = () => {
    setCursorHistory([null]);
    setCursorIndex(0);
  };
  async function nextServerPage() {
    if (!pageInfo.nextCursor || loading) return;
    const nextHistory = [...cursorHistory.slice(0, cursorIndex + 1), pageInfo.nextCursor];
    setCursorHistory(nextHistory);
    setCursorIndex(cursorIndex + 1);
    setLoading(true);
    try {
      await loadTab(
        active,
        active === 'spaces' ? propertyFilter : '',
        pageInfo.nextCursor,
        active === 'spaces' ? spaceFilterQuery : undefined,
      );
    } finally {
      setLoading(false);
    }
  }
  async function previousServerPage() {
    if (cursorIndex <= 0 || loading) return;
    const previousIndex = cursorIndex - 1;
    setCursorIndex(previousIndex);
    setLoading(true);
    try {
      await loadTab(
        active,
        active === 'spaces' ? propertyFilter : '',
        cursorHistory[previousIndex] ?? null,
        active === 'spaces' ? spaceFilterQuery : undefined,
      );
    } finally {
      setLoading(false);
    }
  }
  async function choose(tab: Tab, requestedView?: string) {
    const view = portfolioNavigationView(tab, requestedView);
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('section', tab);
    if (tab === 'amenities') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    window.history.pushState({}, '', url);
    if (tab === active) return;

    setLoading(true);
    setActive(tab);
    setError('');
    setSuccess('');
    setShowActions(false);
    resetCursor();
    try {
      await Promise.all([
        loadTab(
          tab,
          tab === 'spaces' ? propertyFilter : '',
          null,
          tab === 'spaces' ? spaceFilterQuery : undefined,
        ),
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
    resetCursor();
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
      resetCursor();
      await loadTab(
        active,
        active === 'spaces' ? propertyFilter : '',
        null,
        active === 'spaces' ? spaceFilterQuery : undefined,
      );
      if (active === 'parties')
        setParties(await apiCached<CursorPage<Party>>('/parties').then(pageItems));
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
      resetCursor();
      await loadTab(
        active,
        active === 'spaces' ? propertyFilter : '',
        null,
        active === 'spaces' ? spaceFilterQuery : undefined,
      );
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
        effectiveFrom: principal?.businessDate ?? '',
        city: formValue(form, 'city'),
        addressLine1: formValue(form, 'addressLine1') || undefined,
      },
      'Draft property created. Add ownership before activation.',
    );
  }

  function spaceForm(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const typeCode = formValue(form, 'typeCode');
    const usableArea = formValue(form, 'usableArea');
    const totalArea = formValue(form, 'totalArea');
    const areaUnit = formValue(form, 'areaUnit');
    const integer = (name: string) => {
      const value = formValue(form, name);
      return value === '' ? undefined : Number.parseInt(value, 10);
    };
    const residential = {
      bedrooms: integer('bedrooms'),
      bathrooms: formValue(form, 'bathrooms') || undefined,
      kitchens: integer('kitchens'),
      livingRooms: integer('livingRooms'),
      balconies: integer('balconies'),
      furnishedStatus: formValue(form, 'furnishedStatus') || undefined,
    };
    const commercial = {
      frontageMeters: formValue(form, 'frontageMeters') || undefined,
      classification: formValue(form, 'classification') || undefined,
    };
    const hasResidential = Object.values(residential).some((value) => value !== undefined);
    const hasCommercial = Object.values(commercial).some((value) => value !== undefined);
    void submit(
      event,
      '/rentable-spaces',
      {
        propertyId: formValue(form, 'propertyId'),
        buildingId: formValue(form, 'buildingId') || undefined,
        parentSpaceId: formValue(form, 'parentSpaceId') || undefined,
        typeCode,
        spaceCode: formValue(form, 'spaceCode') || undefined,
        name: formValue(form, 'name'),
        effectiveFrom: principal?.businessDate ?? '',
        usableArea: usableArea || undefined,
        totalArea: totalArea || undefined,
        areaUnit: usableArea || totalArea ? areaUnit : undefined,
        floorNumber: integer('floorNumber'),
        capacity: integer('capacity'),
        ...(typeCode === 'LAND'
          ? {
              land: {
                permittedUse: formValue(form, 'permittedUse'),
                dimensions: formValue(form, 'dimensions') || undefined,
                currentUse: formValue(form, 'currentUse') || undefined,
                boundaryDescription: formValue(form, 'boundaryDescription') || undefined,
                roadAccess: formValue(form, 'roadAccess') || undefined,
                fenced: formValue(form, 'fenced') === 'true',
              },
            }
          : {}),
        ...(typeCode !== 'LAND' && hasResidential ? { residential } : {}),
        ...(typeCode !== 'LAND' && hasCommercial ? { commercial } : {}),
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
              <SearchableSelect name="kind">
                <option value="PERSON">Person</option>
                <option value="ORGANIZATION">Organization</option>
              </SearchableSelect>
            </label>
          </div>
          <label>
            Display or legal name
            <input name="displayName" required minLength={2} />
          </label>
          <div className={styles.row}>
            <label>
              Contact type
              <SearchableSelect name="contactType">
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </SearchableSelect>
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
            <SearchableSelect searchable name="partyId" required>
              <option value="">Choose a party</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.partyNumber} — {party.displayName}
                </option>
              ))}
            </SearchableSelect>
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
              <SearchableSelect name="propertyType">
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="MIXED_USE">Mixed use</option>
                <option value="VACANT_LAND">Vacant land</option>
              </SearchableSelect>
            </label>
          </div>
          <label>
            Property name
            <input name="name" required />
          </label>
          <div className={styles.row}>
            <label>
              Operating branch
              <SearchableSelect searchable name="branchId" required>
                <option value="">Choose a branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SearchableSelect>
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
            <SearchableSelect
              searchable
              name="propertyId"
              required
              value={propertyFilter}
              onChange={(event) => {
                const propertyId = event.target.value;
                setPropertyFilter(propertyId);
                setSpaceBuildings([]);
                if (propertyId)
                  void apiCached<Building[]>(`/properties/${propertyId}/buildings`).then(
                    setSpaceBuildings,
                  );
              }}
            >
              <option value="">Choose a property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.propertyCode} — {property.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <div className={styles.row}>
            <label>
              Type
              <SearchableSelect
                name="typeCode"
                required
                value={spaceTypeCode}
                onChange={(event) => setSpaceTypeCode(event.target.value)}
              >
                {spaceTypes.map((type) => (
                  <option key={type.id} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <label>
              Space code (optional)
              <input name="spaceCode" maxLength={50} />
            </label>
          </div>
          <label>
            Space name
            <input name="name" required maxLength={160} />
          </label>
          <div className={styles.row}>
            <label>
              Building (optional)
              <SearchableSelect searchable name="buildingId">
                <option value="">No building</option>
                {spaceBuildings
                  .filter((building) => building.status !== 'RETIRED')
                  .map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.buildingCode} — {building.name}
                    </option>
                  ))}
              </SearchableSelect>
            </label>
            <label>
              Parent space (optional)
              <SearchableSelect searchable name="parentSpaceId">
                <option value="">Standalone / top level</option>
                {spaces
                  .filter(
                    (space) => space.propertyId === propertyFilter && space.status !== 'RETIRED',
                  )
                  .map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.spaceCode} — {space.name}
                    </option>
                  ))}
              </SearchableSelect>
            </label>
          </div>
          <div className={styles.row}>
            <label>
              Usable area
              <input name="usableArea" inputMode="decimal" />
            </label>
            <label>
              Total area
              <input name="totalArea" inputMode="decimal" />
            </label>
            <label>
              Area unit
              <SearchableSelect name="areaUnit">
                <option value="SQM">Square metres</option>
                <option value="SQFT">Square feet</option>
                <option value="ACRE">Acres</option>
                <option value="HECTARE">Hectares</option>
              </SearchableSelect>
            </label>
          </div>
          <div className={styles.row}>
            <label>
              Floor number
              <input name="floorNumber" type="number" />
            </label>
            <label>
              Capacity
              <input name="capacity" type="number" min="0" />
            </label>
          </div>
          {spaceTypeCode === 'LAND' ? (
            <>
              <h3>Land details</h3>
              <label>
                Permitted use
                <input name="permittedUse" required maxLength={200} />
              </label>
              <div className={styles.row}>
                <label>
                  Dimensions
                  <input name="dimensions" maxLength={160} />
                </label>
                <label>
                  Current use
                  <input name="currentUse" maxLength={200} />
                </label>
                <label>
                  Road access
                  <input name="roadAccess" maxLength={200} />
                </label>
              </div>
              <label>
                Boundary description
                <textarea name="boundaryDescription" maxLength={2000} />
              </label>
              <label>
                Fenced
                <SearchableSelect name="fenced" defaultValue="false">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </SearchableSelect>
              </label>
            </>
          ) : (
            <>
              <h3>Optional residential details</h3>
              <div className={styles.row}>
                <label>
                  Bedrooms
                  <input name="bedrooms" type="number" min="0" />
                </label>
                <label>
                  Bathrooms
                  <input name="bathrooms" inputMode="decimal" />
                </label>
                <label>
                  Kitchens
                  <input name="kitchens" type="number" min="0" />
                </label>
                <label>
                  Living rooms
                  <input name="livingRooms" type="number" min="0" />
                </label>
                <label>
                  Balconies
                  <input name="balconies" type="number" min="0" />
                </label>
                <label>
                  Furnished status
                  <input name="furnishedStatus" maxLength={30} />
                </label>
              </div>
              <h3>Optional commercial details</h3>
              <div className={styles.row}>
                <label>
                  Frontage (metres)
                  <input name="frontageMeters" inputMode="decimal" />
                </label>
                <label>
                  Classification
                  <input name="classification" maxLength={60} />
                </label>
              </div>
            </>
          )}
          <button className={styles.submit} disabled={busy || !spaceTypes.length}>
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
        <table className="w-full min-w-[1020px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {[
                'Rentable space',
                'Property',
                'Building',
                'Type',
                'Parent',
                'Area',
                'Status',
                'Actions',
              ].map((header) => (
                <th
                  key={header}
                  className={
                    'px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ' +
                    (header === 'Actions' ? 'text-right' : '')
                  }
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {spaces.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-4">
                  <strong className="block text-sm text-slate-900">{item.name}</strong>
                  <span className="text-xs text-slate-500">{item.spaceCode}</span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {propertyName(item.propertyId)}
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">
                  {item.building?.name ?? 'Standalone'}
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
                    onClick={() => {
                      setSelectedSpaceId(item.id);
                      setShowActions(true);
                    }}
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

  const hierarchicalPortfolioNavigation = visibleTabs.map((tab) => {
    if (tab.key === 'amenities') {
      return {
        key: tab.key,
        label: tab.label,
        onSelect: () => void choose(tab.key),
      };
    }
    return {
      key: tab.key,
      label: tab.label,
      children: PORTFOLIO_NAVIGATION[tab.key].map((item) => ({
        key: `${tab.key}:${item.key}`,
        label: item.label,
        onSelect: () => void choose(tab.key, item.key),
      })),
    };
  });
  const activeNavigationItem = active === 'amenities' ? 'amenities' : `${active}:${activeView}`;
  const activeSectionLabel = tabs.find((tab) => tab.key === active)?.label ?? 'Portfolio';
  const activeChildLabel =
    active === 'amenities'
      ? 'Amenity Catalog'
      : (PORTFOLIO_NAVIGATION[active].find((item) => item.key === activeView)?.label ??
        PORTFOLIO_NAVIGATION[active][0].label);

  const partyKind =
    activeView === 'people' ? 'PERSON' : activeView === 'organizations' ? 'ORGANIZATION' : 'all';
  const ownerDetailTab: OwnerDetailTab =
    activeView === 'owned-properties'
      ? 'owned-properties'
      : activeView === 'documents'
        ? 'documents'
        : 'overview';
  const propertyDetailTab = activeView as PropertyDetailTab;
  const rentableSpaceDetailTab = activeView as RentableSpaceDetailTab;

  if (!principal) return <WorkspaceLoading label="Checking your secure session" />;
  return (
    <AppShell
      active="portfolio"
      activeItem={activeNavigationItem}
      subNavigation={{
        portfolio: hierarchicalPortfolioNavigation,
      }}
      accessMode={principal.accessMode}
      accessBranches={principal.branches}
      permissions={principal.permissions}
      onLogout={() => void logout()}
    >
      <nav
        className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"
        aria-label="Breadcrumb"
      >
        <span>Portfolio</span>
        <span aria-hidden="true">/</span>
        <span>{activeSectionLabel}</span>
        <span aria-hidden="true">/</span>
        <span className="text-slate-900" aria-current="page">
          {activeChildLabel}
        </span>
      </nav>

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
              className="mb-4 rounded-lg border border-[#90CAF9] bg-[#E3F2FD] px-4 py-3 text-sm font-semibold text-[#0D47A1]"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading people and organizations" />
          ) : (
            <PartyDirectory
              initialKind={partyKind}
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
              className="mb-4 rounded-lg border border-[#90CAF9] bg-[#E3F2FD] px-4 py-3 text-sm font-semibold text-[#0D47A1]"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading property owners" />
          ) : isAggregatePortfolioView('owners', activeView) ? (
            <OwnerSectionWorkspace
              view={activeView as 'owned-properties' | 'documents'}
              records={records as OwnerRecord[]}
              canReadDocuments={hasPermission(principal, 'portfolio.document.read')}
            />
          ) : (
            <OwnerDirectory
              initialDetailTab={ownerDetailTab}
              businessDate={principal.businessDate}
              records={records as OwnerRecord[]}
              parties={parties}
              busy={busy}
              canCreate={(record) => canAcross('owner.create', record.scopeBranchIds)}
              canUpdate={(record) => canAcross('owner.update', record.scopeBranchIds)}
              canReadDocuments={(record) =>
                canAcross('portfolio.document.read', record.scopeBranchIds)
              }
              canManageDocuments={(record) =>
                canAcross('portfolio.document.manage', record.scopeBranchIds)
              }
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
              className="mb-4 rounded-lg border border-[#90CAF9] bg-[#E3F2FD] px-4 py-3 text-sm font-semibold text-[#0D47A1]"
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
              className="mb-4 rounded-lg border border-[#90CAF9] bg-[#E3F2FD] px-4 py-3 text-sm font-semibold text-[#0D47A1]"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading property registry" />
          ) : isAggregatePortfolioView('properties', activeView) ? (
            <PropertySectionWorkspace
              view={activeView as Exclude<PropertyDetailTab, 'overview'>}
              records={records as PropertyRecord[]}
              businessDate={principal.businessDate}
              canReadDocuments={hasPermission(principal, 'portfolio.document.read')}
            />
          ) : (
            <PropertyRegistry
              initialDetailTab={propertyDetailTab}
              principal={principal}
              businessDate={principal.businessDate}
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
              onClick={() => {
                setSelectedSpaceId('');
                setShowActions(true);
              }}
              className={
                (hasPermission(principal, 'portfolio.space.create') ? 'inline-flex' : 'hidden') +
                ' items-center justify-center rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0D47A1]'
              }
            >
              Add rentable space
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
              className="rounded-lg border border-[#90CAF9] bg-[#E3F2FD] px-4 py-3 text-sm font-semibold text-[#0D47A1]"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {active === 'spaces' ? (
            <div className="grid items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
              <label className="grid content-start gap-1.5 text-xs font-semibold text-slate-700">
                <span>Search</span>
                <input
                  type="search"
                  value={spaceSearch}
                  onChange={(event) => {
                    const search = event.target.value;
                    setSpaceSearch(search);
                    resetCursor();
                    void loadTab('spaces', propertyFilter, null, { ...spaceFilterQuery, search });
                  }}
                  placeholder="Name or space code"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0D47A1]"
                />
              </label>
              <label className="grid content-start gap-1.5 text-xs font-semibold text-slate-700">
                <span>Property</span>
                <SearchableSelect
                  value={propertyFilter}
                  searchable
                  searchPlaceholder="Search properties..."
                  className="h-11 text-sm"
                  onChange={(event) => {
                    const propertyId = event.target.value;
                    setPropertyFilter(propertyId);
                    setSpaceBuildingFilter('');
                    resetCursor();
                    void loadTab('spaces', propertyId, null, {
                      ...spaceFilterQuery,
                      buildingId: '',
                    });
                  }}
                >
                  <option value="">All properties</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.propertyCode} — {property.name}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <label className="grid content-start gap-1.5 text-xs font-semibold text-slate-700">
                <span>Building</span>
                <SearchableSelect
                  value={spaceBuildingFilter}
                  searchable
                  searchPlaceholder="Search buildings..."
                  className="h-11 text-sm"
                  onChange={(event) => {
                    const buildingId = event.target.value;
                    setSpaceBuildingFilter(buildingId);
                    resetCursor();
                    void loadTab('spaces', propertyFilter, null, {
                      ...spaceFilterQuery,
                      buildingId,
                    });
                  }}
                  disabled={!propertyFilter}
                >
                  <option value="">All buildings</option>
                  {spaceBuildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.buildingCode} — {building.name}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <label className="grid content-start gap-1.5 text-xs font-semibold text-slate-700">
                <span>Type</span>
                <SearchableSelect
                  value={spaceTypeFilter}
                  className="h-11 text-sm"
                  onChange={(event) => {
                    const typeCode = event.target.value;
                    setSpaceTypeFilter(typeCode);
                    resetCursor();
                    void loadTab('spaces', propertyFilter, null, { ...spaceFilterQuery, typeCode });
                  }}
                >
                  <option value="">All types</option>
                  {spaceTypes.map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <label className="grid content-start gap-1.5 text-xs font-semibold text-slate-700">
                <span>Status</span>
                <SearchableSelect
                  searchable={false}
                  value={spaceStatusFilter}
                  className="h-11 text-sm"
                  onChange={(event) => {
                    const status = event.target.value;
                    setSpaceStatusFilter(status);
                    resetCursor();
                    void loadTab('spaces', propertyFilter, null, { ...spaceFilterQuery, status });
                  }}
                >
                  <option value="">All statuses</option>
                  {['DRAFT', 'ACTIVE', 'INACTIVE', 'RETIRED'].map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
            </div>
          ) : null}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {!isAggregatePortfolioView('spaces', activeView) ? (
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="font-bold">Authorized records</h2>
                <span className="text-xs font-semibold text-slate-500">
                  {records.length} records
                </span>
              </div>
            ) : null}
            <div className="w-full min-w-0">
              {loading ? (
                <LoadingState label="Loading portfolio records" />
              ) : isAggregatePortfolioView('spaces', activeView) ? (
                <SpaceSectionWorkspace
                  view={
                    activeView as
                      | 'hierarchy'
                      | 'measurements'
                      | 'profile'
                      | 'amenities'
                      | 'documents'
                      | 'lifecycle'
                  }
                  records={records as Space[]}
                  canReadDocuments={hasPermission(principal, 'portfolio.document.read')}
                />
              ) : (
                renderRecords()
              )}
            </div>
          </section>
          {showActions ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/35"
              role="dialog"
              aria-modal="true"
              aria-label={selectedSpaceId ? 'Rentable space details' : 'Add rentable space'}
            >
              <button
                type="button"
                className="absolute inset-0"
                aria-label="Close actions"
                onClick={() => {
                  setShowActions(false);
                  setSelectedSpaceId('');
                }}
              />
              <aside
                className={
                  'relative max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl scroll-smooth ' +
                  (selectedSpaceId ? 'max-w-5xl' : 'max-w-2xl')
                }
              >
                <div className="mb-5 flex items-start justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      {selectedSpaceId ? 'Rentable space details' : 'Add rentable space'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedSpaceId
                        ? 'Review hierarchy, measurements, profile, assignments, history, and lifecycle.'
                        : 'Complete the required information and save the new space.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActions(false);
                      setSelectedSpaceId('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-6">
                  {!selectedSpaceId ? renderForm() : null}
                  {active === 'spaces' && selectedSpaceId ? (
                    <RentableSpaceOperations
                      principal={principal}
                      initialSelectedId={selectedSpaceId}
                      initialTab={rentableSpaceDetailTab}
                      spaces={spaces}
                      typeCatalog={spaceTypes}
                      onSaved={async () => {
                        resetCursor();
                        await loadTab('spaces', propertyFilter, null, spaceFilterQuery);
                      }}
                    />
                  ) : null}
                </div>
              </aside>
            </div>
          ) : null}
        </section>
      )}
      {active !== 'amenities' && !loading ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <CursorPaginationControls
            page={cursorIndex + 1}
            itemCount={records.length}
            hasPrevious={cursorIndex > 0}
            hasNext={pageInfo.hasNextPage}
            busy={loading}
            onPrevious={() => void previousServerPage()}
            onNext={() => void nextServerPage()}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
