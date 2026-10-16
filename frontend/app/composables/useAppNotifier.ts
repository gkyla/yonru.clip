export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  message: string;
  type: ToastType;
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export const useAppNotifier = () => {
  const toast = useState<ToastMessage | null>('clipperToast', () => null);

  // Centralized reactive timeout mediator for decoupled shared reactivity
  watch(
    toast,
    newVal => {
      if (newVal) {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
          toast.value = null;
        }, 3000);
      }
    },
    { flush: 'sync' }
  );

  function showToast(message: string, type: ToastType = 'success') {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    toast.value = { message, type };
  }

  function dismissToast() {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    toast.value = null;
  }

  return {
    toast,
    showToast,
    dismissToast
  };
};
