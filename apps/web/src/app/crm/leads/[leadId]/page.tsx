import { LeadDetailWorkspace } from '@/features/crm/lead-detail';

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadDetailWorkspace leadId={leadId} />;
}
