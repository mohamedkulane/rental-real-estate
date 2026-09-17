'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { PageHeader } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import type { PickRecord } from '@/features/workflow/record-picker';
import {
  FinanceFormPanel,
  FinanceRecordSelect,
  FinanceTextArea,
  FinanceTextField,
  financePickerMap,
} from '@/features/finance/finance-forms';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

export function SaleOfferCreateWorkspace() {
  const router = useRouter();
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'sale-offer.manage'));
  const [engagement, setEngagement] = useState<PickRecord | null>(null);
  const [property, setProperty] = useState<PickRecord | null>(null);
  const [buyer, setBuyer] = useState<PickRecord | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [offerDate, setOfferDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState('');
  const [termsNotes, setTermsNotes] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/sale-offers', {
        method: 'POST',
        body: JSON.stringify({
          serviceEngagementId: engagement?.id,
          propertyId: property?.id,
          buyerPartyId: buyer?.id || undefined,
          offerAmount,
          currency,
          offerDate,
          expiresAt: expiresAt || undefined,
          termsNotes: termsNotes || undefined,
        }),
      }),
    onSuccess: (offer: { id: string }) => {
      toast.success('Sale offer created.');
      router.push(`/commercial/offers/${offer.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <CommercialShell principal={principal} activeItem="commercial:offers">
      <PageHeader
        eyebrow="Commercial"
        title="Create Sale Offer"
        description="Draft a buyer offer against an authorized property sale engagement."
        action={
          <Link className="button secondary" href="/commercial/offers">
            Back to offers
          </Link>
        }
      />
      {principal && !allowed ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-[14px] text-slate-600">
          Sale offer creation requires sale-offer.manage permission.
        </p>
      ) : (
        <FinanceFormPanel
          title="Offer details"
          submitLabel="Save offer"
          busy={create.isPending}
          disabled={!engagement?.id || !property?.id || Number(offerAmount) <= 0}
          onSubmit={() => {
            if (!engagement?.id || !property?.id || Number(offerAmount) <= 0) {
              toast.error('Choose a sale engagement, property, and offer amount.');
              return;
            }
            create.mutate();
          }}
        >
          <FinanceRecordSelect
            label="Sale engagement"
            path="/service-engagements?status=ACTIVE&serviceModel=SALE_BROKERAGE"
            value={engagement?.id ?? ''}
            map={financePickerMap.engagement}
            onChange={setEngagement}
            required
            emptyHint="No active sale brokerage engagement. Complete that commercial service workflow before drafting offers."
          />
          <FinanceRecordSelect
            label="Property"
            path="/properties?status=ACTIVE"
            value={property?.id ?? ''}
            map={financePickerMap.property}
            onChange={setProperty}
            required
          />
          <FinanceRecordSelect
            label="Buyer"
            path="/parties"
            value={buyer?.id ?? ''}
            map={financePickerMap.party}
            onChange={setBuyer}
          />
          <FinanceTextField
            label="Offer amount"
            type="number"
            min={0}
            step="0.01"
            value={offerAmount}
            onChange={setOfferAmount}
            required
          />
          <FinanceTextField
            label="Currency"
            value={currency}
            onChange={(value) => setCurrency(value.toUpperCase())}
            maxLength={3}
            required
          />
          <FinanceTextField label="Offer date" type="date" value={offerDate} onChange={setOfferDate} required />
          <FinanceTextField label="Expires" type="date" value={expiresAt} onChange={setExpiresAt} />
          <FinanceTextArea label="Terms notes" value={termsNotes} onChange={setTermsNotes} />
        </FinanceFormPanel>
      )}
    </CommercialShell>
  );
}
