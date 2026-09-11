import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { CommercialRegister } from '@/features/commercial/commercial-register';

export default function RentalBrokeragePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CommercialRegister mode="brokerage-deals" />
    </Suspense>
  );
}
