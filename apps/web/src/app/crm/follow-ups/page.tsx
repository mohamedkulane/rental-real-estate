import { Suspense } from 'react';
import { WorkspaceLoading } from '@/components/shared/ui';
import { FollowUpsWorkspace } from '@/features/crm/follow-ups-workspace';

export default function FollowUpsPage() {
  return (
    <Suspense fallback={<WorkspaceLoading label="Loading Follow-ups" />}>
      <FollowUpsWorkspace />
    </Suspense>
  );
}
