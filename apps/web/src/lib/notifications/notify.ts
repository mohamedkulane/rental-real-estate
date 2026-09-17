import toast from 'react-hot-toast';
import {
  DEFAULT_DURATION,
  renderAttentionRequired,
  renderBackgroundProgress,
  renderCalmConfirmation,
  renderCompactUndo,
  renderPaymentReceipt,
  UNDO_DURATION,
} from './toast-variants';
import type {
  NotifyAttentionInput,
  NotifyConfirmationInput,
  NotifyPaymentInput,
  NotifyProgressInput,
  NotifyProgressUpdateInput,
  NotifyUndoInput,
} from './types';

const PROGRESS_ID_PREFIX = 'rerms-progress:';

function progressId(id?: string) {
  return id ? `${PROGRESS_ID_PREFIX}${id}` : undefined;
}

export const notify = {
  confirmation(message: string, options?: Omit<NotifyConfirmationInput, 'message'>) {
    return toast.custom(
      (t) => renderCalmConfirmation(t, { message, ...options }),
      { duration: options?.durationMs ?? DEFAULT_DURATION },
    );
  },

  payment(input: NotifyPaymentInput) {
    return toast.custom((t) => renderPaymentReceipt(t, input), {
      duration: input.durationMs ?? DEFAULT_DURATION,
    });
  },

  attention(input: NotifyAttentionInput) {
    return toast.custom((t) => renderAttentionRequired(t, input), {
      duration: input.durationMs ?? DEFAULT_DURATION,
    });
  },

  undo(input: NotifyUndoInput) {
    return toast.custom((t) => renderCompactUndo(t, input), {
      duration: input.durationMs ?? UNDO_DURATION,
    });
  },

  progress(input: NotifyProgressInput) {
    const id = progressId(input.id);
    if (id) {
      return toast.custom((t) => renderBackgroundProgress(t, input), { id, duration: Infinity });
    }
    return toast.custom((t) => renderBackgroundProgress(t, input), { duration: Infinity });
  },

  updateProgress(id: string, update: NotifyProgressUpdateInput) {
    const toastId = progressId(id);
    if (!toastId) return;
    const payload: NotifyProgressInput = {
      id,
      title: update.title ?? 'Working…',
      progress: update.progress ?? 0,
    };
    if (update.message) payload.message = update.message;
    toast.custom((t) => renderBackgroundProgress(t, payload), { id: toastId, duration: Infinity });
  },

  completeProgress(id: string, message: string, title = 'Complete') {
    const toastId = progressId(id);
    if (!toastId) return;
    toast.custom(
      (t) =>
        renderBackgroundProgress(t, {
          id,
          title,
          message,
          progress: 100,
        }),
      { id: toastId, duration: DEFAULT_DURATION },
    );
    window.setTimeout(() => toast.dismiss(toastId), DEFAULT_DURATION);
  },

  dismiss: (toastId?: string) => toast.dismiss(toastId),
};

export type { NotifyAttentionInput, NotifyConfirmationInput, NotifyPaymentInput, NotifyProgressInput, NotifyUndoInput };
