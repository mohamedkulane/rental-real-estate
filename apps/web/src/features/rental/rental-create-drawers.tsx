'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import toast from '@/lib/toast';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { ChoiceGroup, ChoiceOption } from '@/components/shared/choice-option';
import { BranchSelect } from '@/features/finance/finance-forms';
import {
  api,
  hasPermission,
  type CursorPage,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import {
  createEmptyUnit,
  RentalUnitsEditor,
  unitsToPayload,
  type UnitDraft,
} from './rental-units-editor';

type OwnerOption = { partyId: string; ownerNumber: string; party: { displayName: string } };
type PropertyServiceIntent = 'RENTAL_BROKERAGE' | 'FULL_MANAGEMENT' | 'SALE' | 'CONSTRUCTION';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-1 focus:ring-[#215E61]/12';

const MULTI_UNIT_TYPES = new Set([
  'APARTMENT_BUILDING',
  'COMMERCIAL_BUILDING',
  'COMPOUND',
  'MIXED_USE',
]);

function defaultUnitLabel(propertyType: string) {
  if (propertyType === 'COMMERCIAL_BUILDING') return 'Shop';
  if (propertyType === 'APARTMENT_BUILDING') return 'Apartment';
  return 'Unit';
}

function BranchField({
  principal,
  value,
  onChange,
}: {
  principal: Principal;
  value: string;
  onChange: (value: string) => void;
}) {
  if (principal.branches.length <= 1) return null;
  return (
    <div>
      <BranchSelect
        branches={principal.branches}
        value={value}
        onChange={onChange}
        optional
        label="Branch (optional — leave empty for company headquarters)"
      />
    </div>
  );
}

export function AddRentalPropertyDrawer({
  open,
  onClose,
  onCreated,
  principal,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (serviceIntent: PropertyServiceIntent) => void;
  principal: Principal;
}) {
  const formId = useId();
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [serviceIntent, setServiceIntent] = useState<PropertyServiceIntent>('RENTAL_BROKERAGE');
  const [propertyType, setPropertyType] = useState('HOUSE');
  const [hasMultipleUnits, setHasMultipleUnits] = useState(false);
  const [units, setUnits] = useState<UnitDraft[]>([createEmptyUnit(1), createEmptyUnit(2)]);
  const [singleUnit, setSingleUnit] = useState<UnitDraft>(() => ({
    ...createEmptyUnit(1),
    name: 'Whole property',
  }));
  const [showMore, setShowMore] = useState(false);
  const isLand = propertyType === 'LAND';
  const isSale = serviceIntent === 'SALE';
  const supportsUnits =
    (serviceIntent === 'RENTAL_BROKERAGE' || serviceIntent === 'FULL_MANAGEMENT') && !isLand;
  const unitLabel = defaultUnitLabel(propertyType);

  const owners = useQuery({
    queryKey: ['rental-add-property-owners'],
    enabled: Boolean(open && hasPermission(principal, 'owner.read')),
    queryFn: () => api<CursorPage<OwnerOption>>('/owners?status=ACTIVE&limit=100'),
  });

  const mutation = useMutation({
    mutationFn: (input: { endpoint: string; body: Record<string, unknown> }) =>
      api(input.endpoint, {
        method: 'POST',
        body: JSON.stringify(input.body),
      }),
    onSuccess: () => {
      toast.success(
        isSale
          ? ownerMode === 'new'
            ? 'Owner and property ready for sale.'
            : 'Property ready for sale.'
          : ownerMode === 'new'
            ? 'Owner and property available for rental.'
            : 'Property available for rental.',
      );
      onCreated(serviceIntent);
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  function applyPropertyType(nextType: string) {
    setPropertyType(nextType);
    if (!['RENTAL_BROKERAGE', 'FULL_MANAGEMENT'].includes(serviceIntent) || nextType === 'LAND') {
      setHasMultipleUnits(false);
      return;
    }
    const multi = MULTI_UNIT_TYPES.has(nextType);
    setHasMultipleUnits(multi);
    if (multi && units.length < 2) {
      setUnits([createEmptyUnit(1), createEmptyUnit(2)]);
    }
  }

  function resetLocal() {
    setOwnerMode('existing');
    setOwnerPartyId('');
    setBranchId('');
    setServiceIntent('RENTAL_BROKERAGE');
    setPropertyType('HOUSE');
    setHasMultipleUnits(false);
    setUnits([createEmptyUnit(1), createEmptyUnit(2)]);
    setSingleUnit({ ...createEmptyUnit(1), name: 'Whole property' });
    setShowMore(false);
  }

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Portfolio"
      title="Add Property"
      description="Register a property under an owner. Choose an existing owner, or create a new one."
      onClose={() => {
        if (!mutation.isPending) {
          resetLocal();
          onClose();
        }
      }}
      size="xl"
      footer={
        <WorkspaceFormDrawerFooter
          formId={formId}
          onCancel={() => {
            resetLocal();
            onClose();
          }}
          submitLabel="Save Property"
          isPending={mutation.isPending}
        />
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const multi = supportsUnits && hasMultipleUnits;
          const payloadUnits = multi
            ? unitsToPayload(units)
            : supportsUnits && singleUnit.rentMode === 'BY_ROOMS'
              ? unitsToPayload([{ ...singleUnit, name: singleUnit.name.trim() || 'Whole property' }])
              : undefined;
          if (multi) {
            if (!payloadUnits || payloadUnits.length < 1) {
              toast.error('Add at least one rental unit.');
              return;
            }
            if (payloadUnits.length < 2) {
              toast.error('Add at least two units for a multi-unit property.');
              return;
            }
          }
          if (ownerMode === 'existing' && !ownerPartyId) {
            toast.error('Select an existing owner.');
            return;
          }
          const wholeRent =
            isSale
              ? String(form.get('askingPrice') ?? '').trim()
              : multi
                ? payloadUnits?.[0]?.monthlyRent ?? '0'
                : singleUnit.rentMode === 'BY_ROOMS'
                  ? payloadUnits?.[0]?.monthlyRent ?? '0'
                  : singleUnit.monthlyRent.trim() || String(form.get('monthlyRent') ?? '').trim();
          const district = showMore
            ? String(form.get('district') ?? '').trim() || undefined
            : undefined;
          const addressLine1 = showMore
            ? String(form.get('addressLine1') ?? '').trim() || undefined
            : undefined;
          const baseDescription = showMore
            ? String(form.get('description') ?? '').trim() || undefined
            : undefined;
          const moreDetails = showMore
            ? !isLand
              ? {
                  bedrooms: String(form.get('bedrooms') ?? '').trim() || undefined,
                  bathrooms: String(form.get('bathrooms') ?? '').trim() || undefined,
                  area: String(form.get('area') ?? '').trim() || undefined,
                }
              : {
                  landWidth: String(form.get('landWidth') ?? '').trim() || undefined,
                  landLength: String(form.get('landLength') ?? '').trim() || undefined,
                  area: String(form.get('area') ?? '').trim() || undefined,
                }
            : {};
          const sharedProperty = {
            name: String(form.get('name') ?? '').trim(),
            propertyType,
            location: String(form.get('location') ?? '').trim(),
            ...(branchId ? { branchId } : {}),
            hasMultipleUnits: multi ? 'true' : 'false',
            ...(payloadUnits?.length ? { units: payloadUnits } : {}),
            ...(district ? { district } : {}),
            ...(addressLine1 ? { addressLine1 } : {}),
            ...moreDetails,
          };

          if (ownerMode === 'existing') {
            const description =
              isSale
                ? [baseDescription, `Asking price: ${wholeRent}`].filter(Boolean).join('\n') ||
                  undefined
                : baseDescription;
            mutation.mutate({
              endpoint: '/rental/commands/add-property',
              body: {
                ownerPartyId,
                ...sharedProperty,
                serviceIntent,
                monthlyRent: wholeRent || '0',
                ...(isSale ? { askingPrice: wholeRent } : {}),
                ...(serviceIntent === 'FULL_MANAGEMENT'
                  ? {
                      managementFeePercent: String(form.get('managementFeePercent') ?? '').trim(),
                      effectiveFrom: String(form.get('effectiveFrom') ?? '').trim(),
                    }
                  : {}),
                ...(description ? { description } : {}),
              },
            });
            return;
          }

          mutation.mutate({
            endpoint: '/rental/commands/add-owner-and-property',
            body: {
              ownerName: String(form.get('ownerName') ?? '').trim(),
              ownerPhone: String(form.get('ownerPhone') ?? '').trim(),
              ...sharedProperty,
              serviceIntent,
              ...(isSale ? { askingPrice: wholeRent } : { monthlyRent: wholeRent || '0' }),
              ...(serviceIntent === 'FULL_MANAGEMENT'
                ? {
                    managementFeePercent: String(form.get('managementFeePercent') ?? '').trim(),
                    effectiveFrom: String(form.get('effectiveFrom') ?? '').trim(),
                  }
                : {}),
              ...(baseDescription ? { description: baseDescription } : {}),
            },
          });
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <BranchField principal={principal} value={branchId} onChange={setBranchId} />
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Owner</legend>
            <ChoiceGroup>
              <ChoiceOption
                name="ownerMode"
                value="existing"
                selected={ownerMode === 'existing'}
                onSelect={() => setOwnerMode('existing')}
                label="Existing owner"
              />
              <ChoiceOption
                name="ownerMode"
                value="new"
                selected={ownerMode === 'new'}
                onSelect={() => {
                  setOwnerMode('new');
                  setOwnerPartyId('');
                }}
                label="New owner"
              />
            </ChoiceGroup>
            {ownerMode === 'existing' ? (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Select owner
                <select
                  name="ownerPartyId"
                  required
                  className={inputClass}
                  value={ownerPartyId}
                  onChange={(event) => setOwnerPartyId(event.target.value)}
                  autoFocus
                >
                  <option value="">
                    {owners.isLoading
                      ? 'Loading owners…'
                      : (owners.data?.items ?? []).length
                        ? 'Select owner'
                        : 'No owners yet — switch to New owner'}
                  </option>
                  {(owners.data?.items ?? []).map((owner) => (
                    <option key={owner.partyId} value={owner.partyId}>
                      {owner.party.displayName} — {owner.ownerNumber}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Name
                  <input name="ownerName" required minLength={2} className={inputClass} autoFocus />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Phone number
                  <input name="ownerPhone" required minLength={5} className={inputClass} />
                </label>
              </>
            )}
          </fieldset>
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Property</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Service intent
                <select
                  className={inputClass}
                  value={serviceIntent}
                  onChange={(event) => {
                    const next = event.target.value as PropertyServiceIntent;
                    setServiceIntent(next);
                    if (next === 'SALE' || next === 'CONSTRUCTION') setHasMultipleUnits(false);
                    else if (MULTI_UNIT_TYPES.has(propertyType)) setHasMultipleUnits(true);
                  }}
                >
                  <option value="RENTAL_BROKERAGE">Rental brokerage</option>
                  <option value="FULL_MANAGEMENT">Full management</option>
                  <option value="SALE">Sale</option>
                  <option value="CONSTRUCTION">Construction</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Property type
                <select
                  name="propertyType"
                  required
                  className={inputClass}
                  value={propertyType}
                  onChange={(event) => applyPropertyType(event.target.value)}
                >
                  <option value="HOUSE">House</option>
                  <option value="VILLA">Villa</option>
                  <option value="APARTMENT_BUILDING">Apartment building</option>
                  <option value="COMMERCIAL_BUILDING">Commercial building</option>
                  <option value="LAND">Land</option>
                  <option value="COMPOUND">Compound</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Property name
              <input name="name" required className={inputClass} />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Location
              <input name="location" required className={inputClass} placeholder="Hodan" />
            </label>
            {isSale ? (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Asking price
                <input
                  name="askingPrice"
                  required
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="85000"
                />
              </label>
            ) : null}
            {supportsUnits ? (
              <fieldset className="space-y-3 rounded-lg border border-slate-100 p-3">
                <legend className="px-1 text-sm font-semibold text-slate-700">Rental structure</legend>
                <ChoiceGroup>
                  <ChoiceOption
                    name="unitMode"
                    value="whole"
                    selected={!hasMultipleUnits}
                    onSelect={() => setHasMultipleUnits(false)}
                    label="Whole property as one unit"
                  />
                  <ChoiceOption
                    name="unitMode"
                    value="multiple"
                    selected={hasMultipleUnits}
                    onSelect={() => {
                      setHasMultipleUnits(true);
                      if (units.length < 2) setUnits([createEmptyUnit(1), createEmptyUnit(2)]);
                    }}
                    label="Multiple rental units"
                  />
                </ChoiceGroup>
                {hasMultipleUnits ? (
                  <div className="border-t border-slate-100 pt-3">
                    <RentalUnitsEditor units={units} onChange={setUnits} unitLabel={unitLabel} />
                  </div>
                ) : (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <RentalUnitsEditor
                      units={[singleUnit]}
                      onChange={(next) => setSingleUnit(next[0] ?? createEmptyUnit(1))}
                      unitLabel="Unit"
                      allowBulk={false}
                      allowAdd={false}
                    />
                  </div>
                )}
              </fieldset>
            ) : !isSale && serviceIntent !== 'CONSTRUCTION' && isLand ? (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Asking rent (monthly)
                <input
                  name="monthlyRent"
                  required
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="300"
                />
              </label>
            ) : null}
            {serviceIntent === 'FULL_MANAGEMENT' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Management fee (%)
                  <input
                    name="managementFeePercent"
                    required
                    inputMode="decimal"
                    className={inputClass}
                    placeholder="10"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Service start date
                  <input
                    name="effectiveFrom"
                    type="date"
                    required
                    className={inputClass}
                  />
                </label>
              </div>
            ) : null}
          </fieldset>
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowMore((current) => !current)}
          >
            {showMore ? 'Hide details' : '+ More details'}
          </button>
          {showMore ? (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              {isLand ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Width
                    <input name="landWidth" inputMode="decimal" className={inputClass} />
                  </label>
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Length
                    <input name="landLength" inputMode="decimal" className={inputClass} />
                  </label>
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Total area
                    <input name="area" inputMode="decimal" className={inputClass} />
                  </label>
                </div>
              ) : !hasMultipleUnits ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Bedrooms
                    <input name="bedrooms" inputMode="numeric" className={inputClass} />
                  </label>
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Bathrooms
                    <input name="bathrooms" inputMode="decimal" className={inputClass} />
                  </label>
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Area
                    <input name="area" inputMode="decimal" className={inputClass} />
                  </label>
                </div>
              ) : null}
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                District
                <input name="district" className={inputClass} />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Detailed address
                <input name="addressLine1" className={inputClass} />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Description / amenities
                <textarea name="description" rows={3} className={inputClass} />
              </label>
            </div>
          ) : null}
        </fieldset>
      </form>
    </WorkspaceFormDrawer>
  );
}

export function AddRentalCustomerDrawer({
  open,
  onClose,
  onCreated,
  principal,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  principal: Principal;
}) {
  const formId = useId();
  const [branchId, setBranchId] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [locations, setLocations] = useState(['']);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ leadId: string }>('/rental/commands/add-rental-customer', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Rental customer saved.');
      onCreated();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  function resetLocal() {
    setBranchId('');
    setShowMore(false);
    setLocations(['']);
  }

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Rental"
      title="Add Rental Customer"
      description="Register someone looking for a rental. Preferred locations can include more than one area."
      onClose={() => {
        if (!mutation.isPending) {
          resetLocal();
          onClose();
        }
      }}
      size="md"
      footer={
        <WorkspaceFormDrawerFooter
          formId={formId}
          onCancel={() => {
            resetLocal();
            onClose();
          }}
          submitLabel="Save Customer"
          isPending={mutation.isPending}
        />
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const preferredLocations = locations.map((value) => value.trim()).filter(Boolean);
          mutation.mutate({
            name: String(form.get('name') ?? '').trim(),
            phone: String(form.get('phone') ?? '').trim(),
            propertyTypeWanted: String(form.get('propertyTypeWanted') ?? '').trim(),
            preferredLocations,
            minRentBudget: String(form.get('minRentBudget') ?? '').trim(),
            maxRentBudget: String(form.get('maxRentBudget') ?? '').trim(),
            ...(branchId ? { branchId } : {}),
            ...(showMore
              ? {
                  ...(String(form.get('email') ?? '').trim()
                    ? { email: String(form.get('email') ?? '').trim() }
                    : {}),
                  ...(String(form.get('minBedrooms') ?? '').trim()
                    ? { minBedrooms: String(form.get('minBedrooms') ?? '').trim() }
                    : {}),
                  ...(String(form.get('minBathrooms') ?? '').trim()
                    ? { minBathrooms: String(form.get('minBathrooms') ?? '').trim() }
                    : {}),
                  ...(String(form.get('minArea') ?? '').trim()
                    ? { minArea: String(form.get('minArea') ?? '').trim() }
                    : {}),
                  ...(String(form.get('notes') ?? '').trim()
                    ? { notes: String(form.get('notes') ?? '').trim() }
                    : {}),
                }
              : {}),
          });
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <BranchField principal={principal} value={branchId} onChange={setBranchId} />
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Name
            <input name="name" required className={inputClass} placeholder="Ahmed Ali" autoFocus />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Phone number
            <input name="phone" required minLength={5} className={inputClass} placeholder="+25261..." />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Property type wanted
            <select name="propertyTypeWanted" required className={inputClass} defaultValue="Apartment">
              <option value="Apartment">Apartment</option>
              <option value="House">House</option>
              <option value="Villa">Villa</option>
              <option value="Commercial">Commercial</option>
              <option value="Land">Land</option>
              <option value="Room">Room</option>
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700">Preferred locations</legend>
            {locations.map((location, index) => (
              <input
                key={index}
                className={inputClass}
                value={location}
                required={index === 0}
                placeholder={index === 0 ? 'Hodan' : 'Another area'}
                onChange={(event) => {
                  const next = [...locations];
                  next[index] = event.target.value;
                  setLocations(next);
                }}
              />
            ))}
            <button
              type="button"
              className="button secondary"
              onClick={() => setLocations((current) => [...current, ''])}
            >
              + Add location
            </button>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Rent budget min
              <input
                name="minRentBudget"
                required
                inputMode="decimal"
                className={inputClass}
                placeholder="200"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Rent budget max
              <input
                name="maxRentBudget"
                required
                inputMode="decimal"
                className={inputClass}
                placeholder="400"
              />
            </label>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowMore((current) => !current)}
          >
            {showMore ? 'Hide more preferences' : '+ More preferences'}
          </button>
          {showMore ? (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Email
                <input name="email" type="email" className={inputClass} />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Bedrooms
                  <input name="minBedrooms" inputMode="numeric" className={inputClass} />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Bathrooms
                  <input name="minBathrooms" inputMode="decimal" className={inputClass} />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Area (optional)
                  <input name="minArea" inputMode="decimal" className={inputClass} placeholder="e.g. 130" />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Notes
                <textarea name="notes" rows={2} className={inputClass} />
              </label>
            </div>
          ) : null}
        </fieldset>
      </form>
    </WorkspaceFormDrawer>
  );
}
