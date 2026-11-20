import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogStore {
  current: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  close(ok: boolean): void;
}

/** Fenêtre de confirmation intégrée (remplace window.confirm). */
export const useDialogStore = create<DialogStore>()((set, get) => ({
  current: null,
  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      // Une seule fenêtre à la fois : la précédente est annulée.
      get().current?.resolve(false);
      set({ current: { ...opts, resolve } });
    }),
  close: (ok) => {
    const c = get().current;
    set({ current: null });
    c?.resolve(ok);
  },
}));

export const confirmDialog = (opts: ConfirmOptions) => useDialogStore.getState().confirm(opts);
