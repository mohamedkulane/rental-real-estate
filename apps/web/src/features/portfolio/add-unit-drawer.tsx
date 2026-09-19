'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from '@/lib/toast';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { api, apiCached, userFacingError, type Principal } from '@/lib/phase3-api';

const FORM_ID = 'add-unit-drawer-form';
const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

type SpaceType = { id: string; code: string; name: string };
type SpaceOption = { id: string; name: string; spaceCode: string };
type BuildingOption = { id: string; name: string; buildingCode: string };

export function AddUnitDrawer({
  open,
  onClose,
  onCreated,
  principal,
  propertyId,
  buildings = [],
  spaces = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  principal: Principal;
  propertyId: string;
  buildings?: BuildingOption[];
  spaces?: SpaceOption[];
}) {
  const [types, setTypes] = useState<SpaceType[]>([]);
  const [typeCode, setTypeCode] = useState('APARTMENT');
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!open) return;
    void apiCached<SpaceType[]>('/rentable-spaces/types')
      .then((rows) => {
        setTypes(rows);
        if (rows[0] && !rows.some((row) => row.code === typeCode)) {
          setTypeCode(rows[0].code);
        }
      })
      .catch(() => setTypes([]));
  }, [open, typeCode]);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/rentable-spaces', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Unit added.');
      onClose();
      onCreated();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const buildingId = String(form.get('buildingId') ?? '').trim();
    const parentSpaceId = String(form.get('parentSpaceId') ?? '').trim();
    const usableArea = String(form.get('usableArea') ?? '').trim();
    const areaUnit = String(form.get('areaUnit') ?? 'SQM').trim();
    const floor = String(form.get('floor') ?? '').trim();
    create.mutate({
      propertyId,
      typeCode,
      name,
      effectiveFrom: principal.businessDate,
      status: 'ACTIVE',
      ...(buildingId ? { buildingId } : {}),
      ...(parentSpaceId ? { parentSpaceId } : {}),
      ...(usableArea ? { usableArea, areaUnit } : {}),
      ...(floor && Number.isFinite(Number.parseInt(floor, 10))
        ? { floorNumber: Number.parseInt(floor, 10) }
        : {}),
    });
  }

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Property"
      title="Add Unit"
      description="Add a rental unit under this property. Stay on the property page."
      onClose={onClose}
      size="md"
      footer={
        <WorkspaceFormDrawerFooter
          formId={FORM_ID}
          onCancel={onClose}
          submitLabel="Save Unit"
          isPending={create.isPending}
        />
      }
    >
      <form id={FORM_ID} className="space-y-4" onSubmit={onSubmit}>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Unit name
          <input name="name" required maxLength={160} className={inputClass} autoFocus />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Unit type
          <select
            className={inputClass}
            value={typeCode}
            onChange={(event) => setTypeCode(event.target.value)}
            required
          >
            {(types.length
              ? types
              : [
                  { id: '1', code: 'APARTMENT', name: 'Apartment' },
                  { id: '2', code: 'ROOM', name: 'Room' },
                  { id: '3', code: 'SHOP', name: 'Shop' },
                  { id: '4', code: 'OFFICE', name: 'Office' },
                ]
            ).map((type) => (
              <option key={type.id} value={type.code}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-sm font-semibold text-[#215E61]"
          onClick={() => setShowMore((current) => !current)}
        >
          {showMore ? 'Hide details' : '+ More Details'}
        </button>
        {showMore ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            {buildings.length ? (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Building (optional)
                <select name="buildingId" className={inputClass} defaultValue="">
                  <option value="">Whole property</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.buildingCode} — {building.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {spaces.length ? (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Parent unit (optional)
                <select name="parentSpaceId" className={inputClass} defaultValue="">
                  <option value="">Top-level unit</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.spaceCode} — {space.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Area
                <input name="usableArea" inputMode="decimal" className={inputClass} />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Area unit
                <select name="areaUnit" className={inputClass} defaultValue="SQM">
                  <option value="SQM">sqm</option>
                  <option value="SQFT">sqft</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Floor
                <input name="floor" inputMode="numeric" className={inputClass} />
              </label>
            </div>
          </div>
        ) : null}
      </form>
    </WorkspaceFormDrawer>
  );
}
