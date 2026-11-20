import { useEffect, useMemo, useState } from 'react';
import { findCachedSummary, getGuideMeta, isUpdateAvailable } from '../api/guides';
import type { GuideMeta } from '../api/types';
import { startedGuides, type ContextGuideView } from '../model/progress';
import { useUserStore } from '../store/userStore';
import { contextInfo, formatAgo, ProgressBar } from '../ui/components';
import { hrefFor } from '../ui/router';

interface MetaInfo {
  meta: GuideMeta | undefined;
  updateAvailable: boolean;
}

/** Charge les infos légères des guides depuis le cache local (jamais le réseau). */
function useGuideMetas(ids: number[]): Record<number, MetaInfo> {
  const [metas, setMetas] = useState<Record<number, MetaInfo>>({});
  const key = ids.join(',');
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        const [meta, summary] = await Promise.all([getGuideMeta(id), findCachedSummary(id)]);
        return [id, { meta, updateAvailable: isUpdateAvailable(summary, meta) }] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setMetas(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return metas;
}

function stepLabel(view: ContextGuideView, total: number | undefined): string {
  if (!total) return `Étape ${view.currentStep + 1}`;
  return `Étape ${Math.min(view.currentStep + 1, total)} / ${total}`;
}

export function Home() {
  const user = useUserStore((s) => s.user);
  const views = useMemo(() => startedGuides(user, user.active), [user]);
  const metas = useGuideMetas(views.map((v) => v.guideId));
  const info = contextInfo(user, user.active);

  if (user.characters.length === 0) {
    return (
      <div className="screen">
        <div className="empty card">
          <h1>Bienvenue</h1>
          <p className="muted">Crée ton premier perso pour suivre ta progression dans les guides Ganymède.</p>
          <a className="btn primary big" href={hrefFor({ name: 'manage' })}>
            Créer un perso
          </a>
        </div>
      </div>
    );
  }

  const last = views[0];
  const lastMeta = last ? metas[last.guideId]?.meta : undefined;

  return (
    <div className="screen fill">
      <h1>En cours{info ? <span className="muted"> · {info.name}</span> : null}</h1>

      {views.length === 0 ? (
        <div className="empty card">
          <p className="muted">Aucun guide démarré pour {info?.name ?? 'ce contexte'}.</p>
          <a className="btn primary big" href={hrefFor({ name: 'catalog' })}>
            Choisir un guide
          </a>
        </div>
      ) : (
        <ul className="list">
          {views.map((v) => {
            const m = metas[v.guideId];
            const total = m?.meta?.totalSteps;
            return (
              <li key={v.guideId}>
                <a className="list-item" href={hrefFor({ name: 'guide', id: v.guideId })}>
                  <span className="grow">
                    <span className="title">{m?.meta?.name ?? `Guide n°${v.guideId}`}</span>
                    <div className="row small" style={{ gap: 6, marginTop: 2 }}>
                      <span className="muted">{stepLabel(v, total)}</span>
                      {v.finished ? <span className="badge ok">Terminé</span> : null}
                      {v.desync ? <span className="badge warn">Désynchronisé</span> : null}
                      {m?.updateAvailable ? <span className="badge warn">Mise à jour dispo</span> : null}
                    </div>
                    <ProgressBar value={v.finished ? (total ?? 0) : v.currentStep + 1} total={total ?? 0} />
                    <div className="sub">{formatAgo(v.updatedAt)}</div>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {last ? (
        <div style={{ position: 'sticky', bottom: 'calc(var(--bottom-h) + var(--safe-bottom) + 12px)', marginTop: 'auto' }}>
          <a className="btn primary big" href={hrefFor({ name: 'guide', id: last.guideId })}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Reprendre{lastMeta ? ` « ${lastMeta.name} »` : ''}
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
