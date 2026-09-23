import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/loading-system';
import { LeadRegister } from '@/features/crm/lead-register';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const params = await searchParams;
  const intent = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  if (!intent || intent === 'RENT') {
    redirect('/rental/customers');
  }
  if (intent === 'BUY') {
    redirect('/sales/buyers');
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadRegister />
    </Suspense>
  );
}
