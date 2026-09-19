import { RentalCustomerDetailWorkspace } from '@/features/rental/rental-detail-workspaces';

export default async function RentalCustomerDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <RentalCustomerDetailWorkspace leadId={leadId} />;
}
