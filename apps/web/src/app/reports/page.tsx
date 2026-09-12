import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { ReportsWorkspace } from '@/features/reports/reports-workspace';

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsWorkspace />
    </Suspense>
  );
}
