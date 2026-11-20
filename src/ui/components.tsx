import { useEffect, useRef, type ReactNode } from 'react';
import type { ActiveContext, Character, UserState } from '../model/types';
import { useDialogStore } from '../store/dialogStore';
import { useUserStore } from '../store/userStore';
import { hrefFor, type Route } from './router';

// ---------- Contexte actif ----------

export interface ContextInfo {
  ctx: ActiveContext;
  name: string;
  colors: string[];
  detail: string;
}

function describeCharacter(c: Character): string {
  return [c.className, c.level !== undefined ? `niv. ${c.level}` : undefined].filter(Boolean).join(' · ');
}

export function contextInfo(state: UserState, ctx: ActiveContext | null): ContextInfo | null {
  if (!ctx) return null;
  if (ctx.kind === 'character') {
    const c = state.characters.find((x) => x.id === ctx.id);
    return c ? { ctx, name: c.name, colors: [c.color], detail: describeCharacter(c) } : null;
  }
  const t = state.teams.find((x) => x.id === ctx.id);
  if (!t) return null;
  const members = t.memberIds
    .map((id) => state.characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
  return {
    ctx,
    name: t.name,
    colors: members.map((m) => m.color),
    detail: members.map((m) => m.name).join(' + '),
  };
}

export function Dots({ colors }: { colors: string[] }) {
  return (
    <span className="dots" aria-hidden="true">
      {colors.map((c, i) => (
        <span key={i} className="dot" style={{ background: c }} />
      ))}
    </span>
  );
}

export function ContextPill({ onOpen }: { onOpen: () => void }) {
  const user = useUserStore((s) => s.user);
  const info = contextInfo(user, user.active);
  return (
    <button type="button" className="context-pill" onClick={onOpen} aria-label="Changer de perso ou d’équipe">
      {info ? <Dots colors={info.colors} /> : null}
      <span className="name">{info ? info.name : 'Aucun perso'}</span>
      <span className="chevron" aria-hidden="true">▼</span>
    </button>
  );
}

// ---------- Feuille de changement de contexte ----------

export function ContextSheet({ onClose }: { onClose: () => void }) {
  const user = useUserStore((s) => s.user);
  const setActive = useUserStore((s) => s.setActive);
  const choose = (ctx: ActiveContext) => {
    setActive(ctx);
    onClose();
  };
  const isActive = (ctx: ActiveContext) => user.active?.kind === ctx.kind && user.active.id === ctx.id;

  useEscape(onClose);

  const entries: ContextInfo[] = [
    ...user.characters.map((c) => contextInfo(user, { kind: 'character', id: c.id })),
    ...user.teams.map((t) => contextInfo(user, { kind: 'team', id: t.id })),
  ].filter((x): x is ContextInfo => x !== null);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Qui joues-tu ?">
        <div className="grabber" />
        <h2>Qui joues-tu ?</h2>
        {entries.length === 0 ? (
          <p className="muted">Aucun perso pour l’instant.</p>
        ) : (
          <ul className="list">
            {entries.map((e) => (
              <li key={`${e.ctx.kind}:${e.ctx.id}`}>
                <button
                  type="button"
                  className={`list-item${isActive(e.ctx) ? ' selected' : ''}`}
                  onClick={() => choose(e.ctx)}
                  aria-current={isActive(e.ctx) ? 'true' : undefined}
                >
                  <Dots colors={e.colors} />
                  <span className="grow">
                    <span className="title">{e.name}</span>
                    {e.ctx.kind === 'team' ? <span className="badge" style={{ marginLeft: 8 }}>équipe</span> : null}
                    {e.detail ? <div className="sub">{e.detail}</div> : null}
                  </span>
                  {isActive(e.ctx) ? <span aria-hidden="true">✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <a className="btn" href={hrefFor({ name: 'manage' })} onClick={onClose}>
          Gérer les persos et équipes
        </a>
      </div>
    </>
  );
}

// ---------- Fenêtre de confirmation intégrée ----------

export function ConfirmDialog() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (current) confirmRef.current?.focus();
  }, [current]);
  useEscape(() => close(false), !!current);

  if (!current) return null;
  return (
    <>
      <div className="backdrop dialog-backdrop" onClick={() => close(false)} />
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{current.title}</h2>
        {current.message ? <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{current.message}</p> : null}
        <div className="row">
          <button type="button" className="btn" onClick={() => close(false)}>
            {current.cancelLabel ?? 'Annuler'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${current.danger ? 'danger solid' : 'primary'}`}
            onClick={() => close(true)}
          >
            {current.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- Navigation du bas ----------

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: { name: 'home' }, label: 'En cours', icon: '▶' },
  { route: { name: 'catalog' }, label: 'Catalogue', icon: '☰' },
  { route: { name: 'manage' }, label: 'Gestion', icon: '⚙' },
];

export function BottomTabs({ current }: { current: Route['name'] }) {
  return (
    <nav className="tabs" aria-label="Navigation principale">
      {TABS.map((t) => (
        <a key={t.route.name} href={hrefFor(t.route)} aria-current={current === t.route.name ? 'page' : undefined}>
          <span className="icon" aria-hidden="true">{t.icon}</span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

// ---------- Divers ----------

export function useEscape(onEscape: () => void, enabled = true): void {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled]);
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((Math.min(value, total) / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Banner({ kind = 'warn', children }: { kind?: 'warn' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={`banner${kind === 'warn' ? '' : ` ${kind}`}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function formatAgo(ms: number, now = Date.now()): string {
  const d = Math.max(0, now - ms);
  const min = Math.round(d / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  return `il y a ${days} j`;
}
