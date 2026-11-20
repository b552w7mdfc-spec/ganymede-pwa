import { clear, createStore, get, set, type UseStore } from 'idb-keyval';
import { ApiError, apiGet } from './client';
import { SerialQueue } from './queue';
import {
  GUIDE_STATUSES,
  type CachedGuide,
  type CachedList,
  type GuideDetail,
  type GuideMeta,
  type GuideStatus,
  type GuideSummary,
} from './types';

/** Durée de validité du cache de la liste. */
export const LIST_TTL_MS = 24 * 60 * 60 * 1000;

let store: UseStore | undefined;
function db(): UseStore {
  store ??= createStore('guide-dofus-api', 'cache');
  return store;
}

/** File unique pour toutes les requêtes de détail. */
export const detailQueue = new SerialQueue();

const listKey = (s: GuideStatus) => `list:${s}`;
const guideKey = (id: number) => `guide:${id}`;
const metaKey = (id: number) => `meta:${id}`;

// ---------- Validation légère des réponses ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const strOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

function toAuthor(v: unknown): GuideSummary['user'] {
  if (!isObj(v)) return null;
  return {
    id: num(v.id),
    name: str(v.name),
    is_admin: Boolean(v.is_admin),
    is_certified: Boolean(v.is_certified),
  };
}

export function toSummary(v: unknown): GuideSummary | null {
  if (!isObj(v) || typeof v.id !== 'number' || typeof v.name !== 'string') return null;
  return {
    id: v.id,
    name: v.name,
    status: str(v.status),
    lang: str(v.lang),
    game_type: str(v.game_type),
    web_description: strOrNull(v.web_description),
    likes: num(v.likes),
    dislikes: num(v.dislikes),
    downloads: num(v.downloads),
    order: num(v.order),
    updated_at: str(v.updated_at),
    node_image: strOrNull(v.node_image),
    user: toAuthor(v.user),
  };
}

export function toDetail(v: unknown): GuideDetail {
  if (!isObj(v) || typeof v.id !== 'number' || !Array.isArray(v.steps))
    throw new ApiError('format', 'Format de guide inattendu.');
  return {
    id: v.id,
    name: str(v.name, `Guide ${v.id}`),
    description: strOrNull(v.description),
    status: str(v.status),
    likes: num(v.likes),
    dislikes: num(v.dislikes),
    updated_at: str(v.updated_at),
    user: toAuthor(v.user),
    lang: str(v.lang),
    order: num(v.order),
    game_type: str(v.game_type),
    node_image: strOrNull(v.node_image),
    steps: v.steps.filter(isObj).map((s) => ({
      id: num(s.id),
      name: strOrNull(s.name),
      map: strOrNull(s.map),
      pos_x: num(s.pos_x),
      pos_y: num(s.pos_y),
      web_text: str(s.web_text),
    })),
  };
}

// ---------- Liste ----------

const memLists = new Map<GuideStatus, CachedList>();

export async function getCachedList(status: GuideStatus): Promise<CachedList | undefined> {
  const mem = memLists.get(status);
  if (mem) return mem;
  const cached = await get<CachedList>(listKey(status), db());
  if (cached) memLists.set(status, cached);
  return cached;
}

export interface ListResult {
  list: CachedList;
  /** Erreur rencontrée en tentant d'actualiser (on renvoie alors le cache). */
  error?: unknown;
}

const listInFlight = new Map<GuideStatus, Promise<CachedList>>();

/**
 * Liste des guides pour un statut. Toujours filtrée par statut (jamais
 * d'appel sans `status`, pour ne pas récupérer les brouillons).
 * Utilise le cache s'il a moins de 24 h, sauf `force`.
 */
export async function getGuideList(
  status: GuideStatus,
  opts: { force?: boolean; now?: number } = {},
): Promise<ListResult> {
  if (!GUIDE_STATUSES.includes(status)) throw new Error(`Statut invalide : ${String(status)}`);
  const now = opts.now ?? Date.now();
  const cached = await getCachedList(status);
  if (cached && !opts.force && now - cached.fetchedAt < LIST_TTL_MS) return { list: cached };

  try {
    let p = listInFlight.get(status);
    if (!p) {
      p = (async () => {
        const raw = await apiGet(`/guides?status=${encodeURIComponent(status)}`);
        if (!Array.isArray(raw)) throw new ApiError('format', 'Format de liste inattendu.');
        const guides = raw
          .map(toSummary)
          .filter((g): g is GuideSummary => g !== null && g.status === status);
        const list: CachedList = { status, fetchedAt: now, guides };
        await set(listKey(status), list, db());
        memLists.set(status, list);
        return list;
      })();
      listInFlight.set(status, p);
      p.then(
        () => listInFlight.delete(status),
        () => listInFlight.delete(status),
      );
    }
    return { list: await p };
  } catch (error) {
    if (cached) return { list: cached, error };
    throw error;
  }
}

/** Cherche un guide dans les listes en cache (sans réseau). */
export async function findCachedSummary(id: number): Promise<GuideSummary | undefined> {
  for (const s of GUIDE_STATUSES) {
    const found = (await getCachedList(s))?.guides.find((g) => g.id === id);
    if (found) return found;
  }
  return undefined;
}

// ---------- Détail ----------

export async function getCachedGuide(id: number): Promise<CachedGuide | undefined> {
  return get<CachedGuide>(guideKey(id), db());
}

export async function getGuideMeta(id: number): Promise<GuideMeta | undefined> {
  return get<GuideMeta>(metaKey(id), db());
}

function toMeta(c: CachedGuide): GuideMeta {
  return {
    id: c.guide.id,
    name: c.guide.name,
    lang: c.guide.lang,
    status: c.guide.status,
    totalSteps: c.guide.steps.length,
    updated_at: c.guide.updated_at,
    fetchedAt: c.fetchedAt,
  };
}

/** Télécharge un guide via la file sérialisée et le met en cache permanent. */
export function downloadGuide(id: number): Promise<CachedGuide> {
  if (!Number.isInteger(id) || id <= 0) return Promise.reject(new Error(`Identifiant invalide : ${id}`));
  return detailQueue.run(guideKey(id), async () => {
    const guide = toDetail(await apiGet(`/guides/${id}`));
    const cached: CachedGuide = { fetchedAt: Date.now(), guide };
    await set(guideKey(id), cached, db());
    await set(metaKey(id), toMeta(cached), db());
    return cached;
  });
}

/**
 * Guide complet : depuis le cache s'il existe (cache permanent), sinon
 * téléchargé. À n'appeler qu'à l'ouverture ou à l'ajout d'un guide.
 */
export async function loadGuide(id: number): Promise<CachedGuide> {
  return (await getCachedGuide(id)) ?? downloadGuide(id);
}

/** Vrai si la liste annonce une version plus récente que la copie locale. */
export function isUpdateAvailable(
  summary: Pick<GuideSummary, 'updated_at'> | undefined,
  local: Pick<GuideMeta, 'updated_at'> | undefined,
): boolean {
  if (!summary || !local) return false;
  const remote = Date.parse(summary.updated_at);
  const mine = Date.parse(local.updated_at);
  return Number.isFinite(remote) && Number.isFinite(mine) && remote > mine;
}

/** Pour les tests uniquement : vide le cache mémoire et IndexedDB. */
export async function __resetCacheForTests(): Promise<void> {
  memLists.clear();
  listInFlight.clear();
  await clear(db());
}
