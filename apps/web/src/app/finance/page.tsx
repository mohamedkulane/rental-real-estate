import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { FinanceOverview } from '@/features/finance/finance-overview';

export default function FinancePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FinanceOverview />
    </Suspense>
  );
}
