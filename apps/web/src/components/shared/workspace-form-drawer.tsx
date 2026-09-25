'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';

const SIZE_CLASS = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
} as const;

export type WorkspaceFormDrawerSize = keyof typeof SIZE_CLASS;
export type WorkspaceFormDrawerLayout = 'form' | 'compact';

/**
 * Centered workspace create/edit panel.
 * Long forms scroll smoothly inside the body with soft edge fades.
 */
export function WorkspaceFormDrawer({
  open,
  title,
  description,
  eyebrow,
  onClose,
  children,
  footer,
  size = 'md',
  layout = 'form',
}: {
  open: boolean;
  title: string;
  description: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: WorkspaceFormDrawerSize;
  /** Compact dialogs keep short decisions visible without a tall empty panel. */
  layout?: WorkspaceFormDrawerLayout;
}) {
  const [entered, setEntered] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function updateScrollFades(target: HTMLDivElement) {
    const { scrollTop, scrollHeight, clientHeight } = target;
    const maxScroll = scrollHeight - clientHeight;
    setCanScrollUp(scrollTop > 4);
    setCanScrollDown(maxScroll > 8 && scrollTop < maxScroll - 4);
  }

  function onBodyScroll(event: UIEvent<HTMLDivElement>) {
    updateScrollFades(event.currentTarget);
  }

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      setEntered(true);
      const body = bodyRef.current;
      if (body) {
        body.scrollTop = 0;
        updateScrollFades(body);
      }
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);

    const body = bodyRef.current;
    const observer =
      body && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (bodyRef.current) updateScrollFades(bodyRef.current);
          })
        : null;
    if (body && observer) {
      observer.observe(body);
      if (body.firstElementChild instanceof HTMLElement) {
        observer.observe(body.firstElementChild);
      }
    }

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      observer?.disconnect();
    };
  }, [open]);

  if (!open) return null;

  const isCompact = layout === 'compact';

  return (
    <div
      className={
        'workspace-form-drawer-overlay fixed inset-0 z-[80] flex justify-center p-3 sm:p-5 ' +
        (isCompact ? 'items-start pt-12 sm:pt-20' : 'items-center') +
        ' ' +
        'transition-colors duration-200 ease-out motion-reduce:transition-none ' +
        (entered ? 'is-entering bg-slate-950/45' : 'bg-slate-950/0')
      }
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={
          'workspace-form-drawer-panel relative flex max-h-[calc(100dvh-2rem)] w-full flex-col ' +
          (isCompact ? 'workspace-form-drawer-compact h-auto' : 'h-[min(90vh,820px)]') +
          ' ' +
          'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ' +
          'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ' +
          (entered
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-2 scale-[0.985] opacity-0') +
          ' ' +
          SIZE_CLASS[size]
        }
      >
        <header className="relative z-10 shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            aria-hidden="true"
            className={
              'workspace-form-drawer-fade workspace-form-drawer-fade-top pointer-events-none absolute inset-x-0 top-0 z-[1] h-7 ' +
              (canScrollUp ? 'opacity-100' : 'opacity-0')
            }
          />
          <div
            ref={bodyRef}
            onScroll={onBodyScroll}
            className={
              'workspace-form-drawer-body min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 ' +
              (isCompact ? 'max-h-[calc(100dvh-12rem)] flex-none' : 'flex-1')
            }
          >
            {children}
          </div>
          <div
            aria-hidden="true"
            className={
              'workspace-form-drawer-fade workspace-form-drawer-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 ' +
              (canScrollDown ? 'opacity-100' : 'opacity-0')
            }
          />
        </div>

        {footer ? (
          <footer className="workspace-form-drawer-footer relative z-10 shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

export function WorkspaceFormDrawerFooter({
  onCancel,
  submitLabel,
  loadingLabel = 'Saving…',
  isPending,
  formId,
  disabled,
}: {
  onCancel: () => void;
  submitLabel: string;
  loadingLabel?: string;
  isPending: boolean;
  formId: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        className="button secondary"
        onClick={onCancel}
        disabled={isPending}
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        className="button primary"
        disabled={isPending || disabled}
      >
        {isPending ? loadingLabel : submitLabel}
      </button>
    </div>
  );
}
