import { EngagementDetail } from '@/features/commercial/engagement-detail';

export default async function ServiceEngagementDetailPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = await params;
  return <EngagementDetail engagementId={engagementId} />;
}
