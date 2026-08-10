'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main className="workspace-preparation">
          <section className="preparation-panel error-panel" role="alert">
            <span className="state-icon">
              <AlertTriangle aria-hidden="true" />
            </span>
            <div className="preparation-copy">
              <p className="eyebrow">Rental Operations</p>
              <h1>Something interrupted this page</h1>
              <p>Your data is safe. Try loading the workspace again.</p>
            </div>
            <button className="button primary" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
