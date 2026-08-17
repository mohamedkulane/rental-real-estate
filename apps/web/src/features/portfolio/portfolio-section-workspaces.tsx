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

function RecordRow({
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
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
      <td className="px-4 py-3 align-middle">
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E3F2FD] text-[#0D47A1]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-slate-900">
            {title}
          </span>
        </div>
      </td>
      <td className="min-w-[220px] px-4 py-3 text-xs font-semibold text-slate-500">{eyebrow}</td>
      <td className="min-w-[260px] px-4 py-3 text-[13px] leading-5 text-slate-600">
        {children}
      </td>
      <td className="w-32 px-4 py-3 text-right align-middle">
        {status ? (
          <StatusBadge value={status} />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

function RecordTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">Workspace records</caption>
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Record
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Context
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Details
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
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
        <ZeroState
          title="Document access required"
          description="Your role can read these property records but does not include document access. Ask an administrator for the portfolio document read permission."
        />
      </section>
    );

  const rows: ReactNode[] = [];
  if (view === 'buildings')
    details.forEach((property) =>
      property.buildings?.forEach((building) => {
        const record = building as typeof building & {
          status?: string | undefined;
          numberOfFloors?: number | null;
        };
        rows.push(
          <RecordRow
            key={building.id}
            icon={Building2}
            title={building.name}
            eyebrow={`${property.propertyCode} · ${property.name}`}
            status={record.status}
          >
            <p>
              {building.buildingCode} · {record.numberOfFloors ?? 'Not recorded'} floors
            </p>
          </RecordRow>,
        );
      }),
    );
  if (view === 'spaces')
    details.forEach((property) =>
      property.spaces?.forEach((space) =>
        rows.push(
          <RecordRow
            key={space.id}
            icon={Home}
            title={space.name}
            eyebrow={`${property.propertyCode} · ${space.building?.name ?? 'Standalone'}`}
            status={space.status}
          >
            <p>
              {space.spaceCode} · {space.type?.name ?? 'Type not recorded'}
            </p>
          </RecordRow>,
        ),
      ),
    );
  if (view === 'ownership')
    details.forEach((property) =>
      property.ownerships?.forEach((ownership) =>
        rows.push(
          <RecordRow
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
          </RecordRow>,
        ),
      ),
    );
  if (view === 'amenities')
    details.forEach((property) =>
      property.amenities?.forEach(({ amenity }) =>
        rows.push(
          <RecordRow
            key={`${property.id}:${amenity.id}`}
            icon={Sparkles}
            title={amenity.name}
            eyebrow={property.name}
          >
            <p>Property amenity assignment</p>
          </RecordRow>,
        ),
      ),
    );
  if (view === 'documents')
    details.forEach((property) =>
      property.documents?.forEach((document) =>
        rows.push(
          <RecordRow
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
          </RecordRow>,
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
        rows.push(
          <RecordRow
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
          </RecordRow>,
        );
      }),
    );
  if (view === 'activity')
    details.forEach((property) =>
      propertyTimeline(property).forEach((item) =>
        rows.push(
          <RecordRow
            key={`${property.id}:${item.key}`}
            icon={Activity}
            title={item.label}
            eyebrow={property.name}
          >
            <p>
              {item.date.slice(0, 10)} · {item.detail}
            </p>
          </RecordRow>,
        ),
      ),
    );

  const count =
    view === 'branch-history'
      ? counts.branchAssignments
      : view === 'activity'
        ? rows.length
        : view === 'ownership'
          ? counts.ownerships
          : counts[view];
  return (
    <section className="space-y-5">
      <Metrics
        items={[
          { label: 'Properties loaded', value: counts.properties },
          { label: humanize(view), value: count },
        ]}
      />
      {rows.length ? (
        <RecordTable>{rows}</RecordTable>
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
        <ZeroState
          title="Document access required"
          description="Your role can read these owner records but does not include document access. Ask an administrator for the portfolio document read permission."
        />
      </section>
    );
  const rows: ReactNode[] = [];
  if (view === 'owned-properties')
    details.forEach((owner) =>
      owner.ownerships?.forEach((ownership) =>
        rows.push(
          <RecordRow
            key={ownership.id}
            icon={Building2}
            title={ownership.property.name}
            eyebrow={`${owner.ownerNumber} · ${owner.party.displayName}`}
            status={ownership.property.status}
          >
            <p>
              {ownership.property.propertyCode} · {ownership.ownershipPercent}% ownership
            </p>
          </RecordRow>,
        ),
      ),
    );
  if (view === 'documents')
    details.forEach((owner) =>
      owner.documents?.forEach((document) =>
        rows.push(
          <RecordRow
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
          </RecordRow>,
        ),
      ),
    );
  const count = view === 'owned-properties' ? counts.properties : counts.documents;
  return (
    <section className="space-y-5">
      <Metrics
        items={[
          { label: 'Owners loaded', value: counts.owners },
          { label: humanize(view), value: count },
        ]}
      />
      {rows.length ? (
        <RecordTable>{rows}</RecordTable>
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
        <ZeroState
          title="Document access required"
          description="Your role can read these rentable-space records but does not include document access. Ask an administrator for the portfolio document read permission."
        />
      </section>
    );
  const rows: ReactNode[] = [];
  if (view === 'hierarchy')
    details.forEach((space) =>
      rows.push(
        <RecordRow
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
        </RecordRow>,
      ),
    );
  if (view === 'measurements')
    details.forEach((space) =>
      space.versions.map((version, index) =>
        rows.push(
          <RecordRow
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
          </RecordRow>,
        ),
      ),
    );
  if (view === 'profile')
    details.forEach((space) =>
      rows.push(
        <RecordRow
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
        </RecordRow>,
      ),
    );
  if (view === 'amenities')
    details.forEach((space) =>
      space.amenities?.forEach(({ amenity }) =>
        rows.push(
          <RecordRow
            key={`${space.id}:${amenity.id}`}
            icon={Sparkles}
            title={amenity.name}
            eyebrow={space.name}
          >
            <p>Rentable-space amenity assignment</p>
          </RecordRow>,
        ),
      ),
    );
  if (view === 'documents')
    details.forEach((space) =>
      space.documents?.forEach((document) =>
        rows.push(
          <RecordRow
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
          </RecordRow>,
        ),
      ),
    );
  if (view === 'lifecycle')
    details.forEach((space) =>
      rows.push(
        <RecordRow
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
        </RecordRow>,
      ),
    );
  const count =
    view === 'hierarchy' || view === 'profile' || view === 'lifecycle'
      ? counts.spaces
      : counts[view];
  return (
    <section className="space-y-5">
      <Metrics
        items={[
          { label: 'Spaces loaded', value: counts.spaces },
          {
            label: view === 'lifecycle' ? 'Retired' : humanize(view),
            value: view === 'lifecycle' ? counts.retired : count,
          },
        ]}
      />
      {rows.length ? (
        <RecordTable>{rows}</RecordTable>
      ) : (
        <ZeroState
          title={`No ${humanize(view).toLowerCase()} recorded`}
          description="Nothing is hidden: add this information from the relevant rentable-space record and it will appear here."
        />
      )}
    </section>
  );
}
