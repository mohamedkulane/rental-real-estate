import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { FullManagementDashboard } from '@/features/commercial/full-management-dashboard';

export default function FullManagementPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FullManagementDashboard />
    </Suspense>
  );
}
