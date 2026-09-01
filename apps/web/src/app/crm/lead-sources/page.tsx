import { Suspense } from 'react';
import { WorkspaceLoading } from '@/components/shared/ui';
import { LeadSourcesWorkspace } from '@/features/crm/lead-sources-workspace';

export default function LeadSourcesPage() {
  return (
    <Suspense fallback={<WorkspaceLoading label="Loading Lead Sources" />}>
      <LeadSourcesWorkspace />
    </Suspense>
  );
}
