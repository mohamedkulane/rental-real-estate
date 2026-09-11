import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { PipelineWorkspace } from '@/features/crm/pipeline-workspace';

export default function PipelinePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PipelineWorkspace />
    </Suspense>
  );
}
