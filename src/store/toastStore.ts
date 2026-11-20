import { create } from 'zustand';

interface ToastStore {
  message: string | null;
  seq: number;
  show(message: string): void;
  hide(): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Toast discret, un seul à la fois. */
export const useToastStore = create<ToastStore>()((set, get) => ({
  message: null,
  seq: 0,
  show: (message) => {
    clearTimeout(timer);
    set({ message, seq: get().seq + 1 });
    timer = setTimeout(() => set({ message: null }), 1800);
  },
  hide: () => set({ message: null }),
}));

export const toast = (message: string) => useToastStore.getState().show(message);
