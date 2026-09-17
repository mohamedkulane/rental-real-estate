import type { ReactNode } from 'react';
import type { Toast } from 'react-hot-toast';

export type ToastDismissHandler = () => void;

export type ToastFrameProps = {
  toast: Toast;
  tone: 'success' | 'payment' | 'warning' | 'undo' | 'progress';
  title: string;
  message?: string;
  icon?: ReactNode;
  onDismiss?: ToastDismissHandler;
  children?: React.ReactNode;
  className?: string;
  durationMs?: number;
  compact?: boolean;
};

export type NotifyConfirmationInput = {
  title?: string;
  message: string;
  durationMs?: number;
};

export type NotifyPaymentInput = {
  title?: string;
  message: string;
  amount?: string;
  reference?: string;
  durationMs?: number;
};

export type NotifyAttentionInput = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'warning' | 'danger';
  durationMs?: number;
};

export type NotifyUndoInput = {
  message: string;
  undoLabel?: string;
  onUndo: () => void;
  durationMs?: number;
};

export type NotifyProgressInput = {
  id?: string;
  title: string;
  message?: string;
  progress?: number;
};

export type NotifyProgressUpdateInput = {
  title?: string;
  message?: string;
  progress?: number;
};
