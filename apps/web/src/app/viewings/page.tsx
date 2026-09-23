import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { CentralViewingsWorkspace } from '@/features/rental/rental-viewings';

export default function ViewingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CentralViewingsWorkspace />
    </Suspense>
  );
}
