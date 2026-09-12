import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { TenantPortal } from '@/features/portals/tenant-portal';

export default function TenantPortalPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TenantPortal />
    </Suspense>
  );
}
