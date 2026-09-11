'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, ExternalLink, Lightbulb } from 'lucide-react';
import { StatusBadge } from '@/components/shared/ui';

export type GuidedStep = {
  label: string;
  sidebarHint: string;
};

type GuidedWorkflowShellProps = {
  breadcrumbs: Array<{ label: string; href?: string }>;
  title: string;
  subtitle: string;
  status: string;
  steps: GuidedStep[];
  currentStep: number;
  stepTitle: string;
  stepDescription: string;
  progressPercent: number;
  stepIcon?: ReactNode;
  children: ReactNode;
  helpText?: string;
  helpHref?: string;
  footer: ReactNode;
};

export function GuidedWorkflowShell({
  breadcrumbs,
  title,
  subtitle,
  status,
  steps,
  currentStep,
  stepTitle,
  stepDescription,
  progressPercent,
  stepIcon,
  children,
  helpText = 'Need help completing this workflow? View our step-by-step guide for detailed instructions.',
  helpHref = '#',
  footer,
}: GuidedWorkflowShellProps) {
  return (
    <div className="guided-workflow">
      <nav className="guided-workflow__breadcrumbs" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="guided-workflow__crumb">
            {crumb.href ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
            {index < breadcrumbs.length - 1 ? (
              <ChevronRight aria-hidden="true" className="guided-workflow__crumb-icon" />
            ) : null}
          </span>
        ))}
      </nav>

      <header className="guided-workflow__hero">
        <div className="guided-workflow__hero-copy">
          <p className="eyebrow">Guided Workflow</p>
          <h1>{title}</h1>
          <p className="guided-workflow__subtitle">{subtitle}</p>
        </div>
        <div className="guided-workflow__hero-art" aria-hidden="true">
          <p className="guided-workflow__hero-quote">From property to people</p>
          <p className="guided-workflow__hero-tagline">Faster leasing, happier communities.</p>
        </div>
        <div className="guided-workflow__hero-status">
          <StatusBadge value={status} />
        </div>
      </header>

      <div className="guided-workflow__stepper-panel">
        <ol className="guided-workflow__track-stepper" aria-label="Workflow steps">
          {steps.map((item, index) => {
            const stepNumber = index + 1;
            const active = stepNumber === currentStep;
            const complete = stepNumber < currentStep;
            return (
              <li
                key={item.label}
                aria-current={active ? 'step' : undefined}
                className={`guided-workflow__track-step${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}`}
              >
                <span className="guided-workflow__track-node">
                  {complete ? <Check size={14} strokeWidth={2.5} /> : stepNumber}
                </span>
                <span className="guided-workflow__track-label">{item.label}</span>
                {index < steps.length - 1 ? (
                  <span
                    className={`guided-workflow__track-line${complete ? ' is-complete' : ''}${active ? ' is-active' : ''}`}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="guided-workflow__layout">
        <section className="guided-workflow__main">
          <div className="guided-workflow__step-head">
            <div className="guided-workflow__step-icon" aria-hidden="true">
              {stepIcon ?? currentStep}
            </div>
            <div>
              <p className="guided-workflow__step-kicker">
                Step {currentStep} of {steps.length}: <strong>{stepTitle}</strong>
              </p>
              <p className="guided-workflow__step-description">{stepDescription}</p>
            </div>
          </div>

          <div className="guided-workflow__progress-row">
            <div
              className="guided-workflow__progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Step progress"
            >
              <span
                className="guided-workflow__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="guided-workflow__progress-label">{progressPercent}% complete</span>
          </div>

          <div className="guided-workflow__content">{children}</div>
        </section>

        <aside className="guided-workflow__aside" aria-label="Workflow progress">
          <div className="guided-workflow__aside-card">
            <h2>Workflow Progress</h2>
            <p className="guided-workflow__aside-meta">
              {currentStep} of {steps.length} steps
            </p>
            <ol className="guided-workflow__aside-steps">
              {steps.map((item, index) => {
                const stepNumber = index + 1;
                const active = stepNumber === currentStep;
                const complete = stepNumber < currentStep;
                return (
                  <li
                    key={item.label}
                    className={`guided-workflow__aside-step${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}`}
                  >
                    <span className="guided-workflow__aside-index">
                      {complete ? <Check size={12} strokeWidth={2.5} /> : stepNumber}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <span>{item.sidebarHint}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="guided-workflow__help">
            <div className="guided-workflow__help-icon" aria-hidden="true">
              <Lightbulb size={18} />
            </div>
            <div>
              <h3>Need Help?</h3>
              <p>{helpText}</p>
              <a href={helpHref} className="guided-workflow__help-link">
                View Guide <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </aside>
      </div>

      <footer className="guided-workflow__footer">{footer}</footer>
    </div>
  );
}

export function GuidedWorkflowFooter({
  onCancel,
  onSaveDraft,
  onBack,
  onContinue,
  cancelDisabled,
  draftDisabled,
  backDisabled,
  continueDisabled,
  continueLabel = 'Continue',
  continuePending = false,
  showBack = false,
}: {
  onCancel: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
  onContinue: () => void;
  cancelDisabled?: boolean;
  draftDisabled?: boolean;
  backDisabled?: boolean;
  continueDisabled?: boolean;
  continueLabel?: string;
  continuePending?: boolean;
  showBack?: boolean;
}) {
  return (
    <>
      <button type="button" className="button ghost danger" disabled={cancelDisabled} onClick={onCancel}>
        Cancel Workflow
      </button>
      <div className="guided-workflow__footer-actions">
        {showBack ? (
          <button type="button" className="button secondary" disabled={backDisabled} onClick={onBack}>
            Back
          </button>
        ) : null}
        <button type="button" className="button secondary" disabled={draftDisabled} onClick={onSaveDraft}>
          Save Draft
        </button>
        <button
          type="button"
          className="button primary guided-workflow__continue"
          disabled={continueDisabled || continuePending}
          onClick={onContinue}
        >
          {continuePending ? 'Saving…' : continueLabel}
          {!continuePending ? <ArrowRight size={16} /> : null}
        </button>
      </div>
    </>
  );
}
