import { Suspense } from 'react';
import { WorkspaceLoading } from '@/components/shared/ui';
import { LeadRegister } from '@/features/crm/lead-register';

export default function LeadsPage() {
  return (
    <Suspense fallback={<WorkspaceLoading label="Loading Lead Register" />}>
      <LeadRegister />
    </Suspense>
  );
}
