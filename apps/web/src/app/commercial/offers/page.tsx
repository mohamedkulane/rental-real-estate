import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { CommercialRegister } from '@/features/commercial/commercial-register';

export default function OffersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CommercialRegister mode="sale-offers" />
    </Suspense>
  );
}
