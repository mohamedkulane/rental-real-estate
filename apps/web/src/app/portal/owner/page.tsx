import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { OwnerPortal } from '@/features/portals/owner-portal';

export default function OwnerPortalPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OwnerPortal />
    </Suspense>
  );
}
