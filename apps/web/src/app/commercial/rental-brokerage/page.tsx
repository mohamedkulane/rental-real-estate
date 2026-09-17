import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { RentalBrokerageDashboard } from '@/features/commercial/commercial-service-dashboard';

export default function RentalBrokeragePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RentalBrokerageDashboard />
    </Suspense>
  );
}
