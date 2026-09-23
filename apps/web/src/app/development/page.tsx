import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { DevelopmentWorkspace } from '@/features/construction/development-workspace';

export default function DevelopmentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DevelopmentWorkspace />
    </Suspense>
  );
}
