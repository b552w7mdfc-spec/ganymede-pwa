import { create } from 'zustand';

export interface NavEntry {
  guideId: number;
  /** Index 0 de l'étape quittée. */
  step: number;
  guideName: string;
}

interface NavStore {
  stack: NavEntry[];
  push(e: NavEntry): void;
  pop(): NavEntry | undefined;
  clear(): void;
}

/** Pile des sauts entre guides (session seulement, non persistée). */
export const useNavStore = create<NavStore>()((set, get) => ({
  stack: [],
  push: (e) => set({ stack: [...get().stack, e].slice(-20) }),
  pop: () => {
    const { stack } = get();
    const top = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1) });
    return top;
  },
  clear: () => get().stack.length && set({ stack: [] }),
}));
