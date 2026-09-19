import { redirect } from 'next/navigation';
import { LeadEditorWorkspace } from '@/features/crm/lead-editor';

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const params = await searchParams;
  const intent = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  if (!intent || intent === 'RENT') {
    redirect('/rental/customers?create=1');
  }
  if (intent === 'BUY') {
    redirect('/sales/buyers?create=1');
  }
  return <LeadEditorWorkspace />;
}
