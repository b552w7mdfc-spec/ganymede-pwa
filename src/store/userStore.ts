import { create } from 'zustand';
import { alignTeam, applyStepAction, openGuide, type StepAction } from '../model/progress';
import {
  addCharacter,
  addTeam,
  removeCharacter,
  removeTeam,
  setActive,
  updateCharacter,
  updateTeam,
} from '../model/roster';
import { emptyUserState, type ActiveContext, type Character, type GuideId, type UserState } from '../model/types';
import { loadUserState, saveUserState } from './persistence';

interface UserStore {
  hydrated: boolean;
  user: UserState;
  /** Message d'avertissement (ex. données illisibles au démarrage). */
  warning: string | null;
  saveError: string | null;

  hydrate(): Promise<void>;
  dismissWarning(): void;

  setActive(ctx: ActiveContext): void;
  addCharacter(input: { name: string; className?: string; level?: number; color: string }): void;
  updateCharacter(id: string, patch: Partial<Pick<Character, 'name' | 'className' | 'level' | 'color'>>): void;
  removeCharacter(id: string): void;
  addTeam(input: { name: string; memberIds: string[] }): void;
  updateTeam(id: string, patch: { name?: string; memberIds?: string[] }): void;
  removeTeam(id: string): void;

  openGuide(guideId: GuideId): void;
  step(guideId: GuideId, totalSteps: number, action: StepAction): void;
  alignTeam(teamId: string, guideId: GuideId, totalSteps: number, step: number): void;

  replaceAll(state: UserState): void;
}

export const useUserStore = create<UserStore>()((set, get) => {
  /** Applique une transformation pure puis persiste. */
  const update = (fn: (s: UserState) => UserState) => {
    const prev = get().user;
    const next = fn(prev);
    if (next === prev) return;
    set({ user: next });
    saveUserState(next).then(
      () => get().saveError && set({ saveError: null }),
      (e: unknown) => set({ saveError: `Échec de l’enregistrement : ${e instanceof Error ? e.message : String(e)}` }),
    );
  };

  return {
    hydrated: false,
    user: emptyUserState(),
    warning: null,
    saveError: null,

    async hydrate() {
      if (get().hydrated) return;
      try {
        const r = await loadUserState();
        set({ user: r.state, hydrated: true, warning: r.warning ?? null });
      } catch (e) {
        set({
          hydrated: true,
          warning: `Stockage local indisponible : ${e instanceof Error ? e.message : String(e)}. Rien ne sera enregistré.`,
        });
      }
    },
    dismissWarning: () => set({ warning: null }),

    setActive: (ctx) => update((s) => setActive(s, ctx)),
    addCharacter: (input) => update((s) => addCharacter(s, input, Date.now())),
    updateCharacter: (id, patch) => update((s) => updateCharacter(s, id, patch)),
    removeCharacter: (id) => update((s) => removeCharacter(s, id)),
    addTeam: (input) => update((s) => addTeam(s, input)),
    updateTeam: (id, patch) => update((s) => updateTeam(s, id, patch)),
    removeTeam: (id) => update((s) => removeTeam(s, id)),

    openGuide: (guideId) => update((s) => openGuide(s, s.active, guideId, Date.now())),
    step: (guideId, total, action) => update((s) => applyStepAction(s, s.active, guideId, total, action, Date.now())),
    alignTeam: (teamId, guideId, total, step) => update((s) => alignTeam(s, teamId, guideId, total, step, Date.now())),

    replaceAll: (state) => update(() => state),
  };
});
