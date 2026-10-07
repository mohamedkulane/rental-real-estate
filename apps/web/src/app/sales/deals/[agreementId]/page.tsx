import { SalesDealDetailWorkspace } from '@/features/rental/sales-deal-detail-workspace';

export default async function SalesDealDetailPage({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;
  return <SalesDealDetailWorkspace agreementId={agreementId} />;
}
