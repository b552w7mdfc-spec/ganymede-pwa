/** Identifiant d'un guide côté API (entier). */
export type GuideId = number;

export interface Character {
  id: string;
  name: string;
  className?: string;
  level?: number;
  /** Couleur de la pastille, ex. "#d9534f". */
  color: string;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  /** Au moins 2 membres. */
  memberIds: string[];
}

export interface GuideProgress {
  /** Index 0 de l'étape courante. */
  currentStep: number;
  updatedAt: number;
  finished: boolean;
}

/** progress[characterId][guideId] */
export type ProgressMap = Record<string, Record<string, GuideProgress>>;

export interface ActiveContext {
  kind: 'character' | 'team';
  id: string;
}

export const SCHEMA_VERSION = 1;

export interface UserState {
  schemaVersion: typeof SCHEMA_VERSION;
  characters: Character[];
  teams: Team[];
  progress: ProgressMap;
  active: ActiveContext | null;
}

export function emptyUserState(): UserState {
  return { schemaVersion: SCHEMA_VERSION, characters: [], teams: [], progress: {}, active: null };
}
