'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ToastFrameProps } from './types';

const toneStyles: Record<ToastFrameProps['tone'], string> = {
  success:
    'border-emerald-200/80 bg-white shadow-[0_18px_40px_-24px_rgba(5,150,105,0.55)] ring-1 ring-emerald-100/80 before:bg-emerald-500',
  payment:
    'border-green-200/90 bg-gradient-to-r from-green-50 via-white to-white shadow-[0_18px_40px_-24px_rgba(22,163,74,0.45)] ring-1 ring-green-100 before:bg-green-500',
  warning:
    'border-amber-200/90 bg-amber-50/95 shadow-[0_18px_40px_-24px_rgba(217,119,6,0.35)] ring-1 ring-amber-100 before:bg-amber-500',
  undo: 'border-slate-700/20 bg-slate-900 text-white shadow-[0_16px_36px_-20px_rgba(15,23,42,0.65)] before:bg-slate-500',
  progress:
    'border-violet-200/80 bg-white shadow-[0_18px_40px_-24px_rgba(109,40,217,0.35)] ring-1 ring-violet-100 before:bg-violet-500',
};

export function ToastFrame({
  toast,
  tone,
  title,
  message,
  icon,
  onDismiss,
  children,
  className,
  durationMs,
  compact = false,
}: ToastFrameProps) {
  const dismiss = onDismiss ?? (() => undefined);
  const showProgress = tone !== 'undo' && tone !== 'progress' && durationMs && durationMs > 0;

  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      aria-live={tone === 'warning' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-visible={toast.visible ? 'true' : 'false'}
      className={cn(
        'toast-shell pointer-events-auto relative w-[min(100vw-1.5rem,420px)] overflow-hidden rounded-xl border',
        compact ? 'px-3.5 py-2.5 pl-4' : 'px-4 py-3.5 pl-5',
        'before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-full',
        'motion-safe:transition-all motion-safe:duration-300 motion-reduce:transition-none',
        toast.visible
          ? 'motion-safe:translate-x-0 motion-safe:opacity-100 motion-safe:scale-100'
          : 'motion-safe:translate-x-3 motion-safe:opacity-0 motion-safe:scale-[0.98]',
        toneStyles[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              compact ? 'text-[13px]' : 'text-[14px]',
              'font-semibold leading-5',
              tone === 'undo' ? 'text-white' : 'text-slate-900',
            )}
          >
            {title}
          </p>
          {message ? (
            <p
              className={cn(
                'mt-1 text-[13px] leading-5',
                tone === 'undo' ? 'text-slate-300' : 'text-slate-600',
              )}
            >
              {message}
            </p>
          ) : null}
          {children}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
            tone === 'undo'
              ? 'text-slate-300 hover:bg-white/10 hover:text-white'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
          )}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {showProgress ? (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-slate-100" aria-hidden="true">
          <span
            className={cn(
              'toast-progress-bar block h-full origin-left',
              tone === 'payment' && 'bg-green-500',
              tone === 'warning' && 'bg-amber-500',
              tone === 'success' && 'bg-emerald-500',
            )}
            style={{ animationDuration: `${durationMs}ms` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ToastIcon({
  tone,
  children,
}: {
  tone: ToastFrameProps['tone'];
  children: ReactNode;
}) {
  const toneClass =
    tone === 'payment'
      ? 'bg-green-100 text-green-700'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : tone === 'progress'
          ? 'bg-violet-100 text-violet-700'
          : tone === 'undo'
            ? 'bg-white/10 text-white'
            : 'bg-emerald-100 text-emerald-700';

  return (
    <span
      className={cn(
        'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        'motion-safe:animate-[toast-icon-pop_420ms_ease-out] motion-reduce:animate-none',
        toneClass,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
