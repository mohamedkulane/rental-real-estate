'use client';

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import type { Toast } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { ToastFrame, ToastIcon } from './toast-frame';
import type {
  NotifyAttentionInput,
  NotifyConfirmationInput,
  NotifyPaymentInput,
  NotifyProgressInput,
  NotifyUndoInput,
} from './types';

const DEFAULT_DURATION = 4200;
const UNDO_DURATION = 6500;

export function renderCalmConfirmation(t: Toast, input: NotifyConfirmationInput) {
  const title = input.title ?? 'Saved';
  return (
    <ToastFrame
      toast={t}
      tone="success"
      title={title}
      message={input.message}
      durationMs={input.durationMs ?? DEFAULT_DURATION}
      onDismiss={() => toast.dismiss(t.id)}
      icon={
        <ToastIcon tone="success">
          <CheckCircle2 className="h-5 w-5" />
        </ToastIcon>
      }
    />
  );
}

export function renderPaymentReceipt(t: Toast, input: NotifyPaymentInput) {
  const title = input.title ?? 'Payment recorded';
  return (
    <ToastFrame
      toast={t}
      tone="payment"
      title={title}
      message={input.message}
      durationMs={input.durationMs ?? DEFAULT_DURATION}
      onDismiss={() => toast.dismiss(t.id)}
      icon={
        <ToastIcon tone="payment">
          <Receipt className="h-5 w-5" />
        </ToastIcon>
      }
    >
      {input.amount ? (
        <p className="mt-2 text-[18px] font-bold tracking-tight text-green-700">{input.amount}</p>
      ) : null}
      {input.reference ? (
        <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-green-700/80">
          {input.reference}
        </p>
      ) : null}
    </ToastFrame>
  );
}

export function renderAttentionRequired(t: Toast, input: NotifyAttentionInput) {
  const title = input.title ?? 'Attention required';
  const isDanger = input.tone === 'danger';
  return (
    <ToastFrame
      toast={t}
      tone="warning"
      title={title}
      message={input.message}
      durationMs={input.durationMs ?? DEFAULT_DURATION}
      onDismiss={() => toast.dismiss(t.id)}
      className={
        isDanger
          ? 'border-red-200/90 bg-red-50/95 shadow-[0_18px_40px_-24px_rgba(220,38,38,0.35)] ring-red-100 before:bg-red-500'
          : ''
      }
      icon={
        <span
          className={
            'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full motion-safe:animate-[toast-icon-pop_420ms_ease-out] motion-reduce:animate-none ' +
            (isDanger ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')
          }
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
      }
    >
      {input.actionLabel && input.onAction ? (
        <button
          type="button"
          onClick={() => {
            input.onAction?.();
            toast.dismiss(t.id);
          }}
          className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          {input.actionLabel}
        </button>
      ) : null}
    </ToastFrame>
  );
}

export function renderCompactUndo(t: Toast, input: NotifyUndoInput) {
  return (
    <ToastFrame
      toast={t}
      tone="undo"
      title={input.message}
      compact
      durationMs={input.durationMs ?? UNDO_DURATION}
      onDismiss={() => toast.dismiss(t.id)}
      icon={
        <ToastIcon tone="undo">
          <RotateCcw className="h-4 w-4" />
        </ToastIcon>
      }
    >
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            input.onUndo();
            toast.dismiss(t.id);
          }}
          className="rounded-md bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {input.undoLabel ?? 'Undo'}
        </button>
      </div>
    </ToastFrame>
  );
}

export function renderBackgroundProgress(t: Toast, input: NotifyProgressInput) {
  const progress = clampProgress(input.progress ?? 0);
  return (
    <ToastFrame
      toast={t}
      tone="progress"
      title={input.title}
      {...(input.message ? { message: input.message } : {})}
      onDismiss={() => toast.dismiss(t.id)}
      icon={
        <ToastIcon tone="progress">
          <LoaderCircle className="h-5 w-5 motion-safe:animate-spin motion-reduce:animate-none" />
        </ToastIcon>
      }
    >
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[12px] font-medium text-violet-700">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-500 motion-safe:transition-[width] motion-safe:duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          />
        </div>
      </div>
    </ToastFrame>
  );
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export { DEFAULT_DURATION, UNDO_DURATION };
