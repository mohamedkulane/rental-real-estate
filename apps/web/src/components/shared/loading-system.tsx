'use client';

import type { CSSProperties, ReactNode } from 'react';

function SkeletonBlock({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={'skeleton-block ' + className} style={style} aria-hidden="true" />;
}

export function RealEstateLoadingIllustration() {
  return (
    <div className="real-estate-loading-illustration" aria-hidden="true">
      <svg viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="34" width="28" height="46" rx="2" fill="#E2E8F0" />
        <rect x="22" y="42" width="6" height="6" rx="1" fill="#CBD5E1" />
        <rect x="32" y="42" width="6" height="6" rx="1" fill="#CBD5E1" />
        <rect x="22" y="54" width="6" height="6" rx="1" fill="#CBD5E1" />
        <rect x="32" y="54" width="6" height="6" rx="1" fill="#CBD5E1" />
        <rect x="22" y="66" width="6" height="6" rx="1" fill="#CBD5E1" />
        <rect x="32" y="66" width="6" height="6" rx="1" fill="#CBD5E1" />
        <rect x="46" y="24" width="30" height="56" rx="2" fill="#D1FAE5" stroke="#A7F3D0" />
        <rect x="52" y="32" width="7" height="7" rx="1" fill="#6EE7B7" />
        <rect x="63" y="32" width="7" height="7" rx="1" fill="#6EE7B7" />
        <rect x="52" y="44" width="7" height="7" rx="1" fill="#6EE7B7" />
        <rect x="63" y="44" width="7" height="7" rx="1" fill="#6EE7B7" />
        <rect x="52" y="56" width="7" height="7" rx="1" fill="#6EE7B7" />
        <rect x="63" y="56" width="7" height="7" rx="1" fill="#6EE7B7" />
        <rect x="78" y="40" width="24" height="40" rx="2" fill="#E2E8F0" />
        <rect x="82" y="48" width="5" height="5" rx="1" fill="#CBD5E1" />
        <rect x="90" y="48" width="5" height="5" rx="1" fill="#CBD5E1" />
        <rect x="82" y="58" width="5" height="5" rx="1" fill="#CBD5E1" />
        <rect x="90" y="58" width="5" height="5" rx="1" fill="#CBD5E1" />
        <path d="M8 80H112" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function DotProgress({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="dot-progress" role="status" aria-label={label}>
      <span className="dot-progress-item" />
      <span className="dot-progress-item" />
      <span className="dot-progress-item" />
    </div>
  );
}

export function AppLoadingScreen({
  title = 'Setting things up...',
  description = 'Just a moment while we prepare your real estate workspace.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="app-loading-screen" role="status" aria-live="polite">
      <section className="app-loading-screen-panel">
        <RealEstateLoadingIllustration />
        <div className="app-loading-screen-copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <DotProgress label={title} />
      </section>
    </main>
  );
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="page-skeleton" aria-hidden="true">
      <SkeletonBlock className="page-skeleton-title" />
      <SkeletonBlock className="page-skeleton-subtitle" />
      <div className="page-skeleton-toolbar">
        <SkeletonBlock className="page-skeleton-search" />
        <SkeletonBlock className="page-skeleton-filter" />
      </div>
      <TableSkeleton rows={rows} columns={5} />
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      <div
        className="table-skeleton-header"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <SkeletonBlock key={index} className="table-skeleton-header-cell" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="table-skeleton-row"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <SkeletonBlock
              key={colIndex}
              className="table-skeleton-cell"
              style={{ width: colIndex === 0 ? '78%' : colIndex === columns - 1 ? '42%' : '62%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-hidden="true">
      <div className="dashboard-skeleton-metrics">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="dashboard-skeleton-metric">
            <SkeletonBlock className="dashboard-skeleton-metric-label" />
            <SkeletonBlock className="dashboard-skeleton-metric-value" />
          </div>
        ))}
      </div>
      <div className="dashboard-skeleton-panels">
        <div className="dashboard-skeleton-panel dashboard-skeleton-panel-wide">
          <SkeletonBlock className="dashboard-skeleton-panel-title" />
          <SkeletonBlock className="dashboard-skeleton-chart" />
        </div>
        <div className="dashboard-skeleton-panel">
          <SkeletonBlock className="dashboard-skeleton-panel-title" />
          <SkeletonBlock className="dashboard-skeleton-donut" />
        </div>
      </div>
      <div className="dashboard-skeleton-list">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="dashboard-skeleton-list-row">
            <SkeletonBlock className="dashboard-skeleton-list-title" />
            <SkeletonBlock className="dashboard-skeleton-list-meta" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="form-skeleton" aria-hidden="true">
      <SkeletonBlock className="form-skeleton-section-title" />
      <div className="form-skeleton-grid">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="form-skeleton-field">
            <SkeletonBlock className="form-skeleton-label" />
            <SkeletonBlock className="form-skeleton-input" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="form-skeleton-button" />
    </div>
  );
}

export function InlineLoading({
  label,
  size = 'sm',
}: {
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span className={'inline-loading inline-loading-' + size} role="status" aria-live="polite">
      <span className="inline-loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function ImageSkeleton({
  className = '',
  aspect = 'square',
}: {
  className?: string;
  aspect?: 'square' | 'video' | 'wide';
}) {
  return (
    <div
      className={'image-skeleton image-skeleton-' + aspect + ' ' + className}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="image-skeleton-icon">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M8 13l2.5-2.5L14 14l2-2 4 4" />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

export function SectionLoading({
  label = 'Loading records',
  variant = 'table',
}: {
  label?: string;
  variant?: 'table' | 'form' | 'page';
}) {
  return (
    <div className="section-loading" role="status" aria-live="polite">
      <p className="section-loading-label">{label}</p>
      {variant === 'table' ? <TableSkeleton rows={5} columns={5} /> : null}
      {variant === 'form' ? <FormSkeleton fields={4} /> : null}
      {variant === 'page' ? <PageSkeleton rows={3} /> : null}
    </div>
  );
}

export function LoadingButtonContent({
  busy,
  busyLabel,
  idleLabel,
  icon,
}: {
  busy: boolean;
  busyLabel: string;
  idleLabel: ReactNode;
  icon?: ReactNode;
}) {
  if (busy) return <InlineLoading label={busyLabel} />;
  return (
    <>
      {icon}
      {idleLabel}
    </>
  );
}
