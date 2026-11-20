import { useEffect, useRef, type RefObject } from 'react';

/** Distance horizontale minimale (px) : seuil franc pour éviter les faux départs. */
export const SWIPE_MIN_DX = 80;
/** Le geste doit être nettement plus horizontal que vertical. */
export const SWIPE_RATIO = 2;
const MAX_DURATION_MS = 800;
/** Zone aux bords de l'écran laissée au système (gestes iOS). */
const EDGE_PX = 24;

export type SwipeDirection = 'left' | 'right';

/** Décide si un geste est un balayage horizontal (pur, testable). */
export function classifySwipe(dx: number, dy: number, durationMs: number): SwipeDirection | null {
  if (durationMs > MAX_DURATION_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_DX) return null;
  if (Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return null;
  return dx < 0 ? 'left' : 'right';
}

function selectionActive(): boolean {
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;
}

function inHorizontalScroller(el: Element | null, stop: Element): boolean {
  for (let e = el; e && e !== stop; e = e.parentElement) {
    if (e.scrollWidth > e.clientWidth + 2) {
      const ox = getComputedStyle(e).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Balayage horizontal sur un élément. Écouteurs passifs : le défilement
 * vertical n'est jamais bloqué. Ignoré si du texte est sélectionné, si le
 * geste part du bord de l'écran, d'un champ, ou à plusieurs doigts.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (dir: SwipeDirection) => void, enabled = true): void {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      if (t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX) return;
      const target = e.target as Element;
      if (target.closest('input, textarea, select, .no-swipe')) return;
      if (inHorizontalScroller(target, el)) return;
      if (selectionActive()) return;
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const s = start;
      start = null;
      if (!t || selectionActive()) return;
      const dir = classifySwipe(t.clientX - s.x, t.clientY - s.y, e.timeStamp - s.t);
      if (dir) cb.current(dir);
    };
    const onCancel = () => {
      start = null;
    };
    const onMulti = (e: TouchEvent) => {
      if (e.touches.length > 1) start = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMulti, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMulti);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [ref, enabled]);
}
