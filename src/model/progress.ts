import type { ActiveContext, GuideId, GuideProgress, ProgressMap, UserState } from './types';

/** Action d'avancement sur un guide. */
export type StepAction = { type: 'next' } | { type: 'prev' } | { type: 'goto'; step: number };

/** Vue d'un guide pour un contexte (perso seul ou équipe). */
export interface ContextGuideView {
  guideId: GuideId;
  /** Étape affichée : pour une équipe, la plus basse des membres. */
  currentStep: number;
  /** Vrai si tous les membres ont terminé. */
  finished: boolean;
  /** Vrai si les membres ne sont pas tous à la même étape. */
  desync: boolean;
  /** Date de dernière utilisation (max des membres). */
  updatedAt: number;
  /** Étape de chaque membre (absent = jamais commencé). */
  members: { characterId: string; progress: GuideProgress | undefined }[];
}

const key = (guideId: GuideId) => String(guideId);

export function clampStep(step: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), total - 1);
}

/** Identifiants des persos concernés par un contexte (persos existants uniquement). */
export function contextMemberIds(state: UserState, ctx: ActiveContext | null): string[] {
  if (!ctx) return [];
  const exists = (id: string) => state.characters.some((c) => c.id === id);
  if (ctx.kind === 'character') return exists(ctx.id) ? [ctx.id] : [];
  const team = state.teams.find((t) => t.id === ctx.id);
  return team ? team.memberIds.filter(exists) : [];
}

export function getProgress(
  progress: ProgressMap,
  characterId: string,
  guideId: GuideId,
): GuideProgress | undefined {
  return progress[characterId]?.[key(guideId)];
}

/**
 * Vue d'un guide pour un contexte. Renvoie null si aucun membre n'a commencé.
 * Un membre jamais commencé compte comme étant à l'étape 0.
 */
export function contextGuideView(
  state: UserState,
  ctx: ActiveContext | null,
  guideId: GuideId,
): ContextGuideView | null {
  const ids = contextMemberIds(state, ctx);
  const members = ids.map((characterId) => ({
    characterId,
    progress: getProgress(state.progress, characterId, guideId),
  }));
  if (members.length === 0 || members.every((m) => !m.progress)) return null;

  const steps = members.map((m) => m.progress?.currentStep ?? 0);
  const currentStep = Math.min(...steps);
  const desync = steps.some((s) => s !== steps[0]) ||
    members.some((m) => !m.progress) ||
    members.some((m) => (m.progress?.finished ?? false) !== (members[0]?.progress?.finished ?? false));
  return {
    guideId,
    currentStep,
    finished: members.every((m) => m.progress?.finished === true),
    desync,
    updatedAt: Math.max(...members.map((m) => m.progress?.updatedAt ?? 0)),
    members,
  };
}

function writeProgress(
  progress: ProgressMap,
  characterIds: string[],
  guideId: GuideId,
  value: (prev: GuideProgress | undefined) => GuideProgress,
): ProgressMap {
  const next: ProgressMap = { ...progress };
  for (const id of characterIds) {
    const byGuide = { ...(next[id] ?? {}) };
    byGuide[key(guideId)] = value(byGuide[key(guideId)]);
    next[id] = byGuide;
  }
  return next;
}

/**
 * Ouvre un guide pour un contexte : crée la progression à l'étape 0 pour
 * chaque membre qui ne l'a jamais commencé, et marque l'utilisation (updatedAt)
 * pour tous les membres.
 */
export function openGuide(
  state: UserState,
  ctx: ActiveContext | null,
  guideId: GuideId,
  now: number,
): UserState {
  const ids = contextMemberIds(state, ctx);
  if (ids.length === 0) return state;
  return {
    ...state,
    progress: writeProgress(state.progress, ids, guideId, (prev) =>
      prev ? { ...prev, updatedAt: now } : { currentStep: 0, updatedAt: now, finished: false },
    ),
  };
}

/**
 * Applique une action d'avancement. Pour une équipe, l'étape cible est
 * calculée depuis l'étape affichée (la plus basse) et appliquée à TOUS les
 * membres. Pour un perso, seul ce perso est modifié.
 *
 * « Suivant » sur la dernière étape marque le guide comme terminé.
 * Toute autre action le dé-marque.
 */
export function applyStepAction(
  state: UserState,
  ctx: ActiveContext | null,
  guideId: GuideId,
  totalSteps: number,
  action: StepAction,
  now: number,
): UserState {
  const ids = contextMemberIds(state, ctx);
  if (ids.length === 0 || totalSteps <= 0) return state;
  const view = contextGuideView(state, ctx, guideId);
  const from = clampStep(view?.currentStep ?? 0, totalSteps);
  const last = totalSteps - 1;

  let target: number;
  let finished = false;
  switch (action.type) {
    case 'next':
      if (from >= last) {
        target = last;
        finished = true;
      } else {
        target = from + 1;
      }
      break;
    case 'prev':
      target = clampStep(from - 1, totalSteps);
      break;
    case 'goto':
      target = clampStep(action.step, totalSteps);
      break;
  }

  return {
    ...state,
    progress: writeProgress(state.progress, ids, guideId, () => ({
      currentStep: target,
      updatedAt: now,
      finished,
    })),
  };
}

/** Aligne tous les membres d'une équipe sur une étape donnée. */
export function alignTeam(
  state: UserState,
  teamId: string,
  guideId: GuideId,
  totalSteps: number,
  step: number,
  now: number,
): UserState {
  return applyStepAction(state, { kind: 'team', id: teamId }, guideId, totalSteps, { type: 'goto', step }, now);
}

/**
 * Guides démarrés par un contexte, du plus récemment utilisé au plus ancien.
 * Pour une équipe : seulement les guides que TOUS les membres ont commencés
 * (un guide fait en solo par un membre n'apparaît pas dans l'équipe).
 */
export function startedGuides(state: UserState, ctx: ActiveContext | null): ContextGuideView[] {
  const ids = contextMemberIds(state, ctx);
  if (ids.length === 0) return [];
  const guideKeys = new Set<string>();
  for (const id of ids) for (const k of Object.keys(state.progress[id] ?? {})) guideKeys.add(k);

  const views: ContextGuideView[] = [];
  for (const k of guideKeys) {
    const guideId = Number(k);
    if (!ids.every((id) => getProgress(state.progress, id, guideId))) continue;
    const view = contextGuideView(state, ctx, guideId);
    if (view) views.push(view);
  }
  return views.sort((a, b) => b.updatedAt - a.updatedAt);
}
