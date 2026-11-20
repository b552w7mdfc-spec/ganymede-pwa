import { describe, expect, it } from 'vitest';
import { applyStepAction, openGuide } from './progress';
import { addCharacter, addTeam, setActive } from './roster';
import { buildExport, migrateUserState, parseImport, parseUserState } from './schema';
import { emptyUserState, type UserState } from './types';

function sample(): UserState {
  let s = emptyUserState();
  s = addCharacter(s, { name: 'Iop', className: 'Iop', level: 200, color: '#f00' }, 1, 'A');
  s = addCharacter(s, { name: 'Eni', color: '#0f0' }, 2, 'B');
  s = addTeam(s, { name: 'Duo', memberIds: ['A', 'B'] }, 'T');
  s = setActive(s, { kind: 'team', id: 'T' });
  s = openGuide(s, { kind: 'team', id: 'T' }, 2, 10);
  s = applyStepAction(s, { kind: 'character', id: 'A' }, 2, 237, { type: 'goto', step: 12 }, 20);
  return s;
}

describe('export', () => {
  it('produit un fichier daté et un JSON relisible à l’identique', () => {
    const s = sample();
    const now = new Date(2026, 10, 20, 9, 5);
    const { filename, json } = buildExport(s, now);
    expect(filename).toBe('guide-dofus-2026-11-20_0905.json');
    const back = parseImport(json);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.value.state).toEqual(s);
      expect(back.value.exportedAt).toBe(now.toISOString());
    }
  });

  it('export d’un état vide relisible', () => {
    const { json } = buildExport(emptyUserState(), new Date());
    const back = parseImport(json);
    expect(back.ok && back.value.state).toEqual(emptyUserState());
  });
});

describe('import : rejets', () => {
  const wrap = (data: unknown) => JSON.stringify({ app: 'guide-dofus', exportedAt: 'x', data });
  const valid = () => JSON.parse(JSON.stringify(sample())) as Record<string, unknown>;

  const cases: [string, string][] = [
    ['JSON invalide', '{pas du json'],
    ['autre appli', JSON.stringify({ app: 'autre', data: sample() })],
    ['sans data', JSON.stringify({ app: 'guide-dofus' })],
    ['version inconnue', wrap({ ...valid(), schemaVersion: 99 })],
    ['persos absents', wrap({ ...valid(), characters: 'non' })],
    ['perso sans nom', wrap({ ...valid(), characters: [{ id: 'A', name: '', color: '#f', createdAt: 1 }], teams: [], progress: {} })],
    ['perso niveau texte', wrap({ ...valid(), characters: [{ id: 'A', name: 'x', color: '#f', createdAt: 1, level: '200' }], teams: [], progress: {} })],
    ['ids en double', wrap({ ...valid(), characters: [
      { id: 'A', name: 'x', color: '#f', createdAt: 1 },
      { id: 'A', name: 'y', color: '#f', createdAt: 1 },
    ], teams: [], progress: {} })],
    ['équipe à 1 membre', wrap({ ...valid(), teams: [{ id: 'T', name: 'Duo', memberIds: ['A'] }] })],
    ['équipe avec membre inconnu', wrap({ ...valid(), teams: [{ id: 'T', name: 'Duo', memberIds: ['A', 'Z'] }] })],
    ['progression perso inconnu', wrap({ ...valid(), progress: { Z: {} } })],
    ['progression étape négative', wrap({ ...valid(), progress: { A: { '2': { currentStep: -1, updatedAt: 1, finished: false } } } })],
    ['progression étape non entière', wrap({ ...valid(), progress: { A: { '2': { currentStep: 1.5, updatedAt: 1, finished: false } } } })],
    ['progression guide non numérique', wrap({ ...valid(), progress: { A: { abc: { currentStep: 1, updatedAt: 1, finished: false } } } })],
    ['progression finished absent', wrap({ ...valid(), progress: { A: { '2': { currentStep: 1, updatedAt: 1 } } } })],
  ];

  it.each(cases)('%s', (_label, text) => {
    const r = parseImport(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe('import : tolérances', () => {
  it('un contexte actif invalide est remplacé par le premier perso', () => {
    const s = { ...sample(), active: { kind: 'team', id: 'disparue' } };
    const r = parseUserState(JSON.parse(JSON.stringify(s)));
    expect(r.ok && r.value.active).toEqual({ kind: 'character', id: 'A' });
  });

  it('ignore les champs inconnus', () => {
    const raw = { ...JSON.parse(JSON.stringify(sample())), extra: 1 };
    raw.characters[0].bidule = true;
    const r = parseUserState(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect('extra' in r.value).toBe(false);
      expect('bidule' in (r.value.characters[0] ?? {})).toBe(false);
    }
  });

  it('migrateUserState accepte la version courante', () => {
    const r = migrateUserState(JSON.parse(JSON.stringify(sample())));
    expect(r.ok && r.value).toEqual(sample());
  });
});
