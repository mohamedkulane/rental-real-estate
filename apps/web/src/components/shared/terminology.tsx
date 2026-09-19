'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import {
  getTerm,
  getTermDescription,
  getTermEnglish,
  getTermSomali,
  type TermKey,
} from '@/lib/terminology';

type TermLabelProps = {
  term: TermKey;
  /** Override displayed English label while keeping dictionary Somali guidance. */
  english?: string;
  showSomali?: boolean;
  showTooltip?: boolean;
  className?: string;
};

export function TermHint({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`term-hint ${className}`.trim()}>{children}</span>;
}

export function TermLabel({
  term,
  english,
  showSomali = true,
  showTooltip = false,
  className = '',
}: TermLabelProps) {
  const definition = getTerm(term);
  const label = english ?? definition.english;

  return (
    <span className={`term-label ${className}`.trim()}>
      <span className="term-label__english">{label}</span>
      {showSomali ? <TermHint>{definition.somali}</TermHint> : null}
      {showTooltip && definition.descriptionSomali ? (
        <TermTooltip term={term} className="term-label__tooltip" />
      ) : null}
    </span>
  );
}

export function TermTooltip({
  term,
  title,
  description,
  className = '',
}: {
  term?: TermKey;
  title?: string;
  description?: string;
  className?: string;
}) {
  const definition = term ? getTerm(term) : undefined;
  const tooltipTitle = title ?? definition?.english ?? '';
  const tooltipBody = description ?? definition?.descriptionSomali ?? definition?.somali ?? '';

  if (!tooltipBody) return null;

  return (
    <span className={`term-tooltip ${className}`.trim()}>
      <button
        type="button"
        className="term-tooltip__trigger"
        aria-label={`${tooltipTitle}: ${tooltipBody}`}
        title={tooltipBody}
      >
        <Info aria-hidden="true" size={14} strokeWidth={2.25} />
      </button>
    </span>
  );
}

export function TermFormField({
  term,
  label,
  hint,
  tooltip = false,
  children,
  className = '',
}: {
  term?: TermKey;
  label?: string;
  hint?: string;
  tooltip?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const english = label ?? (term ? getTermEnglish(term) : '');
  const somaliHint = hint ?? (term ? getTermSomali(term) : undefined);
  const description = term ? getTermDescription(term) : undefined;

  return (
    <label className={`term-form-field ${className}`.trim()}>
      <span className="term-form-field__label-row">
        <span className="term-form-field__label">{english}</span>
        {tooltip && description && term ? <TermTooltip term={term} description={description} /> : null}
      </span>
      {children}
      {somaliHint ? <TermHint>{somaliHint}</TermHint> : null}
    </label>
  );
}

export function TermSectionHeading({
  term,
  title,
  description,
  descriptionSomali,
}: {
  term?: TermKey;
  title?: string;
  description?: string;
  descriptionSomali?: string;
}) {
  const definition = term ? getTerm(term) : undefined;

  return (
    <div className="term-section-heading">
      <h2>{title ?? definition?.english}</h2>
      {description ? <p>{description}</p> : null}
      <TermHint>{descriptionSomali ?? definition?.descriptionSomali ?? definition?.somali}</TermHint>
    </div>
  );
}

export function TermFilterLabel({
  term,
  label,
  tooltip = false,
}: {
  term: TermKey;
  label?: string;
  tooltip?: boolean;
}) {
  const definition = getTerm(term);
  return (
    <span className="term-filter-label">
      <span>{label ?? definition.english}</span>
      <TermHint>{definition.somali}</TermHint>
      {tooltip && definition.descriptionSomali ? (
        <TermTooltip term={term} className="term-filter-label__tooltip" />
      ) : null}
    </span>
  );
}

export function TermEmptyDescription({
  term,
  fallback,
}: {
  term: TermKey;
  fallback?: string;
}) {
  const definition = getTerm(term);
  return <TermHint>{fallback ?? definition.descriptionSomali ?? definition.somali}</TermHint>;
}

export function TermGuidance({
  english,
  somali,
  descriptionSomali,
}: {
  english?: string;
  somali?: string;
  descriptionSomali?: string;
}) {
  return (
    <div className="term-guidance">
      {english ? <p className="term-guidance__english">{english}</p> : null}
      {somali ? <TermHint>{somali}</TermHint> : null}
      {descriptionSomali ? <TermHint>{descriptionSomali}</TermHint> : null}
    </div>
  );
}
