import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { ConstructionWorkspace } from '@/features/construction/construction-workspace';

export default function ConstructionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ConstructionWorkspace />
    </Suspense>
  );
}
