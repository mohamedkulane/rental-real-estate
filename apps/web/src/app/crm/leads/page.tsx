import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { LeadRegister } from '@/features/crm/lead-register';

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadRegister />
    </Suspense>
  );
}
