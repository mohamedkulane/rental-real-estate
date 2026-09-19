import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { CreateRentalLeaseForm } from '@/features/rental/rental-lease-form';

export default function CreateRentalLeasePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CreateRentalLeaseForm />
    </Suspense>
  );
}
