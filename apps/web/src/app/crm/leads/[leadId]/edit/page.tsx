import { LeadEditorWorkspace } from '@/features/crm/lead-editor';
export default async function EditLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadEditorWorkspace leadId={leadId} />;
}
