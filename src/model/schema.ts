import { validActive } from './roster';
import {
  SCHEMA_VERSION,
  type ActiveContext,
  type Character,
  type GuideProgress,
  type ProgressMap,
  type Team,
  type UserState,
} from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseCharacter(v: unknown, i: number): Result<Character> {
  if (!isObj(v)) return { ok: false, error: `Perso n°${i + 1} : format invalide.` };
  if (!isStr(v.id) || !v.id) return { ok: false, error: `Perso n°${i + 1} : identifiant manquant.` };
  if (!isStr(v.name) || !v.name.trim()) return { ok: false, error: `Perso n°${i + 1} : nom manquant.` };
  if (!isStr(v.color)) return { ok: false, error: `Perso « ${v.name} » : couleur manquante.` };
  if (!isNum(v.createdAt)) return { ok: false, error: `Perso « ${v.name} » : date de création invalide.` };
  if (v.className !== undefined && !isStr(v.className))
    return { ok: false, error: `Perso « ${v.name} » : classe invalide.` };
  if (v.level !== undefined && !isNum(v.level))
    return { ok: false, error: `Perso « ${v.name} » : niveau invalide.` };
  const c: Character = { id: v.id, name: v.name, color: v.color, createdAt: v.createdAt };
  if (isStr(v.className)) c.className = v.className;
  if (isNum(v.level)) c.level = v.level;
  return { ok: true, value: c };
}

function parseTeam(v: unknown, i: number, characterIds: Set<string>): Result<Team> {
  if (!isObj(v)) return { ok: false, error: `Équipe n°${i + 1} : format invalide.` };
  if (!isStr(v.id) || !v.id) return { ok: false, error: `Équipe n°${i + 1} : identifiant manquant.` };
  if (!isStr(v.name) || !v.name.trim()) return { ok: false, error: `Équipe n°${i + 1} : nom manquant.` };
  if (!Array.isArray(v.memberIds) || !v.memberIds.every(isStr))
    return { ok: false, error: `Équipe « ${v.name} » : membres invalides.` };
  const unknown = v.memberIds.find((m) => !characterIds.has(m));
  if (unknown) return { ok: false, error: `Équipe « ${v.name} » : membre inconnu (${unknown}).` };
  if (new Set(v.memberIds).size < 2)
    return { ok: false, error: `Équipe « ${v.name} » : il faut au moins 2 membres.` };
  return { ok: true, value: { id: v.id, name: v.name, memberIds: [...new Set(v.memberIds)] } };
}

function parseProgress(v: unknown, characterIds: Set<string>): Result<ProgressMap> {
  if (!isObj(v)) return { ok: false, error: 'Progression : format invalide.' };
  const out: ProgressMap = {};
  for (const [charId, byGuide] of Object.entries(v)) {
    if (!characterIds.has(charId)) return { ok: false, error: `Progression : perso inconnu (${charId}).` };
    if (!isObj(byGuide)) return { ok: false, error: 'Progression : format invalide.' };
    const perGuide: Record<string, GuideProgress> = {};
    out[charId] = perGuide;
    for (const [guideId, p] of Object.entries(byGuide)) {
      if (!/^\d+$/.test(guideId)) return { ok: false, error: `Progression : guide invalide (${guideId}).` };
      if (!isObj(p) || !isNum(p.currentStep) || p.currentStep < 0 || !Number.isInteger(p.currentStep) ||
        !isNum(p.updatedAt) || typeof p.finished !== 'boolean')
        return { ok: false, error: `Progression du guide ${guideId} : valeurs invalides.` };
      const gp: GuideProgress = { currentStep: p.currentStep, updatedAt: p.updatedAt, finished: p.finished };
      perGuide[guideId] = gp;
    }
  }
  return { ok: true, value: out };
}

function parseActive(v: unknown): ActiveContext | null {
  if (!isObj(v)) return null;
  if ((v.kind === 'character' || v.kind === 'team') && isStr(v.id)) return { kind: v.kind, id: v.id };
  return null;
}

/** Valide un état utilisateur de la version de schéma courante. */
export function parseUserState(raw: unknown): Result<UserState> {
  if (!isObj(raw)) return { ok: false, error: 'Données illisibles.' };
  if (raw.schemaVersion !== SCHEMA_VERSION)
    return { ok: false, error: `Version de schéma non prise en charge (${String(raw.schemaVersion)}).` };
  if (!Array.isArray(raw.characters)) return { ok: false, error: 'Liste des persos manquante.' };
  if (!Array.isArray(raw.teams)) return { ok: false, error: 'Liste des équipes manquante.' };

  const characters: Character[] = [];
  for (const [i, c] of raw.characters.entries()) {
    const r = parseCharacter(c, i);
    if (!r.ok) return r;
    characters.push(r.value);
  }
  const ids = new Set(characters.map((c) => c.id));
  if (ids.size !== characters.length) return { ok: false, error: 'Identifiants de persos en double.' };

  const teams: Team[] = [];
  for (const [i, t] of raw.teams.entries()) {
    const r = parseTeam(t, i, ids);
    if (!r.ok) return r;
    teams.push(r.value);
  }
  if (new Set(teams.map((t) => t.id)).size !== teams.length)
    return { ok: false, error: 'Identifiants d’équipes en double.' };

  const progress = parseProgress(raw.progress ?? {}, ids);
  if (!progress.ok) return progress;

  const state: UserState = {
    schemaVersion: SCHEMA_VERSION,
    characters,
    teams,
    progress: progress.value,
    active: null,
  };
  state.active = validActive(state, parseActive(raw.active));
  return { ok: true, value: state };
}

/**
 * Migre des données stockées vers la version courante. Point d'entrée unique
 * pour les futures migrations (v1 -> v2, etc.).
 */
export function migrateUserState(raw: unknown): Result<UserState> {
  if (!isObj(raw)) return { ok: false, error: 'Données illisibles.' };
  // Aucune migration pour l'instant : v1 est la seule version.
  return parseUserState(raw);
}

// ---------- Export / import ----------

export const EXPORT_APP_ID = 'guide-dofus';

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  exportedAt: string;
  data: UserState;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildExport(state: UserState, now: Date): { filename: string; json: string } {
  const file: ExportFile = { app: EXPORT_APP_ID, exportedAt: now.toISOString(), data: state };
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return { filename: `guide-dofus-${stamp}.json`, json: JSON.stringify(file, null, 2) };
}

export function parseImport(text: string): Result<{ state: UserState; exportedAt: string | null }> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas un JSON valide.' };
  }
  if (!isObj(raw) || raw.app !== EXPORT_APP_ID || !isObj(raw.data))
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde Guide Dofus.' };
  const state = migrateUserState(raw.data);
  if (!state.ok) return state;
  return { ok: true, value: { state: state.value, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : null } };
}
