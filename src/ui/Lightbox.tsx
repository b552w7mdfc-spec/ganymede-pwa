import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscape } from './components';

interface Transform {
  s: number;
  x: number;
  y: number;
}

const MIN = 1;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Image en plein écran : pincement pour zoomer, glisser pour déplacer, double appui. */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [t, setT] = useState<Transform>({ s: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    t0: Transform;
    d0: number;
    m0: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const lastTap = useRef(0);

  useEscape(onClose);

  // Empêche le défilement de la page derrière.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** Coordonnées relatives au centre de l'écran (origine de la transformation). */
  const rel = (p: { x: number; y: number }) => ({ x: p.x - window.innerWidth / 2, y: p.y - window.innerHeight / 2 });

  const snapshot = () => {
    const pts = [...pointers.current.values()];
    const a = pts[0]!;
    const b = pts[1] ?? a;
    return {
      d: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      m: rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
    };
  };

  const begin = () => {
    const { d, m } = snapshot();
    gesture.current = { t0: tRef.current, d0: d, m0: m, moved: gesture.current?.moved ?? false };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = null;
    begin();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const { d, m } = snapshot();
    if (Math.hypot(m.x - g.m0.x, m.y - g.m0.y) > 6 || Math.abs(d - g.d0) > 6) g.moved = true;
    if (pointers.current.size >= 2) {
      const s = clamp((g.t0.s * d) / g.d0, MIN, MAX);
      // Le point de l'image sous les doigts reste sous les doigts.
      const k = s / g.t0.s;
      setT({ s, x: m.x - (g.m0.x - g.t0.x) * k, y: m.y - (g.m0.y - g.t0.y) * k });
    } else if (g.t0.s > 1) {
      setT({ s: g.t0.s, x: g.t0.x + m.x - g.m0.x, y: g.t0.y + m.y - g.m0.y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (pointers.current.size > 0) {
      begin(); // reprise avec le doigt restant
      return;
    }
    gesture.current = null;
    if (tRef.current.s <= 1.02) setT({ s: 1, x: 0, y: 0 });
    if (g?.moved) return;
    // Appui simple / double appui
    const now = e.timeStamp;
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      const p = rel({ x: e.clientX, y: e.clientY });
      setT(tRef.current.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: -p.x * 1.5, y: -p.y * 1.5 });
    } else {
      lastTap.current = now;
      // Appui simple hors image, sans zoom : fermer.
      if (tRef.current.s === 1 && !(e.target instanceof HTMLImageElement)) onClose();
    }
  };

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image en plein écran"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        referrerPolicy="no-referrer"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}
      />
      <button
        type="button"
        className="lightbox-close"
        aria-label="Fermer"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
