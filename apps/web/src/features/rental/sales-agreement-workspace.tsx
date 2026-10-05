'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ErrorState, PageHeader } from '@/components/shared/ui';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import toast from '@/lib/toast';

export function SalesAgreementWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const { principal } = useCommercialPrincipal();
  const [finalPrice, setFinalPrice] = useState('');
  const [sellerCommission, setSellerCommission] = useState('');
  const [buyerCommission, setBuyerCommission] = useState('');
  const [sellerCommissionMethod, setSellerCommissionMethod] = useState<'FIXED' | 'PERCENT'>(
    'PERCENT',
  );
  const [buyerCommissionMethod, setBuyerCommissionMethod] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [notes, setNotes] = useState('');
  const canManage = Boolean(principal && hasPermission(principal, 'sale-offer.manage'));
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/rental/commands/sale-agreements', {
        method: 'POST',
        body: JSON.stringify({
          viewingId: params.get('viewingId'),
          leadId: params.get('leadId'),
          propertyId: params.get('propertyId'),
          finalSalePrice: finalPrice,
          sellerCommission: sellerCommission
            ? { method: sellerCommissionMethod, value: sellerCommission }
            : undefined,
          buyerCommission: buyerCommission
            ? { method: buyerCommissionMethod, value: buyerCommission }
            : undefined,
          notes: notes.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success('Sale agreement created.');
      router.push('/sales/deals');
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <CommercialShell principal={principal} activeItem="sales:deals">
      <PageHeader
        eyebrow="Sales"
        title="Create Sale Agreement"
        description="Negotiated terms from an interested completed viewing."
        action={
          <Link className="button secondary" href="/sales/deals">
            Back to deals
          </Link>
        }
      />
      {!canManage ? (
        <ErrorState message="Sale agreement creation requires sale-offer.manage permission." />
      ) : !params.get('viewingId') || !params.get('leadId') || !params.get('propertyId') ? (
        <ErrorState message="Open this form from an interested viewing so buyer, property, and viewing context are preserved." />
      ) : (
        <form
          className="mt-6 grid max-w-2xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (Number(finalPrice) <= 0) {
              toast.error('Enter a final sale price.');
              return;
            }
            create.mutate();
          }}
        >
          <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-3">
            <div>
              <span className="block text-xs text-slate-500">Buyer</span>Inherited from viewing
            </div>
            <div>
              <span className="block text-xs text-slate-500">Property</span>Inherited from viewing
            </div>
            <div>
              <span className="block text-xs text-slate-500">Viewing</span>Interested viewing
            </div>
          </div>
          <label className="text-sm font-semibold text-slate-700">
            Final sale price
            <input
              className="input mt-1 w-full"
              type="number"
              min="0"
              step="0.01"
              value={finalPrice}
              onChange={(event) => setFinalPrice(event.target.value)}
              required
            />
          </label>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_150px]">
            <legend className="px-1 text-sm font-semibold text-slate-800">
              Seller commission{' '}
              <span className="font-normal text-slate-500">required for an external owner</span>
            </legend>
            <label className="text-sm font-semibold text-slate-700">
              Value
              <input
                className="input mt-1 w-full"
                type="number"
                min="0"
                max={sellerCommissionMethod === 'PERCENT' ? '100' : undefined}
                step="0.01"
                value={sellerCommission}
                onChange={(event) => setSellerCommission(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Method
              <select
                className="input mt-1 w-full"
                value={sellerCommissionMethod}
                onChange={(event) =>
                  setSellerCommissionMethod(event.target.value as 'FIXED' | 'PERCENT')
                }
              >
                <option value="PERCENT">Percent of final price</option>
                <option value="FIXED">Fixed USD</option>
              </select>
            </label>
            {sellerCommission ? (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Settlement will retain{' '}
                {sellerCommissionMethod === 'PERCENT'
                  ? `USD ${((Number(finalPrice || 0) * Number(sellerCommission)) / 100).toFixed(2)} (${sellerCommission}%)`
                  : `USD ${Number(sellerCommission).toFixed(2)}`}{' '}
                from seller proceeds.
              </p>
            ) : null}
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_150px]">
            <legend className="px-1 text-sm font-semibold text-slate-800">
              Buyer commission <span className="font-normal text-slate-500">optional</span>
            </legend>
            <label className="text-sm font-semibold text-slate-700">
              Value
              <input
                className="input mt-1 w-full"
                type="number"
                min="0"
                max={buyerCommissionMethod === 'PERCENT' ? '100' : undefined}
                step="0.01"
                value={buyerCommission}
                onChange={(event) => setBuyerCommission(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Method
              <select
                className="input mt-1 w-full"
                value={buyerCommissionMethod}
                onChange={(event) =>
                  setBuyerCommissionMethod(event.target.value as 'FIXED' | 'PERCENT')
                }
              >
                <option value="FIXED">Fixed USD</option>
                <option value="PERCENT">Percent of final price</option>
              </select>
            </label>
            {buyerCommission ? (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Buyer commission recorded at settlement:{' '}
                {buyerCommissionMethod === 'PERCENT'
                  ? `USD ${((Number(finalPrice || 0) * Number(buyerCommission)) / 100).toFixed(2)} (${buyerCommission}%)`
                  : `USD ${Number(buyerCommission).toFixed(2)}`}
                .
              </p>
            ) : null}
          </fieldset>
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            Commission is agreed here and carried into settlement automatically. Staff do not
            re-enter it on the settlement page.
          </p>
          <label className="text-sm font-semibold text-slate-700">
            Notes
            <textarea
              className="input mt-1 w-full"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <button className="button primary" type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving...' : 'Create Agreement'}
            </button>
          </div>
        </form>
      )}
    </CommercialShell>
  );
}
