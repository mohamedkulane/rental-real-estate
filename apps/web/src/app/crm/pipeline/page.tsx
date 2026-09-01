import { Suspense } from 'react';
import { WorkspaceLoading } from '@/components/shared/ui';
import { PipelineWorkspace } from '@/features/crm/pipeline-workspace';

export default function PipelinePage() {
  return (
    <Suspense fallback={<WorkspaceLoading label="Loading CRM Pipeline" />}>
      <PipelineWorkspace />
    </Suspense>
  );
}
