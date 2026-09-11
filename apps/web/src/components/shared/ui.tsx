import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Landmark, RotateCcw } from 'lucide-react';
import { humanize, statusTone } from '@/lib/presentation';
import {
  AppLoadingScreen,
  DashboardSkeleton,
  FormSkeleton,
  ImageSkeleton,
  InlineLoading,
  PageSkeleton,
  SectionLoading,
  TableSkeleton,
} from './loading-system';

export {
  AppLoadingScreen,
  DashboardSkeleton,
  FormSkeleton,
  ImageSkeleton,
  InlineLoading,
  LoadingButtonContent,
  PageSkeleton,
  SectionLoading,
  TableSkeleton,
} from './loading-system';

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
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    negative: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  } as const;
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-semibold ' +
        tones[statusTone(value)]
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
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

export function LoadingState({
  label = 'Loading records',
  variant = 'table',
}: {
  label?: string;
  description?: string;
  compact?: boolean;
  variant?: 'table' | 'form' | 'page';
}) {
  return <SectionLoading label={label} variant={variant} />;
}

/** @deprecated Use AppLoadingScreen for page-level loading. */
export function WorkspaceLoading({ label }: { label?: string }) {
  return (
    <AppLoadingScreen
      title={label ? label.replace(/\.$/, '') : 'Setting things up...'}
      description="Just a moment while we prepare your real estate workspace."
    />
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
