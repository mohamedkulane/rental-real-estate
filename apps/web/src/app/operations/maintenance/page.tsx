import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { OperationsRegister } from '@/features/operations/operations-register';

export default function MaintenanceRegisterPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OperationsRegister mode="maintenance" />
    </Suspense>
  );
}
