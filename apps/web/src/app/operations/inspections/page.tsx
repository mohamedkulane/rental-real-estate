import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { OperationsRegister } from '@/features/operations/operations-register';

export default function InspectionRegisterPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OperationsRegister mode="inspections" />
    </Suspense>
  );
}
