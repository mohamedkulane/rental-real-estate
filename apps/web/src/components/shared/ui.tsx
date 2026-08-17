import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Landmark, RotateCcw } from 'lucide-react';
import { humanize, statusTone } from '@/lib/presentation';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark${compact ? ' small' : ''}`} aria-hidden="true">
      <Landmark />
    </span>
  );
}

export function StatusBadge({ value }: { value: string | boolean | null | undefined }) {
  const label = typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : humanize(value);
  const tones = {
    positive: 'border-[#90CAF9] bg-[#E3F2FD] text-[#0D47A1]',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    negative: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  } as const;
  return (
    <span
      className={
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ' +
        tones[statusTone(value)]
      }
    >
      {label}
    </span>
  );
}

export function AccessScopeBadge({
  mode,
  branches = [],
}: {
  mode: string;
  branches?: Array<{ id: string; code: string; name: string }>;
}) {
  const labels: Record<string, string> = {
    COMPANY_WIDE: 'Company Wide',
    MULTI_BRANCH:
      branches.length > 2
        ? `${branches.length} Branches`
        : branches.map((branch) => branch.name).join(', ') || 'Multiple Branches',
    BRANCH: branches[0]?.name ?? 'Assigned Branch',
  };
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
      {labels[mode] ?? humanize(mode)}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </header>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-card state-empty">
      <span className="state-icon">
        <Inbox aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-avatar" />
          <span className="skeleton-copy">
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({
  label = 'Loading records',
  description = 'Securely loading your authorized data...',
  compact = false,
}: {
  label?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div className={`loading-state${compact ? ' compact' : ''}`} role="status" aria-live="polite">
      <div className="loading-heading">
        <BrandMark compact />
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="progress-rail" aria-hidden="true">
        <span />
      </div>
      {!compact ? <SkeletonRows /> : null}
    </div>
  );
}

export function WorkspaceLoading({ label = 'Preparing your workspace' }: { label?: string }) {
  return (
    <main className="workspace-preparation" role="status" aria-live="polite">
      <section className="preparation-panel">
        <div className="preparation-brand">
          <BrandMark />
          <div>
            <strong>Rental Operations</strong>
            <span>Secure staff workspace</span>
          </div>
        </div>
        <div className="preparation-copy">
          <p className="eyebrow">Secure workspace</p>
          <h1>{label}</h1>
          <p>Securely loading your authorized data</p>
        </div>
        <div className="progress-rail wide" aria-hidden="true">
          <span />
        </div>
        <SkeletonRows rows={3} />
        <p className="loading-note">This usually takes only a moment.</p>
      </section>
    </main>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-card state-error" role="alert">
      <span className="state-icon">
        <AlertCircle aria-hidden="true" />
      </span>
      <h3>We could not load this view</h3>
      <p>{message}</p>
      {onRetry ? (
        <button className="button secondary" onClick={onRetry}>
          <RotateCcw aria-hidden="true" /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function Feedback({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
  return (
    <div className={`feedback feedback-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'success' ? (
        <CheckCircle2 aria-hidden="true" />
      ) : (
        <AlertCircle aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}
