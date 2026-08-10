'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="workspace-preparation">
      <section className="preparation-panel error-panel" role="alert">
        <span className="state-icon">
          <AlertCircle aria-hidden="true" />
        </span>
        <div className="preparation-copy">
          <p className="eyebrow">Secure workspace</p>
          <h1>We could not open this workspace</h1>
          <p>Please try again. If the problem continues, contact your administrator.</p>
        </div>
        <button className="button primary" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Try again
        </button>
      </section>
    </main>
  );
}
