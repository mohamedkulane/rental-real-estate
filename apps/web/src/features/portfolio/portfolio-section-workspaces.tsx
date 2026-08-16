'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Building2,
  FileText,
  GitBranch,
  Home,
  Map,
  Ruler,
  Sparkles,
  Users,
} from 'lucide-react';
import { EmptyState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { effectivePayoutPercent, ownershipPeriod } from './ownership-model';
import { propertyTimeline } from './portfolio-ia';
import type { OwnerRecord } from './pages/owner-directory';
import type { PropertyRecord } from './pages/property-registry';
import {
  ownerWorkspaceCounts,
  propertyWorkspaceCounts,
  spaceProfileFields,
  spaceWorkspaceCounts,
  type OwnerWorkspaceRecord,
  type PortfolioDocument,
  type PropertyWorkspaceRecord,
  type SpaceWorkspaceDetail,
  type SpaceWorkspaceRecord,
} from './portfolio-workspace-model';

type PropertyView =
  'buildings' | 'spaces' | 'ownership' | 'amenities' | 'documents' | 'branch-history' | 'activity';
type OwnerView = 'owned-properties' | 'documents';
type SpaceView = 'hierarchy' | 'measurements' | 'profile' | 'amenities' | 'documents' | 'lifecycle';

const descriptions: Record<PropertyView | OwnerView | SpaceView, string> = {
  buildings: 'Buildings grouped by their property, with operational status and floor details.',
  spaces: 'Every rentable space grouped by property and building.',
  ownership: 'Effective-dated owner shares and payout allocations across properties.',
  amenities: 'Amenities currently assigned to properties or rentable spaces.',
  documents: 'Document metadata and version counts grouped by the record they belong to.',
  'branch-history': 'Current, scheduled, and historical operating-branch assignments.',
  activity: 'A combined timeline of ownership and branch assignment changes.',
  'owned-properties': 'Properties linked to each owner, including ownership and payout shares.',
  hierarchy: 'Parent-child space relationships with property and building context.',
  measurements: 'Effective-dated area, floor, and capacity measurements.',
  profile: 'Residential, commercial, or land-specific details for each rentable space.',
  lifecycle: 'Operational status and retirement state for every rentable space.',
};

function WorkspaceHeader({
  title,
  view,
  count,
}: {
  title: string;
  view: keyof typeof descriptions;
  count: number;
}) {
  return (
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          Dedicated workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{descriptions[view]}</p>
      </div>
      <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
        {count} record{count === 1 ? '' : 's'}
      </span>
    </header>
  );
}

function Metrics({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function WorkspaceError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
    >
      {message}
    </div>
  );
}

function ZeroState({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description} />;
}

function RecordCard({
  icon: Icon,
  title,
  eyebrow,
  children,
  status,
}: {
  icon: typeof Building2;
  title: string;
  eyebrow: string;
  children: ReactNode;
  status?: string | undefined;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {eyebrow}
            </p>
            <h2 className="truncate text-sm font-bold text-slate-950">{title}</h2>
          </div>
        </div>
        {status ? <StatusBadge value={status} /> : null}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{children}</div>
    </article>
  );
}

async function documentsFor(entityType: 'Property' | 'Owner' | 'RentableSpace', entityId: string) {
  const page = await api<CursorPage<PortfolioDocument>>(
    `/portfolio-documents?entityType=${entityType}&entityId=${entityId}`,
  );
  return page.items;
}

export function PropertySectionWorkspace({
  view,
  records,
  businessDate,
  canReadDocuments,
}: {
  view: PropertyView;
  records: PropertyRecord[];
  businessDate: string;
  canReadDocuments: boolean;
}) {
  const [details, setDetails] = useState<PropertyWorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all(
      records.map(async (record) => {
        const detail = await api<PropertyWorkspaceRecord>(`/properties/${record.id}`);
        if (view === 'documents' && canReadDocuments)
          detail.documents = await documentsFor('Property', record.id);
        return detail;
      }),
    )
      .then((result) => active && setDetails(result))
      .catch(
        (cause) =>
          active &&
          setError(userFacingError(cause, 'This property workspace could not be loaded.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [canReadDocuments, records, view]);

  const counts = useMemo(() => propertyWorkspaceCounts(details), [details]);
  if (loading) return <LoadingState label={`Loading property ${humanize(view).toLowerCase()}`} />;
  if (error) return <WorkspaceError message={error} />;
  if (view === 'documents' && !canReadDocuments)
    return (
      <section className="space-y-5">
        <WorkspaceHeader title="Documents" view="documents" count={0} />
        <ZeroState
          title="Document access required"
          description="Your role can read these property records but does not include document access. Ask an administrator for the portfolio document read permission."
        />
      </section>
    );

  const cards: ReactNode[] = [];
  if (view === 'buildings')
    details.forEach((property) =>
      property.buildings?.forEach((building) => {
        const record = building as typeof building & {
          status?: string | undefined;
          numberOfFloors?: number | null;
        };
        cards.push(
          <RecordCard
            key={building.id}
            icon={Building2}
            title={building.name}
            eyebrow={`${property.propertyCode} · ${property.name}`}
            status={record.status}
          >
            <p>
              {building.buildingCode} · {record.numberOfFloors ?? 'Not recorded'} floors
            </p>
          </RecordCard>,
        );
      }),
    );
  if (view === 'spaces')
    details.forEach((property) =>
      property.spaces?.forEach((space) =>
        cards.push(
          <RecordCard
            key={space.id}
            icon={Home}
            title={space.name}
            eyebrow={`${property.propertyCode} · ${space.building?.name ?? 'Standalone'}`}
            status={space.status}
          >
            <p>
              {space.spaceCode} · {space.type?.name ?? 'Type not recorded'}
            </p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'ownership')
    details.forEach((property) =>
      property.ownerships?.forEach((ownership) =>
        cards.push(
          <RecordCard
            key={ownership.id}
            icon={Users}
            title={ownership.owner?.displayName ?? 'Owner record'}
            eyebrow={property.name}
            status={ownershipPeriod(ownership, businessDate)}
          >
            <p>
              {ownership.ownershipPercent}% ownership ·{' '}
              {effectivePayoutPercent(ownership, businessDate)}% payout
            </p>
            <p className="mt-1 text-xs">
              Effective {ownership.effectiveFrom.slice(0, 10)}
              {ownership.effectiveTo ? ` to ${ownership.effectiveTo.slice(0, 10)}` : ''}
            </p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'amenities')
    details.forEach((property) =>
      property.amenities?.forEach(({ amenity }) =>
        cards.push(
          <RecordCard
            key={`${property.id}:${amenity.id}`}
            icon={Sparkles}
            title={amenity.name}
            eyebrow={property.name}
          >
            <p>Property amenity assignment</p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'documents')
    details.forEach((property) =>
      property.documents?.forEach((document) =>
        cards.push(
          <RecordCard
            key={document.id}
            icon={FileText}
            title={document.displayName}
            eyebrow={property.name}
            status={document.status}
          >
            <p>
              {humanize(document.categoryCode)} · {humanize(document.accessClass)} ·{' '}
              {document.versions.length} version{document.versions.length === 1 ? '' : 's'}
            </p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'branch-history')
    details.forEach((property) =>
      property.branchAssignments.forEach((assignment, index) => {
        const period =
          assignment.effectiveFrom.slice(0, 10) > businessDate
            ? 'SCHEDULED'
            : assignment.effectiveTo && assignment.effectiveTo.slice(0, 10) <= businessDate
              ? 'HISTORICAL'
              : 'CURRENT';
        cards.push(
          <RecordCard
            key={`${property.id}:${assignment.branchId}:${index}`}
            icon={GitBranch}
            title={assignment.branch?.name ?? 'Branch assignment'}
            eyebrow={property.name}
            status={period}
          >
            <p>
              Effective {assignment.effectiveFrom.slice(0, 10)}
              {assignment.effectiveTo ? ` to ${assignment.effectiveTo.slice(0, 10)}` : ' onward'}
            </p>
          </RecordCard>,
        );
      }),
    );
  if (view === 'activity')
    details.forEach((property) =>
      propertyTimeline(property).forEach((item) =>
        cards.push(
          <RecordCard
            key={`${property.id}:${item.key}`}
            icon={Activity}
            title={item.label}
            eyebrow={property.name}
          >
            <p>
              {item.date.slice(0, 10)} · {item.detail}
            </p>
          </RecordCard>,
        ),
      ),
    );

  const count =
    view === 'branch-history'
      ? counts.branchAssignments
      : view === 'activity'
        ? cards.length
        : view === 'ownership'
          ? counts.ownerships
          : counts[view];
  return (
    <section className="space-y-5">
      <WorkspaceHeader title={humanize(view)} view={view} count={count} />
      <Metrics
        items={[
          { label: 'Properties loaded', value: counts.properties },
          { label: humanize(view), value: count },
        ]}
      />
      {cards.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
      ) : (
        <ZeroState
          title={`No ${humanize(view).toLowerCase()} recorded`}
          description="Nothing is hidden: add this information from the relevant property record and it will appear here."
        />
      )}
    </section>
  );
}

export function OwnerSectionWorkspace({
  view,
  records,
  canReadDocuments,
}: {
  view: OwnerView;
  records: OwnerRecord[];
  canReadDocuments: boolean;
}) {
  const [details, setDetails] = useState<OwnerWorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all(
      records.map(async (record) => {
        const detail = await api<OwnerWorkspaceRecord>(`/owners/${record.partyId}`);
        if (view === 'documents' && canReadDocuments)
          detail.documents = await documentsFor('Owner', record.partyId);
        return detail;
      }),
    )
      .then((result) => active && setDetails(result))
      .catch(
        (cause) =>
          active && setError(userFacingError(cause, 'This owner workspace could not be loaded.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [canReadDocuments, records, view]);
  const counts = useMemo(() => ownerWorkspaceCounts(details), [details]);
  if (loading) return <LoadingState label={`Loading owner ${humanize(view).toLowerCase()}`} />;
  if (error) return <WorkspaceError message={error} />;
  if (view === 'documents' && !canReadDocuments)
    return (
      <section className="space-y-5">
        <WorkspaceHeader title="Documents" view="documents" count={0} />
        <ZeroState
          title="Document access required"
          description="Your role can read these owner records but does not include document access. Ask an administrator for the portfolio document read permission."
        />
      </section>
    );
  const cards: ReactNode[] = [];
  if (view === 'owned-properties')
    details.forEach((owner) =>
      owner.ownerships?.forEach((ownership) =>
        cards.push(
          <RecordCard
            key={ownership.id}
            icon={Building2}
            title={ownership.property.name}
            eyebrow={`${owner.ownerNumber} · ${owner.party.displayName}`}
            status={ownership.property.status}
          >
            <p>
              {ownership.property.propertyCode} · {ownership.ownershipPercent}% ownership
            </p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'documents')
    details.forEach((owner) =>
      owner.documents?.forEach((document) =>
        cards.push(
          <RecordCard
            key={document.id}
            icon={FileText}
            title={document.displayName}
            eyebrow={owner.party.displayName}
            status={document.status}
          >
            <p>
              {humanize(document.categoryCode)} · {document.versions.length} version
              {document.versions.length === 1 ? '' : 's'}
            </p>
          </RecordCard>,
        ),
      ),
    );
  const count = view === 'owned-properties' ? counts.properties : counts.documents;
  return (
    <section className="space-y-5">
      <WorkspaceHeader title={humanize(view)} view={view} count={count} />
      <Metrics
        items={[
          { label: 'Owners loaded', value: counts.owners },
          { label: humanize(view), value: count },
        ]}
      />
      {cards.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
      ) : (
        <ZeroState
          title={`No ${humanize(view).toLowerCase()} recorded`}
          description="Nothing is hidden: link the information from an owner record and it will appear here."
        />
      )}
    </section>
  );
}

export function SpaceSectionWorkspace({
  view,
  records,
  canReadDocuments,
}: {
  view: SpaceView;
  records: SpaceWorkspaceRecord[];
  canReadDocuments: boolean;
}) {
  const [details, setDetails] = useState<SpaceWorkspaceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all(
      records.map(async (record) => {
        const detail = await api<SpaceWorkspaceDetail>(`/rentable-spaces/${record.id}`);
        if (view === 'documents' && canReadDocuments)
          detail.documents = await documentsFor('RentableSpace', record.id);
        return detail;
      }),
    )
      .then((result) => active && setDetails(result))
      .catch(
        (cause) =>
          active &&
          setError(userFacingError(cause, 'This rentable-space workspace could not be loaded.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [canReadDocuments, records, view]);
  const counts = useMemo(() => spaceWorkspaceCounts(details), [details]);
  if (loading) return <LoadingState label={`Loading space ${humanize(view).toLowerCase()}`} />;
  if (error) return <WorkspaceError message={error} />;
  if (view === 'documents' && !canReadDocuments)
    return (
      <section className="space-y-5">
        <WorkspaceHeader title="Documents" view="documents" count={0} />
        <ZeroState
          title="Document access required"
          description="Your role can read these rentable-space records but does not include document access. Ask an administrator for the portfolio document read permission."
        />
      </section>
    );
  const cards: ReactNode[] = [];
  if (view === 'hierarchy')
    details.forEach((space) =>
      cards.push(
        <RecordCard
          key={space.id}
          icon={Map}
          title={space.name}
          eyebrow={`${space.property?.name ?? 'Property'} · ${space.building?.name ?? 'Standalone'}`}
          status={space.status}
        >
          <p>
            {space.childRelations.find((relation) => !relation.effectiveTo)?.parent
              ? `Parent: ${space.childRelations.find((relation) => !relation.effectiveTo)?.parent?.name}`
              : 'Top-level space'}{' '}
            · {space.parentRelations?.filter((relation) => !relation.effectiveTo).length ?? 0}{' '}
            children
          </p>
        </RecordCard>,
      ),
    );
  if (view === 'measurements')
    details.forEach((space) =>
      space.versions.map((version, index) =>
        cards.push(
          <RecordCard
            key={`${space.id}:${version.id ?? index}`}
            icon={Ruler}
            title={space.name}
            eyebrow={`${space.spaceCode} · ${index === 0 ? 'Current measurement' : 'Measurement history'}`}
          >
            <p>
              {version.usableArea ?? 'Not set'} {version.areaUnit ?? ''} usable ·{' '}
              {version.totalArea ?? 'Not set'} {version.areaUnit ?? ''} total
            </p>
            <p className="mt-1 text-xs">
              Floor {version.floorNumber ?? 'not set'} · Capacity {version.capacity ?? 'not set'}
              {version.effectiveFrom ? ` · Effective ${version.effectiveFrom.slice(0, 10)}` : ''}
            </p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'profile')
    details.forEach((space) =>
      cards.push(
        <RecordCard
          key={space.id}
          icon={Home}
          title={space.name}
          eyebrow={space.type.name}
          status={space.status}
        >
          {spaceProfileFields(space).length ? (
            <dl className="grid grid-cols-2 gap-2">
              {spaceProfileFields(space).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[10px] font-bold uppercase text-slate-400">
                    {humanize(key)}
                  </dt>
                  <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No type-specific fields recorded.</p>
          )}
        </RecordCard>,
      ),
    );
  if (view === 'amenities')
    details.forEach((space) =>
      space.amenities?.forEach(({ amenity }) =>
        cards.push(
          <RecordCard
            key={`${space.id}:${amenity.id}`}
            icon={Sparkles}
            title={amenity.name}
            eyebrow={space.name}
          >
            <p>Rentable-space amenity assignment</p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'documents')
    details.forEach((space) =>
      space.documents?.forEach((document) =>
        cards.push(
          <RecordCard
            key={document.id}
            icon={FileText}
            title={document.displayName}
            eyebrow={space.name}
            status={document.status}
          >
            <p>
              {humanize(document.categoryCode)} · {document.versions.length} version
              {document.versions.length === 1 ? '' : 's'}
            </p>
          </RecordCard>,
        ),
      ),
    );
  if (view === 'lifecycle')
    details.forEach((space) =>
      cards.push(
        <RecordCard
          key={space.id}
          icon={Activity}
          title={space.name}
          eyebrow={`${space.spaceCode} · ${space.type.name}`}
          status={space.status}
        >
          <p>
            {space.status === 'RETIRED'
              ? 'Retired and preserved for history.'
              : 'Available for permitted operational updates.'}
          </p>
        </RecordCard>,
      ),
    );
  const count =
    view === 'hierarchy' || view === 'profile' || view === 'lifecycle'
      ? counts.spaces
      : counts[view];
  return (
    <section className="space-y-5">
      <WorkspaceHeader
        title={view === 'profile' ? 'Space details' : humanize(view)}
        view={view}
        count={count}
      />
      <Metrics
        items={[
          { label: 'Spaces loaded', value: counts.spaces },
          {
            label: view === 'lifecycle' ? 'Retired' : humanize(view),
            value: view === 'lifecycle' ? counts.retired : count,
          },
        ]}
      />
      {cards.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
      ) : (
        <ZeroState
          title={`No ${humanize(view).toLowerCase()} recorded`}
          description="Nothing is hidden: add this information from the relevant rentable-space record and it will appear here."
        />
      )}
    </section>
  );
}
