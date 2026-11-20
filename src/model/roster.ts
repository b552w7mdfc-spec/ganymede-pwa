import type { ActiveContext, Character, Team, UserState } from './types';

export const CHARACTER_COLORS = [
  '#d9534f', '#e8873a', '#d4b106', '#4caf50', '#1fa3a3', '#3b7dd8', '#7e57c2', '#c2569b',
] as const;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addCharacter(
  state: UserState,
  input: { name: string; className?: string; level?: number; color: string },
  now: number,
  id: string = newId(),
): UserState {
  const name = input.name.trim();
  if (!name) return state;
  const character: Character = { id, name, color: input.color, createdAt: now };
  if (input.className?.trim()) character.className = input.className.trim();
  if (input.level !== undefined && Number.isFinite(input.level)) character.level = input.level;
  return {
    ...state,
    characters: [...state.characters, character],
    // Premier perso créé : il devient actif.
    active: state.active ?? { kind: 'character', id },
  };
}

export function updateCharacter(
  state: UserState,
  id: string,
  patch: Partial<Pick<Character, 'name' | 'className' | 'level' | 'color'>>,
): UserState {
  return {
    ...state,
    characters: state.characters.map((c) => {
      if (c.id !== id) return c;
      const next: Character = { ...c, ...patch };
      next.name = (patch.name ?? c.name).trim() || c.name;
      if (!next.className?.trim()) delete next.className;
      if (next.level === undefined || !Number.isFinite(next.level)) delete next.level;
      return next;
    }),
  };
}

/**
 * Supprime un perso, sa progression, et le retire des équipes. Une équipe qui
 * tombe sous 2 membres est supprimée. Le contexte actif est réinitialisé s'il
 * désignait un élément disparu.
 */
export function removeCharacter(state: UserState, id: string): UserState {
  const characters = state.characters.filter((c) => c.id !== id);
  const teams = state.teams
    .map((t) => ({ ...t, memberIds: t.memberIds.filter((m) => m !== id) }))
    .filter((t) => t.memberIds.length >= 2);
  const progress = { ...state.progress };
  delete progress[id];
  const checks = { ...state.checks };
  delete checks[id];
  const next: UserState = { ...state, characters, teams, progress, checks };
  return { ...next, active: validActive(next, state.active) };
}

export function addTeam(
  state: UserState,
  input: { name: string; memberIds: string[] },
  id: string = newId(),
): UserState {
  const memberIds = [...new Set(input.memberIds)].filter((m) =>
    state.characters.some((c) => c.id === m),
  );
  const name = input.name.trim();
  if (!name || memberIds.length < 2) return state;
  const team: Team = { id, name, memberIds };
  return { ...state, teams: [...state.teams, team] };
}

export function updateTeam(
  state: UserState,
  id: string,
  patch: { name?: string; memberIds?: string[] },
): UserState {
  return {
    ...state,
    teams: state.teams.map((t) => {
      if (t.id !== id) return t;
      const name = patch.name?.trim() || t.name;
      const memberIds = patch.memberIds
        ? [...new Set(patch.memberIds)].filter((m) => state.characters.some((c) => c.id === m))
        : t.memberIds;
      return memberIds.length >= 2 ? { ...t, name, memberIds } : { ...t, name };
    }),
  };
}

export function removeTeam(state: UserState, id: string): UserState {
  const next = { ...state, teams: state.teams.filter((t) => t.id !== id) };
  return { ...next, active: validActive(next, state.active) };
}

/** Renvoie le contexte s'il existe encore, sinon le premier perso, sinon null. */
export function validActive(state: UserState, ctx: ActiveContext | null): ActiveContext | null {
  if (ctx?.kind === 'character' && state.characters.some((c) => c.id === ctx.id)) return ctx;
  if (ctx?.kind === 'team' && state.teams.some((t) => t.id === ctx.id)) return ctx;
  const first = state.characters[0];
  return first ? { kind: 'character', id: first.id } : null;
}

export function setActive(state: UserState, ctx: ActiveContext): UserState {
  return { ...state, active: validActive(state, ctx) };
}
