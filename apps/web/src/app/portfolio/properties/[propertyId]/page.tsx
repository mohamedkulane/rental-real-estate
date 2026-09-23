import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { PropertyDetailWorkspace } from '@/features/portfolio/property-detail-workspace';

export default function PropertyDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PropertyDetailWorkspace />
    </Suspense>
  );
}
