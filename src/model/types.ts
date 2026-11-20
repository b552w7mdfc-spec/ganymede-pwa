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

/**
 * Cases cochées : checks[characterId][guideId][stepIndex] = indices des cases
 * cochées dans l'étape (triés, sans doublon). Index d'étape à partir de 0,
 * index de case dans l'ordre d'apparition dans l'étape.
 */
export type ChecksMap = Record<string, Record<string, Record<string, number[]>>>;

export interface Settings {
  /** Garder l'écran allumé dans le lecteur. */
  keepAwake: boolean;
  /** Facteur de taille du texte du lecteur (1 = normal). */
  fontScale: number;
}

export const DEFAULT_SETTINGS: Settings = { keepAwake: true, fontScale: 1 };
export const FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75] as const;

export const SCHEMA_VERSION = 2;

export interface UserState {
  schemaVersion: typeof SCHEMA_VERSION;
  characters: Character[];
  teams: Team[];
  progress: ProgressMap;
  checks: ChecksMap;
  settings: Settings;
  active: ActiveContext | null;
}

export function emptyUserState(): UserState {
  return {
    schemaVersion: SCHEMA_VERSION,
    characters: [],
    teams: [],
    progress: {},
    checks: {},
    settings: { ...DEFAULT_SETTINGS },
    active: null,
  };
}
