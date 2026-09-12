import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { OwnerStatementDetail } from '@/features/portals/owner-portal';

export default async function OwnerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OwnerStatementDetail statementId={id} />
    </Suspense>
  );
}
