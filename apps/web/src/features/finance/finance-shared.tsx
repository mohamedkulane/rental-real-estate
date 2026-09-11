'use client';

import { EmptyState } from '@/components/shared/ui';

export function FinanceAccessDenied({
  description = 'Your current access does not include this Finance workspace.',
}: {
  description?: string;
}) {
  return (
    <EmptyState
      title="Access restricted"
      description={description}
    />
  );
}
