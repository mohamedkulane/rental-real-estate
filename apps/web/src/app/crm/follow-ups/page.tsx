import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { FollowUpsWorkspace } from '@/features/crm/follow-ups-workspace';

export default function FollowUpsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FollowUpsWorkspace />
    </Suspense>
  );
}
