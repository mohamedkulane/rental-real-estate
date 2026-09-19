import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { BuyerRegister } from '@/features/rental/sales-buyers';

export default function SalesBuyersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BuyerRegister />
    </Suspense>
  );
}
