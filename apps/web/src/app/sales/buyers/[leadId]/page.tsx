import { BuyerDetailWorkspace } from '@/features/rental/sales-buyers';

export default async function SalesBuyerDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <BuyerDetailWorkspace leadId={leadId} />;
}
