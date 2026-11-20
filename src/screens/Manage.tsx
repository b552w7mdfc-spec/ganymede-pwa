import { useRef, useState, type FormEvent } from 'react';
import { CHARACTER_COLORS } from '../model/roster';
import { buildExport, parseImport } from '../model/schema';
import type { Character, Team } from '../model/types';
import { confirmDialog } from '../store/dialogStore';
import { useUserStore } from '../store/userStore';
import { Banner, Dots } from '../ui/components';

// ---------- Formulaire perso ----------

interface CharacterDraft {
  name: string;
  className: string;
  level: string;
  color: string;
}

function toDraft(c?: Character, fallbackColor: string = CHARACTER_COLORS[0]): CharacterDraft {
  return {
    name: c?.name ?? '',
    className: c?.className ?? '',
    level: c?.level !== undefined ? String(c.level) : '',
    color: c?.color ?? fallbackColor,
  };
}

function parseLevel(s: string): number | undefined {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : undefined;
}

function CharacterForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: CharacterDraft;
  submitLabel: string;
  onSubmit: (d: CharacterDraft) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.name.trim()) return;
    onSubmit(d);
  };
  return (
    <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="field">
        <label htmlFor="c-name">Nom</label>
        <input
          id="c-name"
          className="input"
          value={d.name}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="words"
          onChange={(e) => setD({ ...d, name: e.target.value })}
          required
        />
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field grow">
          <label htmlFor="c-class">Classe (facultatif)</label>
          <input
            id="c-class"
            className="input"
            value={d.className}
            maxLength={30}
            autoComplete="off"
            onChange={(e) => setD({ ...d, className: e.target.value })}
          />
        </div>
        <div className="field" style={{ width: 96 }}>
          <label htmlFor="c-level">Niveau</label>
          <input
            id="c-level"
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={d.level}
            maxLength={3}
            onChange={(e) => setD({ ...d, level: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </div>
      <div className="field">
        <span className="small muted" style={{ fontWeight: 600 }}>Couleur</span>
        <div className="color-choices" role="group" aria-label="Couleur">
          {CHARACTER_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              aria-label={col}
              aria-pressed={d.color === col}
              style={{ background: col }}
              onClick={() => setD({ ...d, color: col })}
            />
          ))}
        </div>
      </div>
      <div className="row end">
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
        ) : null}
        <button type="submit" className="btn primary" disabled={!d.name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------- Formulaire équipe ----------

function TeamForm({
  characters,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  characters: Character[];
  initial?: Team;
  submitLabel: string;
  onSubmit: (t: { name: string; memberIds: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [members, setMembers] = useState<string[]>(initial?.memberIds ?? []);
  const toggle = (id: string) =>
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const valid = name.trim() !== '' && members.length >= 2;
  return (
    <form
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ name, memberIds: members });
      }}
    >
      <div className="field">
        <label htmlFor="t-name">Nom de l’équipe</label>
        <input
          id="t-name"
          className="input"
          value={name}
          maxLength={40}
          autoComplete="off"
          placeholder="ex. Duo Iop/Eni"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend className="small muted" style={{ fontWeight: 600 }}>Membres (2 minimum)</legend>
        {characters.map((c) => (
          <label key={c.id} className="check-item">
            <input type="checkbox" checked={members.includes(c.id)} onChange={() => toggle(c.id)} />
            <Dots colors={[c.color]} />
            <span>{c.name}</span>
          </label>
        ))}
      </fieldset>
      <div className="row end">
        <button type="button" className="btn" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn primary" disabled={!valid}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------- Écran ----------

export function Manage() {
  const user = useUserStore((s) => s.user);
  const actions = useUserStore();
  const [editingChar, setEditingChar] = useState<string | 'new' | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | 'new' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nextColor =
    CHARACTER_COLORS[user.characters.length % CHARACTER_COLORS.length] ?? CHARACTER_COLORS[0];

  const deleteCharacter = async (c: Character) => {
    const teams = user.teams.filter((t) => t.memberIds.includes(c.id));
    const dissolved = teams.filter((t) => t.memberIds.length <= 2);
    const lines = [`Sa progression dans tous les guides sera perdue.`];
    if (dissolved.length) lines.push(`Équipe(s) dissoute(s) : ${dissolved.map((t) => t.name).join(', ')}.`);
    const ok = await confirmDialog({
      title: `Supprimer ${c.name} ?`,
      message: lines.join('\n'),
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) actions.removeCharacter(c.id);
  };

  const deleteTeam = async (t: Team) => {
    const ok = await confirmDialog({
      title: `Supprimer l’équipe ${t.name} ?`,
      message: 'Les persos et leur progression sont conservés.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) actions.removeTeam(t.id);
  };

  const doExport = () => {
    const { filename, json } = buildExport(user, new Date());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNotice({ kind: 'info', text: `Export : ${filename}` });
  };

  const doImport = async (file: File) => {
    setNotice(null);
    const text = await file.text();
    const r = parseImport(text);
    if (!r.ok) {
      setNotice({ kind: 'error', text: `Import impossible : ${r.error}` });
      return;
    }
    const s = r.value.state;
    const guides = new Set(Object.values(s.progress).flatMap((p) => Object.keys(p))).size;
    const when = r.value.exportedAt ? new Date(r.value.exportedAt).toLocaleString('fr-FR') : 'date inconnue';
    const ok = await confirmDialog({
      title: 'Remplacer toutes les données ?',
      message:
        `Sauvegarde du ${when} : ${s.characters.length} perso(s), ${s.teams.length} équipe(s), ${guides} guide(s) suivi(s).\n\n` +
        `Tes données actuelles (${user.characters.length} perso(s), ${user.teams.length} équipe(s)) seront remplacées.`,
      confirmLabel: 'Remplacer',
      danger: true,
    });
    if (!ok) return;
    actions.replaceAll(s);
    setNotice({ kind: 'info', text: 'Import terminé.' });
  };

  return (
    <div className="screen">
      <h1>Gestion</h1>

      {/* ----- Persos ----- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row">
          <h2 className="grow">Persos</h2>
          {editingChar !== 'new' ? (
            <button type="button" className="btn small primary" onClick={() => setEditingChar('new')}>
              + Perso
            </button>
          ) : null}
        </div>

        {editingChar === 'new' ? (
          <CharacterForm
            initial={toDraft(undefined, nextColor)}
            submitLabel="Créer"
            onCancel={() => setEditingChar(null)}
            onSubmit={(d) => {
              actions.addCharacter({
                name: d.name,
                className: d.className,
                level: parseLevel(d.level),
                color: d.color,
              });
              setEditingChar(null);
            }}
          />
        ) : null}

        {user.characters.length === 0 && editingChar !== 'new' ? (
          <p className="muted">Aucun perso. Commence par en créer un.</p>
        ) : null}

        <ul className="list">
          {user.characters.map((c) =>
            editingChar === c.id ? (
              <li key={c.id}>
                <CharacterForm
                  initial={toDraft(c)}
                  submitLabel="Enregistrer"
                  onCancel={() => setEditingChar(null)}
                  onSubmit={(d) => {
                    const level = parseLevel(d.level);
                    actions.updateCharacter(c.id, {
                      name: d.name,
                      className: d.className,
                      level,
                      color: d.color,
                    });
                    setEditingChar(null);
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="list-item">
                <Dots colors={[c.color]} />
                <span className="grow">
                  <span className="title">{c.name}</span>
                  <div className="sub">
                    {[c.className, c.level !== undefined ? `niv. ${c.level}` : null].filter(Boolean).join(' · ') ||
                      '—'}
                  </div>
                </span>
                <button type="button" className="btn small ghost" onClick={() => setEditingChar(c.id)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="btn small ghost danger"
                  aria-label={`Supprimer ${c.name}`}
                  onClick={() => void deleteCharacter(c)}
                >
                  ✕
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      {/* ----- Équipes ----- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row">
          <h2 className="grow">Équipes</h2>
          {editingTeam !== 'new' ? (
            <button
              type="button"
              className="btn small primary"
              disabled={user.characters.length < 2}
              onClick={() => setEditingTeam('new')}
            >
              + Équipe
            </button>
          ) : null}
        </div>
        {user.characters.length < 2 ? (
          <p className="muted small">Il faut au moins 2 persos pour former une équipe.</p>
        ) : null}

        {editingTeam === 'new' ? (
          <TeamForm
            characters={user.characters}
            submitLabel="Créer"
            onCancel={() => setEditingTeam(null)}
            onSubmit={(t) => {
              actions.addTeam(t);
              setEditingTeam(null);
            }}
          />
        ) : null}

        <ul className="list">
          {user.teams.map((t) =>
            editingTeam === t.id ? (
              <li key={t.id}>
                <TeamForm
                  characters={user.characters}
                  initial={t}
                  submitLabel="Enregistrer"
                  onCancel={() => setEditingTeam(null)}
                  onSubmit={(patch) => {
                    actions.updateTeam(t.id, patch);
                    setEditingTeam(null);
                  }}
                />
              </li>
            ) : (
              <li key={t.id} className="list-item">
                <Dots
                  colors={t.memberIds.map((id) => user.characters.find((c) => c.id === id)?.color ?? '#888')}
                />
                <span className="grow">
                  <span className="title">{t.name}</span>
                  <div className="sub">
                    {t.memberIds.map((id) => user.characters.find((c) => c.id === id)?.name ?? '?').join(' + ')}
                  </div>
                </span>
                <button type="button" className="btn small ghost" onClick={() => setEditingTeam(t.id)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="btn small ghost danger"
                  aria-label={`Supprimer l’équipe ${t.name}`}
                  onClick={() => void deleteTeam(t)}
                >
                  ✕
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      {/* ----- Sauvegarde ----- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>Sauvegarde</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Persos, équipes et progression. Les guides eux-mêmes ne sont pas inclus (ils se re-téléchargent).
        </p>
        {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
        <div className="row">
          <button type="button" className="btn grow" onClick={doExport}>
            Exporter
          </button>
          <button type="button" className="btn grow" onClick={() => fileRef.current?.click()}>
            Importer…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void doImport(f);
            }}
          />
        </div>
      </section>
    </div>
  );
}
