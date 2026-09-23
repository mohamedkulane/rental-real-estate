import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { SalesOverview } from '@/features/rental/sales-overview';

export default function SalesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SalesOverview />
    </Suspense>
  );
}
