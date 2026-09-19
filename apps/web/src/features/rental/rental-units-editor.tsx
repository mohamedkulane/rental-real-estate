'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ChoiceGroup, ChoiceOption } from '@/components/shared/choice-option';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

export type RoomDraft = {
  key: string;
  name: string;
  monthlyRent: string;
  bathroomType: string;
  area: string;
  notes: string;
  showMore: boolean;
};

export type UnitDraft = {
  key: string;
  name: string;
  monthlyRent: string;
  rentMode: 'WHOLE' | 'BY_ROOMS';
  bedrooms: string;
  bathrooms: string;
  area: string;
  floor: string;
  description: string;
  showMore: boolean;
  rooms: RoomDraft[];
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyRoom(index = 1): RoomDraft {
  return {
    key: newKey(),
    name: `Room ${index}`,
    monthlyRent: '',
    bathroomType: '',
    area: '',
    notes: '',
    showMore: false,
  };
}

export function createEmptyUnit(index = 1): UnitDraft {
  return {
    key: newKey(),
    name: `Apartment ${index}`,
    monthlyRent: '',
    rentMode: 'WHOLE',
    bedrooms: '',
    bathrooms: '',
    area: '',
    floor: '',
    description: '',
    showMore: false,
    rooms: [],
  };
}

export function unitsToPayload(units: UnitDraft[]) {
  return units
    .map((unit) => {
      const rooms =
        unit.rentMode === 'BY_ROOMS'
          ? unit.rooms
              .filter((room) => room.name.trim() && room.monthlyRent.trim())
              .map((room) => ({
                name: room.name.trim(),
                monthlyRent: room.monthlyRent.trim(),
                ...(room.bathroomType.trim() ? { bathroomType: room.bathroomType.trim() } : {}),
                ...(room.area.trim() ? { area: room.area.trim() } : {}),
                ...(room.notes.trim() ? { notes: room.notes.trim() } : {}),
              }))
          : undefined;
      if (unit.rentMode === 'BY_ROOMS') {
        if (!unit.name.trim() || !rooms?.length) return null;
        return {
          name: unit.name.trim(),
          rentMode: 'BY_ROOMS' as const,
          monthlyRent: rooms.reduce((sum, room) => sum + Number(room.monthlyRent || 0), 0).toFixed(2),
          ...(unit.bedrooms.trim() ? { bedrooms: unit.bedrooms.trim() } : {}),
          ...(unit.bathrooms.trim() ? { bathrooms: unit.bathrooms.trim() } : {}),
          ...(unit.area.trim() ? { area: unit.area.trim() } : {}),
          ...(unit.floor.trim() ? { floor: unit.floor.trim() } : {}),
          ...(unit.description.trim() ? { description: unit.description.trim() } : {}),
          rooms,
        };
      }
      if (!unit.name.trim() || !unit.monthlyRent.trim()) return null;
      return {
        name: unit.name.trim(),
        monthlyRent: unit.monthlyRent.trim(),
        rentMode: 'WHOLE' as const,
        ...(unit.bedrooms.trim() ? { bedrooms: unit.bedrooms.trim() } : {}),
        ...(unit.bathrooms.trim() ? { bathrooms: unit.bathrooms.trim() } : {}),
        ...(unit.area.trim() ? { area: unit.area.trim() } : {}),
        ...(unit.floor.trim() ? { floor: unit.floor.trim() } : {}),
        ...(unit.description.trim() ? { description: unit.description.trim() } : {}),
      };
    })
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
}

function RoomFields({
  room,
  onChange,
  onRemove,
  canRemove,
}: {
  room: RoomDraft;
  onChange: (next: RoomDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Room name
          <input
            className={inputClass}
            value={room.name}
            required
            onChange={(event) => onChange({ ...room, name: event.target.value })}
          />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Monthly rent
          <input
            className={inputClass}
            value={room.monthlyRent}
            required
            inputMode="decimal"
            placeholder="150"
            onChange={(event) => onChange({ ...room, monthlyRent: event.target.value })}
          />
        </label>
        {canRemove ? (
          <button
            type="button"
            className="mt-7 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-red-600"
            onClick={onRemove}
            aria-label="Remove room"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="text-sm font-semibold text-[#215E61]"
        onClick={() => onChange({ ...room, showMore: !room.showMore })}
      >
        {room.showMore ? 'Hide room details' : '+ More details'}
      </button>
      {room.showMore ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Bathroom type
            <input
              className={inputClass}
              value={room.bathroomType}
              placeholder="Private / Shared"
              onChange={(event) => onChange({ ...room, bathroomType: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Area
            <input
              className={inputClass}
              value={room.area}
              inputMode="decimal"
              onChange={(event) => onChange({ ...room, area: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-1">
            Notes
            <input
              className={inputClass}
              value={room.notes}
              onChange={(event) => onChange({ ...room, notes: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function UnitCard({
  unit,
  index,
  onChange,
  onRemove,
  canRemove,
  unitLabel,
}: {
  unit: UnitDraft;
  index: number;
  onChange: (next: UnitDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
  unitLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">
          {unitLabel} {index + 1}
        </p>
        {canRemove ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-red-600"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Unit name
          <input
            className={inputClass}
            value={unit.name}
            required
            onChange={(event) => onChange({ ...unit, name: event.target.value })}
          />
        </label>
        {unit.rentMode === 'WHOLE' ? (
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Monthly rent
            <input
              className={inputClass}
              value={unit.monthlyRent}
              required
              inputMode="decimal"
              placeholder="300"
              onChange={(event) => onChange({ ...unit, monthlyRent: event.target.value })}
            />
          </label>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            Rent is set per room below.
          </div>
        )}
      </div>
      <ChoiceGroup legend="How will this unit be rented?">
        <ChoiceOption
          name={`rent-mode-${unit.key}`}
          value="WHOLE"
          selected={unit.rentMode === 'WHOLE'}
          onSelect={() => onChange({ ...unit, rentMode: 'WHOLE', rooms: [] })}
          label="Rent whole unit"
        />
        <ChoiceOption
          name={`rent-mode-${unit.key}`}
          value="BY_ROOMS"
          selected={unit.rentMode === 'BY_ROOMS'}
          onSelect={() =>
            onChange({
              ...unit,
              rentMode: 'BY_ROOMS',
              rooms: unit.rooms.length ? unit.rooms : [createEmptyRoom(1)],
            })
          }
          label="Rent by rooms"
        />
      </ChoiceGroup>
      {unit.rentMode === 'BY_ROOMS' ? (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">Rooms</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#215E61]"
              onClick={() =>
                onChange({
                  ...unit,
                  rooms: [...unit.rooms, createEmptyRoom(unit.rooms.length + 1)],
                })
              }
            >
              <Plus className="h-4 w-4" /> Add Room
            </button>
          </div>
          {unit.rooms.map((room) => (
            <RoomFields
              key={room.key}
              room={room}
              canRemove={unit.rooms.length > 1}
              onChange={(next) =>
                onChange({
                  ...unit,
                  rooms: unit.rooms.map((item) => (item.key === room.key ? next : item)),
                })
              }
              onRemove={() =>
                onChange({
                  ...unit,
                  rooms: unit.rooms.filter((item) => item.key !== room.key),
                })
              }
            />
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="text-sm font-semibold text-[#215E61]"
        onClick={() => onChange({ ...unit, showMore: !unit.showMore })}
      >
        {unit.showMore ? 'Hide details' : '+ More Details'}
      </button>
      {unit.showMore ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Bedrooms
            <input
              className={inputClass}
              value={unit.bedrooms}
              inputMode="numeric"
              onChange={(event) => onChange({ ...unit, bedrooms: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Bathrooms
            <input
              className={inputClass}
              value={unit.bathrooms}
              inputMode="decimal"
              onChange={(event) => onChange({ ...unit, bathrooms: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Area
            <input
              className={inputClass}
              value={unit.area}
              inputMode="decimal"
              onChange={(event) => onChange({ ...unit, area: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Floor
            <input
              className={inputClass}
              value={unit.floor}
              inputMode="numeric"
              onChange={(event) => onChange({ ...unit, floor: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
            Description
            <textarea
              className={inputClass}
              rows={2}
              value={unit.description}
              onChange={(event) => onChange({ ...unit, description: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function RentalUnitsEditor({
  units,
  onChange,
  unitLabel = 'Unit',
  allowBulk = true,
  allowAdd = true,
}: {
  units: UnitDraft[];
  onChange: (units: UnitDraft[]) => void;
  unitLabel?: string;
  allowBulk?: boolean;
  allowAdd?: boolean;
}) {
  const generatorId = useId();
  const [showGenerator, setShowGenerator] = useState(false);
  const [prefix, setPrefix] = useState(unitLabel);
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState('20');
  const [defaultRent, setDefaultRent] = useState('');

  useEffect(() => {
    setPrefix(unitLabel);
  }, [unitLabel]);

  function generateUnits() {
    const from = Number.parseInt(start, 10);
    const to = Number.parseInt(end, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return;
    if (to - from > 199) return;
    const generated = Array.from({ length: to - from + 1 }, (_, index) => {
      const number = from + index;
      return {
        ...createEmptyUnit(number),
        name: `${prefix.trim() || unitLabel} ${number}`,
        monthlyRent: defaultRent.trim(),
      };
    });
    onChange(generated);
    setShowGenerator(false);
  }

  return (
    <div className="space-y-4">
      {allowAdd ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Rental Units</p>
            <p className="text-xs text-slate-500">
              Add as many units as this property needs. No fixed limit of 3.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowBulk ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowGenerator((current) => !current)}
              >
                Generate Units
              </button>
            ) : null}
            <button
              type="button"
              className="button secondary"
              onClick={() => onChange([...units, createEmptyUnit(units.length + 1)])}
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add Unit
            </button>
          </div>
        </div>
      ) : null}

      {showGenerator ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Generate Units</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Prefix
              <input
                id={`${generatorId}-prefix`}
                className={inputClass}
                value={prefix}
                onChange={(event) => setPrefix(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Start
              <input
                className={inputClass}
                value={start}
                inputMode="numeric"
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              End
              <input
                className={inputClass}
                value={end}
                inputMode="numeric"
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Default monthly rent
              <input
                className={inputClass}
                value={defaultRent}
                inputMode="decimal"
                placeholder="250"
                onChange={(event) => setDefaultRent(event.target.value)}
              />
            </label>
          </div>
          <button type="button" className="button primary" onClick={generateUnits}>
            Generate
          </button>
        </div>
      ) : null}

      {units.length ? (
        <div className="space-y-3">
          {units.map((unit, index) => (
            <UnitCard
              key={unit.key}
              unit={unit}
              index={index}
              unitLabel={unitLabel}
              canRemove={units.length > 1}
              onChange={(next) =>
                onChange(units.map((item) => (item.key === unit.key ? next : item)))
              }
              onRemove={() => onChange(units.filter((item) => item.key !== unit.key))}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          No units yet. Use Add Unit or Generate Units.
        </p>
      )}
    </div>
  );
}
