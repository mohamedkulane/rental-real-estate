import { Suspense } from 'react';
import { WorkspaceLoading } from '@/components/shared/ui';
import { EngagementRegister } from '@/features/commercial/engagement-register';

export default function ServiceEngagementsPage() {
  return (
    <Suspense fallback={<WorkspaceLoading label="Loading Service Engagement Register" />}>
      <EngagementRegister />
    </Suspense>
  );
}
