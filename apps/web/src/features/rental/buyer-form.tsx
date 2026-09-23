'use client';

import { useMutation } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import toast from '@/lib/toast';
import { LocationMultiSelect } from '@/components/shared/location-multi-select';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { api, userFacingError } from '@/lib/phase3-api';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

export function BuyerCreateFields({
  formId,
  onSubmitBody,
  isPending,
}: {
  formId: string;
  onSubmitBody: (body: Record<string, unknown>) => void;
  isPending?: boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [propertyTypeWanted, setPropertyTypeWanted] = useState('House');
  const isLand = propertyTypeWanted === 'Land';

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!locations.length) {
          toast.error('Add at least one preferred location.');
          return;
        }
        const form = new FormData(event.currentTarget);
        onSubmitBody({
          name: String(form.get('name') ?? '').trim(),
          phone: String(form.get('phone') ?? '').trim(),
          propertyTypeWanted,
          preferredLocations: locations,
          minPurchaseBudget: String(form.get('minPurchaseBudget') ?? '').trim(),
          maxPurchaseBudget: String(form.get('maxPurchaseBudget') ?? '').trim(),
          ...(showMore
            ? {
                ...(isLand
                  ? {
                      landWidth: String(form.get('landWidth') ?? '').trim() || undefined,
                      landLength: String(form.get('landLength') ?? '').trim() || undefined,
                      minArea: String(form.get('minArea') ?? '').trim() || undefined,
                    }
                  : {
                      minBedrooms: String(form.get('minBedrooms') ?? '').trim() || undefined,
                      minBathrooms: String(form.get('minBathrooms') ?? '').trim() || undefined,
                      minArea: String(form.get('minArea') ?? '').trim() || undefined,
                    }),
                notes: String(form.get('notes') ?? '').trim() || undefined,
              }
            : {}),
        });
      }}
    >
      <fieldset disabled={isPending} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Name
          <input name="name" required minLength={2} className={inputClass} autoFocus />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Phone number
          <input name="phone" required minLength={5} className={inputClass} />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Property type wanted
          <select
            className={inputClass}
            value={propertyTypeWanted}
            onChange={(event) => setPropertyTypeWanted(event.target.value)}
          >
            <option value="House">House</option>
            <option value="Apartment">Apartment</option>
            <option value="Villa">Villa</option>
            <option value="Land">Land</option>
            <option value="Commercial">Commercial</option>
          </select>
        </label>
        <LocationMultiSelect
          value={locations}
          onChange={setLocations}
          required
          label="Preferred locations"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Minimum purchase budget
            <input name="minPurchaseBudget" required inputMode="decimal" className={inputClass} />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Maximum purchase budget
            <input name="maxPurchaseBudget" required inputMode="decimal" className={inputClass} />
          </label>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() => setShowMore((current) => !current)}
        >
          {showMore ? 'Hide more preferences' : '+ More Preferences'}
        </button>
        {showMore ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            {isLand ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Minimum width
                  <input name="landWidth" inputMode="decimal" className={inputClass} />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Minimum length
                  <input name="landLength" inputMode="decimal" className={inputClass} />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Minimum area
                  <input name="minArea" inputMode="decimal" className={inputClass} />
                </label>
              </div>
            ) : (
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
                  Minimum area
                  <input name="minArea" inputMode="decimal" className={inputClass} />
                </label>
              </div>
            )}
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Notes
              <textarea name="notes" rows={2} className={inputClass} />
            </label>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

export function AddBuyerDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const formId = useId();
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ leadId: string }>('/rental/commands/add-buyer', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Buyer saved.');
      onCreated();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Sales"
      title="Add Buyer"
      description="Register someone looking to buy. Preferred locations can include more than one area."
      onClose={onClose}
      size="md"
      footer={
        <WorkspaceFormDrawerFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Save Buyer"
          isPending={mutation.isPending}
        />
      }
    >
      <BuyerCreateFields
        formId={formId}
        isPending={mutation.isPending}
        onSubmitBody={(body) => mutation.mutate(body)}
      />
    </WorkspaceFormDrawer>
  );
}
