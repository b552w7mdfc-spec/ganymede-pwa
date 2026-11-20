import { describe, expect, it } from 'vitest';
import { applyStepAction, openGuide } from './progress';
import { addCharacter, addTeam, setActive } from './roster';
import { buildExport, migrateUserState, parseImport, parseUserState } from './schema';
import { toggleTask } from './tasks';
import { emptyUserState, type UserState } from './types';

function sample(): UserState {
  let s = emptyUserState();
  s = addCharacter(s, { name: 'Iop', className: 'Iop', level: 200, color: '#f00' }, 1, 'A');
  s = addCharacter(s, { name: 'Eni', color: '#0f0' }, 2, 'B');
  s = addTeam(s, { name: 'Duo', memberIds: ['A', 'B'] }, 'T');
  s = setActive(s, { kind: 'team', id: 'T' });
  s = openGuide(s, { kind: 'team', id: 'T' }, 2, 10);
  s = applyStepAction(s, { kind: 'character', id: 'A' }, 2, 237, { type: 'goto', step: 12 }, 20);
  s = toggleTask(s, { kind: 'team', id: 'T' }, 2, 0, 1);
  s = toggleTask(s, { kind: 'character', id: 'A' }, 2, 12, 0);
  s = { ...s, settings: { keepAwake: false, fontScale: 1.3 } };
  return s;
}

describe('export', () => {
  it('inclut les cases cochées et les réglages', () => {
    const { json } = buildExport(sample(), new Date());
    const data = JSON.parse(json).data;
    expect(data.checks.A['2']).toEqual({ '0': [1], '12': [0] });
    expect(data.checks.B['2']).toEqual({ '0': [1] });
    expect(data.settings).toEqual({ keepAwake: false, fontScale: 1.3 });
  });

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
    ['cases : perso inconnu', wrap({ ...valid(), checks: { Z: {} } })],
    ['cases : index négatif', wrap({ ...valid(), checks: { A: { '2': { '0': [-1] } } } })],
    ['cases : pas un tableau', wrap({ ...valid(), checks: { A: { '2': { '0': 3 } } } })],
    ['progression finished absent', wrap({ ...valid(), progress: { A: { '2': { currentStep: 1, updatedAt: 1 } } } })],
  ];

  it.each(cases)('%s', (_label, text) => {
    const r = parseImport(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe('migration v1 -> v2', () => {
  const v1 = {
    schemaVersion: 1,
    characters: [{ id: 'A', name: 'Iop', color: '#f00', createdAt: 1 }],
    teams: [],
    progress: { A: { '2': { currentStep: 4, updatedAt: 9, finished: false } } },
    active: { kind: 'character', id: 'A' },
  };

  it('ajoute des cases vides et les réglages par défaut, garde tout le reste', () => {
    const r = migrateUserState(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(2);
    expect(r.value.checks).toEqual({});
    expect(r.value.settings).toEqual({ keepAwake: true, fontScale: 1 });
    expect(r.value.progress).toEqual(v1.progress);
    expect(r.value.characters).toEqual(v1.characters);
    expect(r.value.active).toEqual(v1.active);
  });

  it('un export v1 s’importe (migré)', () => {
    const r = parseImport(JSON.stringify({ app: 'guide-dofus', exportedAt: 'x', data: v1 }));
    expect(r.ok && r.value.state.schemaVersion).toBe(2);
  });

  it('une v1 invalide reste refusée après migration', () => {
    expect(migrateUserState({ ...v1, characters: 'x' }).ok).toBe(false);
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
