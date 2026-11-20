import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, ApiError, apiGet } from './client';
import {
  LIST_TTL_MS,
  __resetCacheForTests,
  findCachedSummary,
  getGuideList,
  getGuideMeta,
  isUpdateAvailable,
  loadGuide,
} from './guides';
import { SerialQueue } from './queue';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const summary = (id: number, status = 'certified', updated_at = '2026-01-01T00:00:00.000000Z') => ({
  id, name: `G${id}`, status, lang: 'fr', game_type: 'dofus', web_description: null, likes: 0,
  dislikes: 0, downloads: 0, order: 0, updated_at, node_image: null,
  user: { id: 1, name: 'x', is_admin: 0, is_certified: 1, roles: [{ id: 1 }] },
});
const detail = (id: number, steps = 3) => ({
  ...summary(id), description: null,
  steps: Array.from({ length: steps }, (_, i) => ({ id: i, name: null, map: null, pos_x: i, pos_y: -i, web_text: `<p>${i}</p>` })),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await __resetCacheForTests();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SerialQueue', () => {
  it('exécute les tâches une par une, dans l’ordre', async () => {
    const q = new SerialQueue();
    const log: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const task = (name: string) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      log.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, 5));
      log.push(`end ${name}`);
      running--;
      return name;
    };
    const results = await Promise.all([q.run('a', task('a')), q.run('b', task('b')), q.run('c', task('c'))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(maxRunning).toBe(1);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('dédoublonne une même clé en cours', async () => {
    const q = new SerialQueue();
    const fn = vi.fn(async () => 1);
    const [x, y] = await Promise.all([q.run('k', fn), q.run('k', fn)]);
    expect([x, y]).toEqual([1, 1]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('continue après une erreur', async () => {
    const q = new SerialQueue();
    await expect(q.run('a', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await expect(q.run('b', async () => 2)).resolves.toBe(2);
  });

  it('après un 429, refuse les tâches suivantes sans les lancer, jusqu’à l’échéance', async () => {
    let now = 1000;
    const q = new SerialQueue(() => now);
    await expect(
      q.run('a', async () => { throw new ApiError('rate-limit', 'trop', { retryAt: 5000 }); }),
    ).rejects.toMatchObject({ kind: 'rate-limit' });
    const fn = vi.fn(async () => 'ok');
    await expect(q.run('b', fn)).rejects.toMatchObject({ kind: 'rate-limit', retryAt: 5000 });
    expect(fn).not.toHaveBeenCalled();
    expect(q.blockedUntilMs).toBe(5000);
    now = 5001;
    await expect(q.run('c', fn)).resolves.toBe('ok');
    expect(q.blockedUntilMs).toBe(0);
  });
});

describe('liste des guides', () => {
  it('appelle toujours avec un status explicite et filtre les brouillons éventuels', async () => {
    fetchMock.mockResolvedValueOnce(json([summary(1), summary(2, 'draft')]));
    const r = await getGuideList('certified', { now: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE}/guides?status=certified`);
    expect(r.list.guides.map((g) => g.id)).toEqual([1]);
    // Les champs inutiles (roles) ne sont pas stockés.
    expect(r.list.guides[0]?.user).toEqual({ id: 1, name: 'x', is_admin: false, is_certified: true });
  });

  it('refuse un statut inconnu', async () => {
    await expect(getGuideList('draft' as never)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('utilise le cache pendant 24 h, puis re-télécharge', async () => {
    fetchMock.mockResolvedValue(json([summary(1)]));
    await getGuideList('public', { now: 0 });
    await getGuideList('public', { now: LIST_TTL_MS - 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(json([summary(1), summary(3, 'public')].map((g) => ({ ...g, status: 'public' }))));
    const r = await getGuideList('public', { now: LIST_TTL_MS + 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.list.guides).toHaveLength(2);
  });

  it('« actualiser » force le téléchargement', async () => {
    fetchMock.mockResolvedValue(json([summary(1, 'gp')]));
    await getGuideList('gp', { now: 0 });
    await getGuideList('gp', { now: 1, force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hors-ligne : renvoie le cache périmé avec l’erreur', async () => {
    fetchMock.mockResolvedValueOnce(json([summary(1)]));
    await getGuideList('certified', { now: 0 });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const r = await getGuideList('certified', { now: LIST_TTL_MS * 2 });
    expect(r.list.guides).toHaveLength(1);
    expect(r.error).toBeInstanceOf(ApiError);
    expect((r.error as ApiError).kind).toBe('network');
  });

  it('hors-ligne sans cache : lève une erreur claire', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(getGuideList('certified')).rejects.toMatchObject({ kind: 'network' });
  });

  it('findCachedSummary lit les listes en cache sans réseau', async () => {
    fetchMock.mockResolvedValueOnce(json([summary(7)]));
    await getGuideList('certified', { now: 0 });
    fetchMock.mockClear();
    expect((await findCachedSummary(7))?.name).toBe('G7');
    expect(await findCachedSummary(8)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('détail d’un guide', () => {
  it('télécharge une fois puis sert depuis le cache permanent', async () => {
    fetchMock.mockResolvedValueOnce(json(detail(5, 4)));
    const a = await loadGuide(5);
    expect(a.guide.steps).toHaveLength(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE}/guides/5`);
    const b = await loadGuide(5);
    expect(b.guide.id).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getGuideMeta(5)).toMatchObject({ id: 5, name: 'G5', totalSteps: 4 });
  });

  it('429 : message clair, aucune nouvelle tentative automatique', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'Too Many' }, 429, { 'retry-after': '30' }));
    await expect(loadGuide(9001)).rejects.toMatchObject({ kind: 'rate-limit', status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // La demande suivante est refusée localement sans toucher au serveur.
    await expect(loadGuide(9002)).rejects.toMatchObject({ kind: 'rate-limit' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('404 : erreur « introuvable »', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404));
    await expect(apiGet('/guides/123456789')).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('isUpdateAvailable', () => {
  it('compare les updated_at', () => {
    const old = { updated_at: '2026-01-01T00:00:00.000000Z' };
    const recent = { updated_at: '2026-02-01T00:00:00.000000Z' };
    expect(isUpdateAvailable(recent, old)).toBe(true);
    expect(isUpdateAvailable(old, recent)).toBe(false);
    expect(isUpdateAvailable(old, old)).toBe(false);
    expect(isUpdateAvailable(undefined, old)).toBe(false);
    expect(isUpdateAvailable({ updated_at: 'n/a' }, old)).toBe(false);
  });
});
