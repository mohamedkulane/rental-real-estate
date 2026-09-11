'use client';

import { ErrorState } from '@/components/shared/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="workspace">
      <ErrorState message="Service Engagements could not be displayed." onRetry={reset} />
    </main>
  );
}
