import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { getGuideList } from '../api/guides';
import { GUIDE_LANGS, type CachedList, type GuideLang, type GuideStatus } from '../api/types';
import { contextMemberIds } from '../model/progress';
import { useUserStore } from '../store/userStore';
import { Banner, formatAgo } from '../ui/components';
import { hrefFor } from '../ui/router';

const STATUS_LABELS: Record<GuideStatus, string> = {
  gp: 'GP',
  certified: 'Certifiés',
  public: 'Publics',
};

const LANG_LABELS: Record<GuideLang | 'all', string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  all: 'Toutes les langues',
};

/** Minuscules, sans accents, pour la recherche. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Filtres conservés le temps de la session (retour depuis un guide).
let lastFilters: { status: GuideStatus; lang: GuideLang | 'all'; query: string } = {
  status: 'gp',
  lang: 'fr',
  query: '',
};

export function Catalog() {
  const [status, setStatus] = useState<GuideStatus>(lastFilters.status);
  const [lang, setLang] = useState<GuideLang | 'all'>(lastFilters.lang);
  const [query, setQuery] = useState(lastFilters.query);
  const [list, setList] = useState<CachedList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lastFilters = { status, lang, query };
  }, [status, lang, query]);

  const user = useUserStore((s) => s.user);
  const startedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const cid of contextMemberIds(user, user.active))
      for (const k of Object.keys(user.progress[cid] ?? {})) ids.add(Number(k));
    return ids;
  }, [user]);

  const load = useCallback(async (s: GuideStatus, force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const r = await getGuideList(s, { force });
      setList(r.list);
      if (r.error) setError(`${errorMessage(r.error)} Affichage de la copie locale.`);
    } catch (e) {
      setList(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status, false);
  }, [status, load]);

  const guides = useMemo(() => {
    if (!list || list.status !== status) return [];
    const q = normalize(query);
    return list.guides
      .filter((g) => g.game_type === 'dofus')
      .filter((g) => lang === 'all' || g.lang === lang)
      .filter((g) => !q || normalize(g.name).includes(q))
      .sort((a, b) => (status === 'gp' ? a.order - b.order || a.id - b.id : b.downloads - a.downloads));
  }, [list, status, lang, query]);

  return (
    <div className="screen">
      <h1>Catalogue</h1>

      <div className="field">
        <label htmlFor="search">Rechercher</label>
        <input
          id="search"
          className="input"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Nom du guide"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="segmented" role="group" aria-label="Statut">
        {(Object.keys(STATUS_LABELS) as GuideStatus[]).map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="row">
        <select
          className="input grow"
          aria-label="Langue"
          value={lang}
          onChange={(e) => setLang(e.target.value as GuideLang | 'all')}
        >
          {[...GUIDE_LANGS, 'all' as const].map((l) => (
            <option key={l} value={l}>
              {LANG_LABELS[l]}
            </option>
          ))}
        </select>
        <button type="button" className="btn" disabled={loading} onClick={() => void load(status, true)}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {list && list.status === status ? (
        <p className="muted small" style={{ margin: 0 }}>
          {guides.length} guide{guides.length > 1 ? 's' : ''} · liste mise à jour {formatAgo(list.fetchedAt)}
        </p>
      ) : null}

      {loading && !list ? <p className="muted">Chargement de la liste…</p> : null}

      <ul className="list">
        {guides.map((g) => (
          <li key={g.id}>
            <a className="list-item" href={hrefFor({ name: 'guide', id: g.id })}>
              <span className="grow">
                <span className="title">{g.name}</span>
                <div className="sub">
                  {g.user?.name ?? 'Auteur inconnu'} · {g.downloads.toLocaleString('fr-FR')} téléch.
                  {lang === 'all' ? ` · ${g.lang.toUpperCase()}` : ''}
                </div>
              </span>
              {startedIds.has(g.id) ? <span className="badge ok">En cours</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
