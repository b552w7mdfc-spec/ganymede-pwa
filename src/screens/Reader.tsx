import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { errorMessage } from '../api/client';
import { downloadGuide, findCachedSummary, isUpdateAvailable, loadGuide } from '../api/guides';
import type { CachedGuide } from '../api/types';
import { clampStep, contextGuideView } from '../model/progress';
import { stepTaskStates } from '../model/tasks';
import { nextFontScale } from '../model/settings';
import { FONT_SCALES } from '../model/types';
import { toast } from '../store/toastStore';
import { useNavStore } from '../store/navStore';
import { useUserStore } from '../store/userStore';
import { copyText } from '../ui/clipboard';
import { Banner, contextInfo } from '../ui/components';
import { Lightbox } from '../ui/Lightbox';
import { hrefFor, navigate, replaceSilently } from '../ui/router';
import { StepContent, type GuideLink } from '../ui/StepContent';
import { renderStepHtml } from '../ui/stepHtml';
import { StepSheet } from '../ui/StepSheet';
import { useSwipe } from '../ui/useSwipe';
import { useWakeLock } from '../ui/useWakeLock';
import { useColorScheme } from '../ui/useColorScheme';

type LoadState =
  | { s: 'loading' }
  | { s: 'ready'; cached: CachedGuide }
  | { s: 'error'; message: string };

interface Props {
  guideId: number;
  /** Étape demandée par un lien (index 0), appliquée une fois à l'ouverture. */
  initialStep?: number;
}

export function Reader({ guideId, initialStep }: Props) {
  const user = useUserStore((st) => st.user);
  const openGuideAt = useUserStore((st) => st.openGuideAt);
  const openGuide = useUserStore((st) => st.openGuide);
  const step = useUserStore((st) => st.step);
  const alignTeam = useUserStore((st) => st.alignTeam);
  const toggleTask = useUserStore((st) => st.toggleTask);
  const navStack = useNavStore((st) => st.stack);
  const updateSettings = useUserStore((st) => st.updateSettings);
  const settings = user.settings;

  const [load, setLoad] = useState<LoadState>({ s: 'loading' });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  useWakeLock(settings.keepAwake);

  // Chargement : cache local, sinon un seul téléchargement via la file.
  useEffect(() => {
    let cancelled = false;
    setLoad({ s: 'loading' });
    setUpdateAvailable(false);
    setUpdateError(null);
    loadGuide(guideId).then(
      async (cached) => {
        if (cancelled) return;
        setLoad({ s: 'ready', cached });
        const summary = await findCachedSummary(guideId);
        if (!cancelled) setUpdateAvailable(isUpdateAvailable(summary, cached.guide));
      },
      (e: unknown) => !cancelled && setLoad({ s: 'error', message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [guideId]);

  const guide = load.s === 'ready' ? load.cached.guide : null;
  const total = guide?.steps.length ?? 0;

  // Ouverture : crée la progression (étape 0) pour le contexte actif, et
  // applique l'étape demandée par un lien. L'URL est ensuite nettoyée, donc
  // chaque étape présente dans l'URL est une nouvelle demande.
  const activeKey = user.active ? `${user.active.kind}:${user.active.id}` : '';
  useEffect(() => {
    if (!guide || !activeKey) return;
    if (initialStep !== undefined) {
      openGuideAt(guideId, guide.steps.length, initialStep);
      replaceSilently({ name: 'guide', id: guideId });
    } else {
      openGuide(guideId);
    }
  }, [guide, activeKey, guideId, initialStep, openGuide, openGuideAt]);

  const view = contextGuideView(user, user.active, guideId);
  const index = clampStep(view?.currentStep ?? 0, total);
  const current = guide?.steps[index];
  const scheme = useColorScheme();
  const rendered = useMemo(
    () => (current ? renderStepHtml(current.web_text, scheme) : { html: '', taskCount: 0 }),
    [current, scheme],
  );
  const taskStates = useMemo(
    () => stepTaskStates(user, user.active, guideId, index, rendered.taskCount),
    [user, guideId, index, rendered.taskCount],
  );
  const info = contextInfo(user, user.active);

  // À chaque changement d'étape : retour en haut du contenu.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index, guideId]);

  const canStep = !!user.active && total > 0;
  useSwipe(
    screenRef,
    (dir) => {
      if (dir === 'left' && index < total - 1) step(guideId, total, { type: 'next' });
      else if (dir === 'right' && index > 0) step(guideId, total, { type: 'prev' });
    },
    canStep && !sheetOpen && !zoomSrc,
  );

  const fontIdx = Math.max(0, FONT_SCALES.findIndex((f) => f >= settings.fontScale - 1e-6));
  // Lit l'état courant du store : deux appuis rapides comptent bien double.
  const setFont = (delta: number) =>
    updateSettings({ fontScale: nextFontScale(useUserStore.getState().user.settings.fontScale, delta) });

  const copyTravel = (x: number, y: number) => {
    const cmd = `/travel ${x},${y}`;
    void copyText(cmd).then((ok) => toast(ok ? `Copié : ${cmd}` : 'Copie impossible'));
  };

  const doUpdate = async () => {
    setUpdating(true);
    setUpdateError(null);
    try {
      const cached = await downloadGuide(guideId);
      setLoad({ s: 'ready', cached });
      setUpdateAvailable(false);
    } catch (e) {
      setUpdateError(errorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  const onGuideLink = (link: GuideLink) => {
    if (!guide) return;
    if (link.guideId === 0 || link.guideId === guideId) {
      step(guideId, total, { type: 'goto', step: link.stepNumber - 1 });
      return;
    }
    useNavStore.getState().push({ guideId, step: index, guideName: guide.name });
    // stepid = 0 : ouvrir là où en est le contexte actif.
    navigate(
      link.stepId === 0
        ? { name: 'guide', id: link.guideId }
        : { name: 'guide', id: link.guideId, step: link.stepNumber - 1 },
    );
  };

  const goBackInStack = () => {
    const top = useNavStore.getState().pop();
    if (top) navigate({ name: 'guide', id: top.guideId, step: top.step });
  };

  const back = navStack[navStack.length - 1];
  const backButton =
    back && back.guideId !== guideId ? (
      <button
        type="button"
        className="btn back-link"
        onClick={goBackInStack}
        aria-label={`Retour à ${back.guideName}, étape ${back.step + 1}`}
      >
        <span aria-hidden="true">←</span>
        <span className="ellipsis">Retour à {back.guideName}</span>
        <span style={{ flex: 'none' }}>, étape {back.step + 1}</span>
      </button>
    ) : null;

  if (load.s === 'loading') {
    return (
      <div className="screen">
        {backButton}
        <p className="muted">Chargement du guide…</p>
      </div>
    );
  }
  if (load.s === 'error') {
    return (
      <div className="screen">
        {backButton}
        <Banner kind="error">
          <strong>Impossible d’ouvrir ce guide.</strong>
          <span>{load.message}</span>
        </Banner>
        <a className="btn" href={hrefFor({ name: 'catalog' })}>
          Retour au catalogue
        </a>
      </div>
    );
  }

  const g = load.cached.guide;
  const atLast = index >= total - 1;
  const finished = view?.finished ?? false;

  return (
    <div className="screen" ref={screenRef}>
      {backButton}
      <header className="reader-head">
        <h1>{g.name}</h1>
        <div className="reader-toolbar">
          <button
            type="button"
            className="btn step-counter"
            disabled={total === 0}
            onClick={() => setSheetOpen(true)}
            aria-label={`Étape ${index + 1} sur ${total}. Choisir une étape`}
          >
            Étape {total > 0 ? index + 1 : 0} / {total} <span aria-hidden="true">▾</span>
          </button>
          {finished ? <span className="badge ok">Terminé</span> : null}
          {view?.desync ? <span className="badge warn">Désynchronisé</span> : null}
          <span className="spacer" />
          <div className="font-controls" role="group" aria-label="Taille du texte">
            <button type="button" className="btn small" aria-label="Réduire le texte" disabled={fontIdx <= 0} onClick={() => setFont(-1)}>
              A−
            </button>
            <button
              type="button"
              className="btn small"
              aria-label="Agrandir le texte"
              disabled={fontIdx >= FONT_SCALES.length - 1}
              onClick={() => setFont(1)}
            >
              A+
            </button>
          </div>
        </div>
      </header>

      {!user.active ? (
        <Banner>
          <span>Crée un perso pour enregistrer ta progression.</span>
          <a className="btn small" href={hrefFor({ name: 'manage' })}>
            Créer un perso
          </a>
        </Banner>
      ) : null}

      {updateAvailable ? (
        <Banner kind="info">
          <span>Mise à jour disponible pour ce guide.</span>
          <button type="button" className="btn small" disabled={updating} onClick={() => void doUpdate()}>
            {updating ? 'Téléchargement…' : 'Mettre à jour'}
          </button>
        </Banner>
      ) : null}
      {updateError ? <Banner kind="error">{updateError}</Banner> : null}

      {view?.desync && user.active?.kind === 'team' ? (
        <Banner>
          <strong>Équipe désynchronisée</strong>
          <span className="small">
            {view.members
              .map((m) => {
                const name = user.characters.find((c) => c.id === m.characterId)?.name ?? '?';
                const p = m.progress;
                const label = p ? `étape ${clampStep(p.currentStep, total) + 1}${p.finished ? ' (terminé)' : ''}` : 'pas commencé';
                return `${name} : ${label}`;
              })
              .join(' · ')}
          </span>
          <button
            type="button"
            className="btn small"
            onClick={() => user.active && alignTeam(user.active.id, guideId, total, index)}
          >
            Aligner tout le monde sur l’étape {index + 1}
          </button>
        </Banner>
      ) : null}

      {current ? (
        <article className="card">
          {current.name ? <h2 style={{ marginBottom: 10 }}>{current.name}</h2> : null}
          <button
            type="button"
            className="btn travel no-swipe"
            onClick={() => copyTravel(current.pos_x, current.pos_y)}
            aria-label={`Copier /travel ${current.pos_x},${current.pos_y}`}
          >
            <span className="pos">
              [{current.pos_x}, {current.pos_y}]
            </span>
            {current.map ? <span className="travel-map ellipsis">{current.map}</span> : null}
            <span className="travel-hint">/travel</span>
          </button>
          <StepContent
            html={rendered.html}
            taskStates={taskStates}
            onToggleTask={(box) => toggleTask(guideId, index, box)}
            onGuideLink={onGuideLink}
            onImage={setZoomSrc}
            style={{ fontSize: `${settings.fontScale}rem` }}
          />
        </article>
      ) : (
        <p className="muted">Ce guide ne contient aucune étape.</p>
      )}

      {info ? <p className="muted small">Progression de : {info.name}</p> : null}

      {sheetOpen ? (
        <StepSheet
          steps={g.steps}
          current={index}
          onClose={() => setSheetOpen(false)}
          onPick={(i) => {
            setSheetOpen(false);
            step(guideId, total, { type: 'goto', step: i });
          }}
        />
      ) : null}
      {zoomSrc ? <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} /> : null}

      {createPortal(
        <div className="bottombar">
          <nav className="reader-nav" aria-label="Navigation dans le guide">
            <button
              type="button"
              className="btn"
              disabled={!canStep || (index === 0 && !finished)}
              onClick={() => step(guideId, total, { type: 'prev' })}
            >
              ‹ Précédent
            </button>
            <button
              type="button"
              className="btn primary next"
              disabled={!canStep || (atLast && finished)}
              onClick={() => step(guideId, total, { type: 'next' })}
            >
              {atLast ? (finished ? 'Terminé ✓' : 'Terminer ✓') : 'Suivant ›'}
            </button>
          </nav>
        </div>,
        document.body,
      )}
    </div>
  );
}
