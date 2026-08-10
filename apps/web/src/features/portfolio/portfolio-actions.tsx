'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  api,
  apiCached,
  canPerformAcrossBranches,
  clearApiCache,
  hasCompanyPermission,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import styles from './portfolio-console.module.css';
import { humanize } from '@/lib/presentation';

type Tab = 'parties' | 'owners' | 'properties' | 'spaces' | 'amenities';
type Item = {
  id?: string;
  partyId?: string;
  name?: string;
  displayName?: string;
  spaceCode?: string;
  partyNumber?: string;
  ownerNumber?: string;
  propertyCode?: string;
  party?: { displayName?: string };
  scopeBranchIds?: string[];
  branchAssignments?: { branchId: string; effectiveFrom: string; effectiveTo?: string | null }[];
  property?: { branchAssignments?: { branchId: string }[] };
};
type Space = {
  id: string;
  propertyId: string;
  spaceCode: string;
  name: string;
  property?: { branchAssignments?: { branchId: string }[] };
};
type Branch = { id: string; code: string; name: string };
type Owner = { partyId: string; ownerNumber: string; party: { displayName: string } };
type Amenity = { id: string; code: string; name: string; active?: boolean };
type Property = {
  id: string;
  propertyCode: string;
  name: string;
  branchAssignments?: { branchId: string; effectiveFrom: string; effectiveTo?: string | null }[];
};

const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
const today = () => new Date().toISOString().slice(0, 10);
const display = (item: unknown, fallback: string) => {
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  return fallback;
};

export function PortfolioActions({
  principal,
  active,
  records,
  spaces,
  branches,
  onSaved,
}: {
  principal: Principal;
  active: Tab;
  records: Item[];
  spaces: Space[];
  branches: Branch[];
  onSaved: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedId('');
    setDetail(null);
    if (active === 'properties')
      void apiCached<Owner[]>('/owners')
        .then(setOwners)
        .catch(() => setOwners([]));
    if (active === 'amenities')
      void Promise.all([
        apiCached<Amenity[]>('/amenities').catch(() => []),
        apiCached<Property[]>('/properties').catch(() => []),
      ]).then(([amenityRows, propertyRows]) => {
        setAmenities(amenityRows);
        setProperties(propertyRows);
      });
  }, [active]);

  async function loadDetail(id: string) {
    setSelectedId(id);
    const root = active === 'spaces' ? 'rentable-spaces' : active;
    if (active === 'amenities') return setDetail(null);
    try {
      setDetail(await api<Record<string, unknown>>(`/${root}/${id}`));
    } catch (cause) {
      setError(userFacingError(cause, 'Unable to load detail.'));
    }
  }

  async function mutate(
    event: FormEvent<HTMLFormElement>,
    path: string,
    method: 'POST' | 'PATCH' | 'PUT',
    body: object,
    success: string,
  ) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      clearApiCache();
      setMessage(success);
      await onSaved();
      if (selectedId && active !== 'amenities') await loadDetail(selectedId);
    } catch (cause) {
      const message = userFacingError(cause, 'The change could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const identity = (item: Item) => item.id ?? item.partyId ?? '';
  const label = (item: Item) => {
    if (item.party?.displayName)
      return [item.party.displayName, item.ownerNumber].filter(Boolean).join(' â€” ');
    const name = item.name ?? item.displayName ?? item.spaceCode;
    const code = item.propertyCode ?? item.partyNumber ?? item.ownerNumber;
    return [name, code].filter(Boolean).join(' â€” ') || 'Business record';
  };
  const currentBranchIds = (item: Item): string[] => {
    if (item.scopeBranchIds?.length) return item.scopeBranchIds;
    if (item.property?.branchAssignments?.length)
      return item.property.branchAssignments.map((assignment) => assignment.branchId);
    const now = today();
    return (item.branchAssignments ?? [])
      .filter(
        (assignment) =>
          assignment.effectiveFrom.slice(0, 10) <= now &&
          (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > now),
      )
      .map((assignment) => assignment.branchId);
  };
  const canUse = (permission: string, item: Item | undefined): boolean => {
    if (!item) return false;
    const branchIds = currentBranchIds(item);
    return branchIds.length
      ? canPerformAcrossBranches(principal, permission, branchIds)
      : hasCompanyPermission(principal, permission);
  };
  const selectedRecord = records.find((item) => identity(item) === selectedId);
  const canSelected = (permission: string) => canUse(permission, selectedRecord);
  const detailCounts = detail
    ? Object.entries(detail).filter(([, item]) => Array.isArray(item))
    : [];

  return (
    <div className={styles.form}>
      <h2>Manage & inspect</h2>
      {active !== 'amenities' ? (
        <label>
          Selected record
          <select value={selectedId} onChange={(event) => void loadDetail(event.target.value)}>
            <option value="">Choose a record</option>
            {records.map((item) => (
              <option key={identity(item)} value={identity(item)}>
                {label(item)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {detail ? (
        <div className={styles.record}>
          <strong>
            {display(detail.name ?? detail.displayName ?? detail.ownerNumber, 'Record details')}
          </strong>
          <small>
            {display(
              detail.propertyCode ?? detail.partyNumber ?? detail.spaceCode,
              'Business record',
            )}
          </small>
          {detailCounts.map(([key, rows]) => (
            <small key={key}>
              {humanize(key)}: {(rows as unknown[]).length}
            </small>
          ))}
        </div>
      ) : null}

      {active === 'parties' && selectedId ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            void mutate(
              event,
              `/parties/${selectedId}`,
              'PATCH',
              { displayName: value(form, 'displayName') },
              'Party updated.',
            );
          }}
        >
          <label>
            Updated display name
            <input name="displayName" required minLength={2} />
          </label>
          <button className={styles.submit} disabled={busy}>
            Update party
          </button>
        </form>
      ) : null}

      {active === 'owners' && selectedId ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            void mutate(
              event,
              `/owners/${selectedId}`,
              'PATCH',
              {
                status: value(form, 'status'),
                communicationPreference: value(form, 'preference') || undefined,
                notes: value(form, 'notes') || undefined,
              },
              'Owner profile updated.',
            );
          }}
        >
          <div className={styles.row}>
            <label>
              Status
              <select name="status">
                <option value="PROSPECTIVE">Prospective</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <label>
              Communication preference
              <input name="preference" placeholder="Phone, emailâ€¦" />
            </label>
          </div>
          <label>
            Internal notes
            <input name="notes" />
          </label>
          <button className={styles.submit} disabled={busy}>
            Update owner
          </button>
        </form>
      ) : null}

      {active === 'properties' && selectedId ? (
        <>
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/properties/${selectedId}`,
                'PATCH',
                { name: value(form, 'name') || undefined, status: value(form, 'status') },
                'Property updated.',
              );
            }}
          >
            <div className={styles.row}>
              <label>
                New name (optional)
                <input name="name" />
              </label>
              <label>
                Status
                <select name="status">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="RETIRED">Retired</option>
                </select>
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Update property
            </button>
          </form>
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/properties/${selectedId}/ownership`,
                'PUT',
                {
                  effectiveFrom: value(form, 'effectiveFrom'),
                  shares: [
                    {
                      ownerPartyId: value(form, 'ownerPartyId'),
                      ownershipPercent: '100',
                      payoutPercent: '100',
                    },
                  ],
                  reason: value(form, 'reason'),
                },
                'Ownership configuration saved.',
              );
            }}
          >
            <label>
              100% owner
              <select name="ownerPartyId" required>
                <option value="">Choose an owner</option>
                {owners.map((owner) => (
                  <option key={owner.partyId} value={owner.partyId}>
                    {owner.ownerNumber} â€” {owner.party.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.row}>
              <label>
                Effective from
                <input name="effectiveFrom" type="date" defaultValue={today()} required />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Replace ownership
            </button>
          </form>
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/properties/${selectedId}/buildings`,
                'POST',
                {
                  buildingCode: value(form, 'buildingCode'),
                  name: value(form, 'name'),
                  numberOfFloors: Number(value(form, 'floors')),
                },
                'Building created.',
              );
            }}
          >
            <div className={styles.row}>
              <label>
                Building code
                <input name="buildingCode" required />
              </label>
              <label>
                Building name
                <input name="name" required />
              </label>
            </div>
            <label>
              Number of floors
              <input name="floors" type="number" min="0" defaultValue="1" />
            </label>
            <button className={styles.submit} disabled={busy}>
              Add building
            </button>
          </form>
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/properties/${selectedId}/branch-transfers`,
                'POST',
                {
                  branchId: value(form, 'branchId'),
                  effectiveFrom: value(form, 'effectiveFrom'),
                  reason: value(form, 'reason'),
                },
                'Operating branch assignment scheduled.',
              );
            }}
          >
            <label>
              New operating branch
              <select name="branchId" required>
                <option value="">Choose a branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.row}>
              <label>
                Effective from
                <input name="effectiveFrom" type="date" defaultValue={today()} required />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Transfer branch
            </button>
          </form>
        </>
      ) : null}

      {active === 'spaces' && selectedId ? (
        <>
          {canSelected('portfolio.space.update') ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/rentable-spaces/${selectedId}/measurements`,
                'POST',
                {
                  effectiveFrom: value(form, 'effectiveFrom'),
                  usableArea: value(form, 'usableArea'),
                  areaUnit: value(form, 'areaUnit'),
                  reason: value(form, 'reason'),
                },
                'Effective measurement correction saved.',
              );
            }}
          >
            <div className={styles.row}>
              <label>
                Usable area
                <input name="usableArea" required />
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
            <div className={styles.row}>
              <label>
                Effective from
                <input name="effectiveFrom" type="date" defaultValue={today()} required />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Correct measurement
            </button>
          </form>
          ) : null}
          {canSelected('portfolio.space.update') ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/rentable-spaces/${selectedId}/parent`,
                'POST',
                {
                  parentSpaceId: value(form, 'parentSpaceId'),
                  effectiveFrom: value(form, 'effectiveFrom'),
                  reason: value(form, 'reason'),
                },
                'Parent assignment changed.',
              );
            }}
          >
            <label>
              New parent
              <select name="parentSpaceId" required>
                <option value="">Choose a parent</option>
                {spaces
                  .filter((space) => space.id !== selectedId)
                  .map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.spaceCode} â€” {space.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className={styles.row}>
              <label>
                Effective from
                <input name="effectiveFrom" type="date" defaultValue={today()} required />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Change parent
            </button>
          </form>
          ) : null}
          {canSelected('portfolio.space.partition') ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/rentable-spaces/${selectedId}/partition`,
                'POST',
                {
                  effectiveFrom: value(form, 'effectiveFrom'),
                  areaUnit: value(form, 'areaUnit'),
                  reason: value(form, 'reason'),
                  children: [
                    {
                      typeCode: value(form, 'typeCode'),
                      name: value(form, 'name'),
                      usableArea: value(form, 'usableArea'),
                    },
                  ],
                },
                'Partition child created atomically.',
              );
            }}
          >
            <div className={styles.row}>
              <label>
                Child type
                <select name="typeCode">
                  <option value="SHOP">Shop</option>
                  <option value="BOOTH">Booth</option>
                  <option value="ROOM">Room</option>
                  <option value="OFFICE">Office</option>
                </select>
              </label>
            </div>
            <label>
              Child name
              <input name="name" required />
            </label>
            <div className={styles.row}>
              <label>
                Usable area
                <input name="usableArea" required />
              </label>
              <label>
                Area unit
                <select name="areaUnit">
                  <option value="SQM">Square metres</option>
                  <option value="SQFT">Square feet</option>
                </select>
              </label>
            </div>
            <div className={styles.row}>
              <label>
                Effective from
                <input name="effectiveFrom" type="date" defaultValue={today()} required />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Create partition child
            </button>
          </form>
          ) : null}
          {canSelected('portfolio.space.update') ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void mutate(
                event,
                `/rentable-spaces/${selectedId}/retire`,
                'POST',
                { effectiveDate: value(form, 'effectiveDate'), reason: value(form, 'reason') },
                'Space retired with history preserved.',
              );
            }}
          >
            <div className={styles.row}>
              <label>
                Retirement date
                <input name="effectiveDate" type="date" defaultValue={today()} required />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </div>
            <button className={styles.submit} disabled={busy}>
              Retire space
            </button>
          </form>
          ) : null}
        </>
      ) : null}

      {active === 'amenities' ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            const [target, targetId] = value(form, 'assignmentTarget').split(':');
            void mutate(
              event,
              `/${target === 'property' ? 'properties' : 'rentable-spaces'}/${targetId}/amenities`,
              'POST',
              { amenityId: value(form, 'amenityId') },
              'Amenity assigned.',
            );
          }}
        >
          <label>
            Property or rentable space
            <select name="assignmentTarget" required>
              <option value="">Choose a business record</option>
              <optgroup label="Properties">
                {properties.map((property) => (
                  <option key={property.id} value={`property:${property.id}`}>
                    {property.propertyCode} â€” {property.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Rentable spaces">
                {spaces.map((space) => (
                  <option key={space.id} value={`space:${space.id}`}>
                    {space.spaceCode} â€” {space.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label>
            Amenity
            <select name="amenityId" required>
              <option value="">Choose an amenity</option>
              {amenities
                .filter((amenity) => amenity.active !== false)
                .map((amenity) => (
                  <option key={amenity.id} value={amenity.id}>
                    {amenity.name}
                  </option>
                ))}
            </select>
          </label>
          <button className={styles.submit} disabled={busy}>
            Assign amenity
          </button>
        </form>
      ) : null}
      {error ? <div className={styles.notice}>{error}</div> : null}
      {message ? <div className={styles.success}>{message}</div> : null}
    </div>
  );
}
