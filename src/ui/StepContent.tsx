import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { TaskState } from '../model/tasks';
import { toast } from '../store/toastStore';
import { copyText } from './clipboard';
import { dofusDbUrl } from './stepHtml';

export interface GuideLink {
  /** 0 = même guide. */
  guideId: number;
  stepId: number;
  /** Numéro d'étape à partir de 1. */
  stepNumber: number;
}

interface Props {
  html: string;
  taskStates: TaskState[];
  onToggleTask: (index: number) => void;
  onGuideLink: (link: GuideLink) => void;
  onImage: (src: string) => void;
  style?: CSSProperties;
}

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

/**
 * Affiche le HTML (déjà nettoyé et transformé) d'une étape et gère ses
 * éléments interactifs par délégation d'événements.
 */
export function StepContent({ html, taskStates, onToggleTask, onGuideLink, onImage, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const press = useRef<{ el: HTMLElement; x: number; y: number; timer: number; armed: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Applique l'état des cases (cochée / décochée / intermédiaire). Lit la
  // dernière valeur via une ref : peut être rappelé de façon différée.
  const statesRef = useRef(taskStates);
  statesRef.current = taskStates;
  const syncTasks = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    for (const input of root.querySelectorAll<HTMLInputElement>('input[data-task-index]')) {
      const st = statesRef.current[Number(input.dataset.taskIndex)] ?? 'unchecked';
      input.checked = st === 'checked';
      input.indeterminate = st === 'mixed';
      input.closest('li')?.classList.toggle('task-done', st === 'checked');
    }
  }, []);

  useLayoutEffect(() => {
    syncTasks();
  });

  // ----- Appui long sur les pastilles -----

  const cancelPress = () => {
    const p = press.current;
    if (!p) return;
    clearTimeout(p.timer);
    p.el.classList.remove('armed');
    press.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const tag = (e.target as HTMLElement).closest<HTMLElement>('.ctag');
    suppressClick.current = false;
    if (!tag) return;
    cancelPress();
    const timer = window.setTimeout(() => {
      if (!press.current) return;
      press.current.armed = true;
      tag.classList.add('armed');
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
    press.current = { el: tag, x: e.clientX, y: e.clientY, timer, armed: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPress();
  };

  const onPointerUp = () => {
    const p = press.current;
    if (!p) return;
    if (p.armed) {
      // L'ouverture se fait au relâchement : c'est un geste utilisateur
      // reconnu par iOS (un window.open depuis un minuteur serait bloqué).
      suppressClick.current = true;
      const url = dofusDbUrl(p.el.dataset.tagType ?? '', p.el.dataset.dofusdbid ?? '');
      if (url) window.open(url, '_blank', 'noopener');
      else toast('Pas de fiche DofusDB pour cet élément');
    }
    cancelPress();
  };

  // ----- Clics -----

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Case à cocher (aussi déclenché par un appui sur son label).
    // NB : React ne synthétise pas onChange pour des champs injectés en HTML.
    if (target instanceof HTMLInputElement && target.dataset.taskIndex !== undefined) {
      onToggleTask(Number(target.dataset.taskIndex));
      // Remet l'affichage sur l'état réel (au cas où rien n'a changé).
      requestAnimationFrame(syncTasks);
      return;
    }

    const tag = target.closest<HTMLElement>('.ctag');
    if (tag) {
      e.preventDefault();
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      const name = tag.dataset.name ?? '';
      if (!name) return;
      void copyText(name).then((ok) => toast(ok ? `Copié : ${name}` : 'Copie impossible'));
      return;
    }

    const link = target.closest<HTMLElement>('.gstep');
    if (link) {
      e.preventDefault();
      onGuideLink({
        guideId: Number(link.dataset.guideid ?? 0),
        stepId: Number(link.dataset.stepid ?? 0),
        stepNumber: Math.max(1, Number(link.dataset.stepnumber ?? 1)),
      });
      return;
    }

    if (target instanceof HTMLImageElement && target.classList.contains('zoomable')) {
      onImage(target.currentSrc || target.src);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    if (t.matches('.ctag, .gstep')) {
      e.preventDefault();
      t.click();
    }
  };

  return (
    <div
      ref={ref}
      className="step-html"
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('.ctag')) e.preventDefault();
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
