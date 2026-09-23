'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import toast from '@/lib/toast';
import { PageHeader } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { RentalShell, useRentalPrincipal } from './rental-shell';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15';

type CustomerOption = {
  id: string;
  displayName: string;
  leadNumber: string;
  minRentBudget: string | null;
  maxRentBudget: string | null;
  currency: string;
};

type PropertyOption = {
  id: string;
  propertyCode: string;
  name: string;
  monthlyRent: string | null;
  currency: string;
  rentalStatus: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nextYearIso() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export function CreateRentalLeaseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { principal, error } = useRentalPrincipal();
  const [leadId, setLeadId] = useState(params.get('leadId') ?? '');
  const [propertyId, setPropertyId] = useState(params.get('propertyId') ?? '');
  const [rent, setRent] = useState(params.get('rent') ?? '');

  const customers = useQuery({
    queryKey: ['rental-customers-options'],
    enabled: Boolean(principal),
    queryFn: () => api<CursorPage<CustomerOption>>('/rental/customers?limit=50'),
  });
  const properties = useQuery({
    queryKey: ['rental-properties-options'],
    enabled: Boolean(principal),
    queryFn: () => api<CursorPage<PropertyOption>>('/rental/properties?limit=50'),
  });

  const selectedProperty = useMemo(
    () => properties.data?.items.find((item) => item.id === propertyId),
    [properties.data, propertyId],
  );

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ leaseId: string }>('/rental/commands/create-lease', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      toast.success('Lease contract created.');
      router.push(`/leasing/leases/${result.leaseId}`);
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  if (!principal) {
    return (
      <RentalShell principal={null} principalError={error} activeItem="leases">
        <TableSkeleton columns={1} />
      </RentalShell>
    );
  }

  const canCreate = hasPermission(principal, 'lease.create');

  return (
    <RentalShell principal={principal} principalError={error} activeItem="leases">
      <PageHeader
        eyebrow="Rental"
        title="Create Lease Contract"
        description="Lease is last. Finish Viewing → agree rent → company fee on the customer match page first."
      />
      <section className="mx-auto mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!canCreate ? (
          <p className="text-sm text-slate-600">You do not have permission to create a lease.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              mutation.mutate({
                leadId,
                propertyId,
                monthlyRent: String(form.get('monthlyRent') ?? '').trim(),
                leaseStartDate: String(form.get('leaseStartDate') ?? '').trim(),
                leaseEndDate: String(form.get('leaseEndDate') ?? '').trim(),
              });
            }}
          >
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Rental customer
              <select
                required
                className={inputClass}
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
              >
                <option value="">Choose customer</option>
                {(customers.data?.items ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName} ({customer.leadNumber})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Property
              <select
                required
                className={inputClass}
                value={propertyId}
                onChange={(event) => {
                  const next = event.target.value;
                  setPropertyId(next);
                  const match = properties.data?.items.find((item) => item.id === next);
                  if (match?.monthlyRent) setRent(match.monthlyRent);
                }}
              >
                <option value="">Choose property</option>
                {(properties.data?.items ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.propertyCode} — {property.name} ({humanize(property.rentalStatus)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Monthly rent
              <input
                name="monthlyRent"
                required
                inputMode="decimal"
                className={inputClass}
                value={rent}
                onChange={(event) => setRent(event.target.value)}
                placeholder={selectedProperty?.monthlyRent ?? '300'}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Lease start
                <input
                  name="leaseStartDate"
                  type="date"
                  required
                  className={inputClass}
                  defaultValue={todayIso()}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Lease end
                <input
                  name="leaseEndDate"
                  type="date"
                  required
                  className={inputClass}
                  defaultValue={nextYearIso()}
                />
              </label>
            </div>
            <button className="button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Create Lease'}
            </button>
          </form>
        )}
      </section>
    </RentalShell>
  );
}
