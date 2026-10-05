'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent } from 'react';
import toast from '@/lib/toast';
import { PageHeader } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { RentalShell, useRentalPrincipal } from './rental-shell';

export function CreateRentalLeaseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { principal, error } = useRentalPrincipal();
  const agreementId = params.get('agreementId');

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
        description="Lease is last. It inherits the customer, property, rent, and dates from a confirmed agreement."
      />
      <section className="mx-auto mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!canCreate ? (
          <p className="text-sm text-slate-600">You do not have permission to create a lease.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              mutation.mutate({ agreementId });
            }}
          >
            {agreementId ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <p className="font-semibold">Confirmed rental agreement</p>
                <p className="mt-1 text-emerald-800">Lease terms, customer, property, rent, and dates will be inherited from the confirmed agreement.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Start from a rental customer, complete a viewing, and confirm the agreement before creating a lease.
              </div>
            )}
            {agreementId ? (
              <button className="button" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Create Lease from Agreement'}
              </button>
            ) : null}
          </form>
        )}
      </section>
    </RentalShell>
  );
}
