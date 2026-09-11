import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { FinanceRegister } from '@/features/finance/finance-register';

export default function OwnerStatementsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FinanceRegister mode="owner-statements" />
    </Suspense>
  );
}
