import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { OperationsOverview } from '@/features/operations/operations-overview';

export default function OperationsOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OperationsOverview />
    </Suspense>
  );
}
