import { useLayoutEffect, useRef } from 'react';
import type { GuideStep } from '../api/types';
import { useEscape } from './components';

export function stepTitle(s: GuideStep): string {
  if (s.name?.trim()) return s.name.trim();
  const pos = `[${s.pos_x}, ${s.pos_y}]`;
  return s.map ? `${s.map} ${pos}` : pos;
}

/** Feuille listant toutes les étapes pour y sauter directement. */
export function StepSheet({
  steps,
  current,
  onPick,
  onClose,
}: {
  steps: GuideStep[];
  current: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const currentRef = useRef<HTMLButtonElement>(null);
  useEscape(onClose);

  // L'étape courante est visible (centrée) dès l'ouverture.
  useLayoutEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
    currentRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet step-sheet" role="dialog" aria-modal="true" aria-label="Aller à l’étape">
        <div className="grabber" />
        <h2>Aller à l’étape</h2>
        <ol className="list step-list">
          {steps.map((s, i) => (
            <li key={s.id || i}>
              <button
                ref={i === current ? currentRef : undefined}
                type="button"
                className={`list-item${i === current ? ' selected' : ''}`}
                aria-current={i === current ? 'step' : undefined}
                onClick={() => onPick(i)}
              >
                <span className="step-num">{i + 1}</span>
                <span className="grow ellipsis">{stepTitle(s)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
