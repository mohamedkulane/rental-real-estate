import Link from 'next/link';
import { ArrowLeft, MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="workspace-preparation">
      <section className="preparation-panel error-panel">
        <span className="state-icon">
          <MapPinOff aria-hidden="true" />
        </span>
        <div className="preparation-copy">
          <p className="eyebrow">Rental Operations</p>
          <h1>Page not found</h1>
          <p>The page may have moved, or you may not have access to it.</p>
        </div>
        <Link className="button secondary" href="/admin">
          <ArrowLeft aria-hidden="true" /> Return to workspace
        </Link>
      </section>
    </main>
  );
}
