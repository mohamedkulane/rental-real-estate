import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { EngagementRegister } from '@/features/commercial/engagement-register';

export default function ServiceEngagementsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EngagementRegister />
    </Suspense>
  );
}
