import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { RentalPropertyRegister } from '@/features/rental/rental-workspaces';

/** Simplified rental property register (owner + property create in drawer). */
export default function RentalPropertiesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RentalPropertyRegister />
    </Suspense>
  );
}
