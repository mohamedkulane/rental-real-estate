import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { LeadSourcesWorkspace } from '@/features/crm/lead-sources-workspace';

export default function LeadSourcesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadSourcesWorkspace />
    </Suspense>
  );
}
