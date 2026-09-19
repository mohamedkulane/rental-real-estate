import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { RentalCustomerRegister } from '@/features/rental/rental-workspaces';

export default function RentalCustomersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RentalCustomerRegister />
    </Suspense>
  );
}
