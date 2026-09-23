import { LeaseDetailWorkspace } from '@/features/leasing/lease-detail-workspace';

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeaseDetailWorkspace leaseId={id} />;
}
