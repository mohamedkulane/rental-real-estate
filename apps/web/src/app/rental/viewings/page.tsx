import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { RentalViewingsRegister } from '@/features/rental/rental-viewings';

export default function RentalViewingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RentalViewingsRegister />
    </Suspense>
  );
}
