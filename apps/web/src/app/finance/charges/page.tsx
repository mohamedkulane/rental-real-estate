import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { FinanceRegister } from '@/features/finance/finance-register';

export default function ChargesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FinanceRegister mode="charges" />
    </Suspense>
  );
}
