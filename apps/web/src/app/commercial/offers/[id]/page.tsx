import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { OfferDetail } from '@/features/commercial/offer-detail';

export default function OfferDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OfferDetail />
    </Suspense>
  );
}
