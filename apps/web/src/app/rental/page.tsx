import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { RentalOverview } from '@/features/rental/rental-overview';

export default function RentalPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RentalOverview />
    </Suspense>
  );
}
