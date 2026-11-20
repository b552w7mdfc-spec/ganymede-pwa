import { contextMemberIds } from './progress';
import type { ActiveContext, ChecksMap, GuideId, UserState } from './types';

export type TaskState = 'checked' | 'unchecked' | 'mixed';

function checkedList(checks: ChecksMap, characterId: string, guideId: GuideId, step: number): number[] {
  return checks[characterId]?.[String(guideId)]?.[String(step)] ?? [];
}

export function isChecked(
  checks: ChecksMap,
  characterId: string,
  guideId: GuideId,
  step: number,
  box: number,
): boolean {
  return checkedList(checks, characterId, guideId, step).includes(box);
}

/**
 * État d'une case pour un contexte : cochée si TOUS les membres l'ont cochée,
 * « mixed » si une partie seulement, sinon décochée.
 */
export function taskState(
  state: UserState,
  ctx: ActiveContext | null,
  guideId: GuideId,
  step: number,
  box: number,
): TaskState {
  const ids = contextMemberIds(state, ctx);
  if (ids.length === 0) return 'unchecked';
  const n = ids.filter((id) => isChecked(state.checks, id, guideId, step, box)).length;
  if (n === 0) return 'unchecked';
  return n === ids.length ? 'checked' : 'mixed';
}

/** États de toutes les cases d'une étape (index 0..count-1). */
export function stepTaskStates(
  state: UserState,
  ctx: ActiveContext | null,
  guideId: GuideId,
  step: number,
  count: number,
): TaskState[] {
  return Array.from({ length: count }, (_, i) => taskState(state, ctx, guideId, step, i));
}

/** Coche ou décoche une case pour une liste de persos. */
export function setTask(
  checks: ChecksMap,
  characterIds: string[],
  guideId: GuideId,
  step: number,
  box: number,
  checked: boolean,
): ChecksMap {
  const next: ChecksMap = { ...checks };
  const g = String(guideId);
  const s = String(step);
  for (const id of characterIds) {
    const byGuide = { ...(next[id] ?? {}) };
    const bySteps = { ...(byGuide[g] ?? {}) };
    const set = new Set(bySteps[s] ?? []);
    if (checked) set.add(box);
    else set.delete(box);
    if (set.size > 0) bySteps[s] = [...set].sort((a, b) => a - b);
    else delete bySteps[s];
    if (Object.keys(bySteps).length > 0) byGuide[g] = bySteps;
    else delete byGuide[g];
    if (Object.keys(byGuide).length > 0) next[id] = byGuide;
    else delete next[id];
  }
  return next;
}

/**
 * Appui sur une case. Perso : ne touche que ce perso. Équipe : si la case est
 * cochée pour tous, la décoche pour tous ; sinon (décochée ou partielle), la
 * coche pour tous.
 */
export function toggleTask(
  state: UserState,
  ctx: ActiveContext | null,
  guideId: GuideId,
  step: number,
  box: number,
): UserState {
  const ids = contextMemberIds(state, ctx);
  if (ids.length === 0 || box < 0 || step < 0) return state;
  const checked = taskState(state, ctx, guideId, step, box) !== 'checked';
  return { ...state, checks: setTask(state.checks, ids, guideId, step, box, checked) };
}
