'use client';

import { notFound } from 'next/navigation';
import { notify } from '@/lib/toast';

const isDev = process.env.NODE_ENV === 'development';

export default function ToastPreviewPage() {
  if (!isDev) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Development</p>
        <h1 className="text-2xl font-bold text-slate-900">Toast preview</h1>
        <p className="text-sm text-slate-600">
          Five production toast variants for operational feedback. Use these helpers from application code.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewButton
          label="Calm confirmation"
          onClick={() => notify.confirmation('Lease terms were saved.', { title: 'Saved' })}
        />
        <PreviewButton
          label="Payment receipt"
          onClick={() =>
            notify.payment({
              title: 'Payment recorded',
              message: 'Rent allocation completed for Sahra Yusuf.',
              amount: 'USD 700',
              reference: 'PAY-000003',
            })
          }
        />
        <PreviewButton
          label="Attention required"
          onClick={() =>
            notify.attention({
              title: 'Lease expiring soon',
              message: 'Review renewal terms before 30 Sep 2026.',
              actionLabel: 'Review lease',
              onAction: () => undefined,
            })
          }
        />
        <PreviewButton
          label="Compact undo"
          onClick={() =>
            notify.undo({
              message: 'Brokerage deal archived.',
              onUndo: () => notify.confirmation('Archive reversed.'),
            })
          }
        />
        <PreviewButton
          label="Background progress"
          onClick={() => {
            const id = `demo-${Date.now()}`;
            notify.progress({ id, title: 'Generating owner statement', message: 'Collecting ledger lines…', progress: 12 });
            window.setTimeout(() => notify.updateProgress(id, { progress: 58, message: 'Calculating payout share…' }), 900);
            window.setTimeout(
              () => notify.completeProgress(id, 'Owner statement is ready to review.', 'Export complete'),
              1800,
            );
          }}
        />
        <PreviewButton
          label="Danger attention"
          onClick={() =>
            notify.attention({
              title: 'Validation issue',
              message: 'Choose a branch, payer, and receiving account before saving.',
              tone: 'danger',
            })
          }
        />
      </div>
    </div>
  );
}

function PreviewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
    >
      {label}
    </button>
  );
}
