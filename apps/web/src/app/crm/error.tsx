'use client';

import { ErrorState } from '@/components/shared/ui';

export default function CrmError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <ErrorState
        message="The CRM workspace encountered an unexpected problem. Refresh and review the current record before repeating a change."
        onRetry={retry}
      />
    </main>
  );
}
