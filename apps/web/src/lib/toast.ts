import hotToast from 'react-hot-toast';
import { notify } from './notifications/notify';

type ToastFn = typeof hotToast;

const toast = ((message: Parameters<ToastFn>[0], options?: Parameters<ToastFn>[1]) =>
  hotToast(message, options)) as ToastFn;

toast.success = (message) => notify.confirmation(typeof message === 'string' ? message : 'Saved');
toast.error = (message) => {
  const text = typeof message === 'string' ? message : 'Something went wrong';
  return notify.attention({ title: 'Something went wrong', message: text, tone: 'danger' });
};
toast.custom = (...args) => hotToast.custom(...args);
toast.dismiss = (...args) => hotToast.dismiss(...args);
toast.remove = (...args) => hotToast.remove(...args);
toast.promise = (...args) => hotToast.promise(...args);
toast.loading = (...args) => hotToast.loading(...args);

export default toast;
export { notify } from './notifications/notify';
export { AppToaster } from './notifications/app-toaster';
export type {
  NotifyAttentionInput,
  NotifyConfirmationInput,
  NotifyPaymentInput,
  NotifyProgressInput,
  NotifyUndoInput,
} from './notifications/types';
