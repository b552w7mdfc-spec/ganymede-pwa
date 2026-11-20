import { describe, expect, it } from 'vitest';
import {
  alignTeam,
  applyStepAction,
  clampStep,
  contextGuideView,
  contextMemberIds,
  openGuide,
  startedGuides,
} from './progress';
import { addCharacter, addTeam } from './roster';
import { emptyUserState, type ActiveContext, type UserState } from './types';

const G = 42;
const TOTAL = 10;

function setup(): { s: UserState; a: ActiveContext; b: ActiveContext; c: ActiveContext; team: ActiveContext } {
  let s = emptyUserState();
  s = addCharacter(s, { name: 'Iop', color: '#f00' }, 1, 'A');
  s = addCharacter(s, { name: 'Eni', color: '#0f0' }, 1, 'B');
  s = addCharacter(s, { name: 'Cra', color: '#00f' }, 1, 'C');
  s = addTeam(s, { name: 'Duo', memberIds: ['A', 'B'] }, 'T');
  return {
    s,
    a: { kind: 'character', id: 'A' },
    b: { kind: 'character', id: 'B' },
    c: { kind: 'character', id: 'C' },
    team: { kind: 'team', id: 'T' },
  };
}

const step = (s: UserState, id: string, g = G) => s.progress[id]?.[String(g)]?.currentStep;

describe('clampStep', () => {
  it('borne entre 0 et total-1', () => {
    expect(clampStep(-3, 10)).toBe(0);
    expect(clampStep(12, 10)).toBe(9);
    expect(clampStep(4.7, 10)).toBe(4);
    expect(clampStep(NaN, 10)).toBe(0);
    expect(clampStep(5, 0)).toBe(0);
  });
});

describe('contextMemberIds', () => {
  it('résout perso, équipe et contexte nul', () => {
    const { s, a, team } = setup();
    expect(contextMemberIds(s, a)).toEqual(['A']);
    expect(contextMemberIds(s, team)).toEqual(['A', 'B']);
    expect(contextMemberIds(s, null)).toEqual([]);
    expect(contextMemberIds(s, { kind: 'team', id: 'nope' })).toEqual([]);
    expect(contextMemberIds(s, { kind: 'character', id: 'nope' })).toEqual([]);
  });
});

describe('openGuide', () => {
  it('crée la progression à l’étape 0 pour un guide jamais commencé', () => {
    const { s, a } = setup();
    const s2 = openGuide(s, a, G, 100);
    expect(s2.progress.A?.[String(G)]).toEqual({ currentStep: 0, updatedAt: 100, finished: false });
    expect(s2.progress.B).toBeUndefined();
  });

  it('ne réinitialise pas une progression existante, met juste à jour la date', () => {
    const { s, a } = setup();
    let s2 = openGuide(s, a, G, 100);
    s2 = applyStepAction(s2, a, G, TOTAL, { type: 'goto', step: 5 }, 200);
    s2 = openGuide(s2, a, G, 300);
    expect(s2.progress.A?.[String(G)]).toEqual({ currentStep: 5, updatedAt: 300, finished: false });
  });

  it('pour une équipe, crée la progression des membres manquants seulement', () => {
    const { s, a, team } = setup();
    let s2 = openGuide(s, a, G, 100);
    s2 = applyStepAction(s2, a, G, TOTAL, { type: 'goto', step: 3 }, 150);
    s2 = openGuide(s2, team, G, 200);
    expect(step(s2, 'A')).toBe(3);
    expect(step(s2, 'B')).toBe(0);
    expect(s2.progress.C).toBeUndefined();
  });

  it('ne fait rien sans contexte', () => {
    const { s } = setup();
    expect(openGuide(s, null, G, 1)).toBe(s);
  });
});

describe('applyStepAction sur un perso', () => {
  it('next / prev / goto ne modifient que ce perso', () => {
    const { s, a, b } = setup();
    let st = openGuide(openGuide(s, a, G, 1), b, G, 1);
    st = applyStepAction(st, a, G, TOTAL, { type: 'next' }, 2);
    expect(step(st, 'A')).toBe(1);
    expect(step(st, 'B')).toBe(0);
    st = applyStepAction(st, a, G, TOTAL, { type: 'goto', step: 7 }, 3);
    expect(step(st, 'A')).toBe(7);
    st = applyStepAction(st, a, G, TOTAL, { type: 'prev' }, 4);
    expect(step(st, 'A')).toBe(6);
    expect(step(st, 'B')).toBe(0);
    expect(st.progress.A?.[String(G)]?.updatedAt).toBe(4);
    expect(st.progress.B?.[String(G)]?.updatedAt).toBe(1);
  });

  it('prev à l’étape 0 reste à 0', () => {
    const { s, a } = setup();
    const st = applyStepAction(openGuide(s, a, G, 1), a, G, TOTAL, { type: 'prev' }, 2);
    expect(step(st, 'A')).toBe(0);
  });

  it('goto borne l’étape', () => {
    const { s, a } = setup();
    let st = applyStepAction(openGuide(s, a, G, 1), a, G, TOTAL, { type: 'goto', step: 99 }, 2);
    expect(step(st, 'A')).toBe(9);
    st = applyStepAction(st, a, G, TOTAL, { type: 'goto', step: -5 }, 3);
    expect(step(st, 'A')).toBe(0);
  });

  it('next sur la dernière étape marque le guide terminé, prev le dé-marque', () => {
    const { s, a } = setup();
    let st = applyStepAction(openGuide(s, a, G, 1), a, G, TOTAL, { type: 'goto', step: 9 }, 2);
    expect(st.progress.A?.[String(G)]?.finished).toBe(false);
    st = applyStepAction(st, a, G, TOTAL, { type: 'next' }, 3);
    expect(st.progress.A?.[String(G)]).toEqual({ currentStep: 9, updatedAt: 3, finished: true });
    st = applyStepAction(st, a, G, TOTAL, { type: 'prev' }, 4);
    expect(st.progress.A?.[String(G)]).toEqual({ currentStep: 8, updatedAt: 4, finished: false });
  });

  it('crée la progression si l’action arrive avant l’ouverture', () => {
    const { s, a } = setup();
    const st = applyStepAction(s, a, G, TOTAL, { type: 'next' }, 2);
    expect(step(st, 'A')).toBe(1);
  });

  it('ne fait rien pour un guide sans étapes', () => {
    const { s, a } = setup();
    expect(applyStepAction(s, a, G, 0, { type: 'next' }, 2)).toBe(s);
  });

  it('ne modifie pas l’état d’origine (pureté)', () => {
    const { s, a } = setup();
    const opened = openGuide(s, a, G, 1);
    const snapshot = JSON.stringify(opened);
    applyStepAction(opened, a, G, TOTAL, { type: 'next' }, 2);
    expect(JSON.stringify(opened)).toBe(snapshot);
  });
});

describe('applyStepAction sur une équipe', () => {
  it('next fait avancer tous les membres, pas les autres persos', () => {
    const { s, team, c } = setup();
    let st = openGuide(openGuide(s, team, G, 1), c, G, 1);
    st = applyStepAction(st, team, G, TOTAL, { type: 'next' }, 2);
    expect(step(st, 'A')).toBe(1);
    expect(step(st, 'B')).toBe(1);
    expect(step(st, 'C')).toBe(0);
  });

  it('un perso peut avancer seul sans toucher aux autres membres', () => {
    const { s, team, a } = setup();
    let st = openGuide(s, team, G, 1);
    st = applyStepAction(st, a, G, TOTAL, { type: 'next' }, 2);
    expect(step(st, 'A')).toBe(1);
    expect(step(st, 'B')).toBe(0);
  });

  it('next depuis un état désynchronisé part de l’étape la plus basse et aligne tout le monde', () => {
    const { s, team, a } = setup();
    let st = openGuide(s, team, G, 1);
    st = applyStepAction(st, a, G, TOTAL, { type: 'goto', step: 5 }, 2);
    st = applyStepAction(st, team, G, TOTAL, { type: 'next' }, 3);
    expect(step(st, 'A')).toBe(1);
    expect(step(st, 'B')).toBe(1);
  });

  it('prev et goto appliquent la même étape cible à tous', () => {
    const { s, team } = setup();
    let st = applyStepAction(openGuide(s, team, G, 1), team, G, TOTAL, { type: 'goto', step: 6 }, 2);
    expect([step(st, 'A'), step(st, 'B')]).toEqual([6, 6]);
    st = applyStepAction(st, team, G, TOTAL, { type: 'prev' }, 3);
    expect([step(st, 'A'), step(st, 'B')]).toEqual([5, 5]);
  });

  it('ignore les membres supprimés', () => {
    const { s, team } = setup();
    const st0 = { ...s, characters: s.characters.filter((c) => c.id !== 'B') };
    const st = applyStepAction(st0, team, G, TOTAL, { type: 'next' }, 2);
    expect(step(st, 'A')).toBe(1);
    expect(st.progress.B).toBeUndefined();
  });

  it('next en fin de guide termine le guide pour tous', () => {
    const { s, team } = setup();
    let st = applyStepAction(openGuide(s, team, G, 1), team, G, TOTAL, { type: 'goto', step: 9 }, 2);
    st = applyStepAction(st, team, G, TOTAL, { type: 'next' }, 3);
    expect(contextGuideView(st, team, G)?.finished).toBe(true);
    expect(st.progress.A?.[String(G)]?.finished).toBe(true);
    expect(st.progress.B?.[String(G)]?.finished).toBe(true);
  });
});

describe('désynchronisation', () => {
  it('équipe synchronisée : pas de badge', () => {
    const { s, team } = setup();
    const st = applyStepAction(openGuide(s, team, G, 1), team, G, TOTAL, { type: 'goto', step: 4 }, 2);
    const v = contextGuideView(st, team, G);
    expect(v?.currentStep).toBe(4);
    expect(v?.desync).toBe(false);
  });

  it('équipe désynchronisée : affiche l’étape la plus basse et signale la désynchro', () => {
    const { s, team, a, b } = setup();
    let st = openGuide(s, team, G, 1);
    st = applyStepAction(st, a, G, TOTAL, { type: 'goto', step: 7 }, 2);
    st = applyStepAction(st, b, G, TOTAL, { type: 'goto', step: 3 }, 3);
    const v = contextGuideView(st, team, G);
    expect(v?.currentStep).toBe(3);
    expect(v?.desync).toBe(true);
    expect(v?.updatedAt).toBe(3);
    expect(v?.members.map((m) => m.progress?.currentStep)).toEqual([7, 3]);
  });

  it('un membre jamais commencé compte comme étape 0 et désynchronise', () => {
    const { s, team, a } = setup();
    const st = applyStepAction(openGuide(s, a, G, 1), a, G, TOTAL, { type: 'goto', step: 4 }, 2);
    const v = contextGuideView(st, team, G);
    expect(v?.currentStep).toBe(0);
    expect(v?.desync).toBe(true);
  });

  it('même étape mais un seul membre terminé : désynchronisé', () => {
    const { s, team, a } = setup();
    let st = applyStepAction(openGuide(s, team, G, 1), team, G, TOTAL, { type: 'goto', step: 9 }, 2);
    st = applyStepAction(st, a, G, TOTAL, { type: 'next' }, 3);
    const v = contextGuideView(st, team, G);
    expect(v?.desync).toBe(true);
    expect(v?.finished).toBe(false);
  });

  it('« aligner tout le monde sur l’étape N » resynchronise', () => {
    const { s, team, a } = setup();
    let st = openGuide(s, team, G, 1);
    st = applyStepAction(st, a, G, TOTAL, { type: 'goto', step: 7 }, 2);
    st = alignTeam(st, 'T', G, TOTAL, 7, 3);
    const v = contextGuideView(st, team, G);
    expect(v?.desync).toBe(false);
    expect(v?.currentStep).toBe(7);
  });

  it('un perso seul n’est jamais désynchronisé', () => {
    const { s, a } = setup();
    expect(contextGuideView(openGuide(s, a, G, 1), a, G)?.desync).toBe(false);
  });

  it('renvoie null si personne n’a commencé', () => {
    const { s, team } = setup();
    expect(contextGuideView(s, team, G)).toBeNull();
  });
});

describe('startedGuides', () => {
  it('liste les guides du perso, du plus récent au plus ancien', () => {
    const { s, a } = setup();
    let st = openGuide(s, a, 1, 100);
    st = openGuide(st, a, 2, 300);
    st = openGuide(st, a, 3, 200);
    expect(startedGuides(st, a).map((v) => v.guideId)).toEqual([2, 3, 1]);
  });

  it('pour une équipe, seulement les guides commencés par tous les membres', () => {
    const { s, a, team } = setup();
    let st = openGuide(s, a, 1, 100); // solo
    st = openGuide(st, team, 2, 200); // équipe
    expect(startedGuides(st, team).map((v) => v.guideId)).toEqual([2]);
    expect(startedGuides(st, a).map((v) => v.guideId)).toEqual([2, 1]);
  });

  it('vide sans contexte', () => {
    const { s } = setup();
    expect(startedGuides(s, null)).toEqual([]);
  });
});
