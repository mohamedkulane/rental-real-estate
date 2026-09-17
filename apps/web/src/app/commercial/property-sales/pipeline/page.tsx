import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { PropertySalesPipeline } from '@/features/commercial/property-sales-pipeline';

export default function PropertySalesPipelinePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PropertySalesPipeline />
    </Suspense>
  );
}
