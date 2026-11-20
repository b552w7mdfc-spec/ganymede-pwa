import { describe, expect, it } from 'vitest';
import { addCharacter, addTeam, removeCharacter } from './roster';
import { setTask, stepTaskStates, taskState, toggleTask } from './tasks';
import { emptyUserState, type ActiveContext, type UserState } from './types';

const G = 2;
const A: ActiveContext = { kind: 'character', id: 'A' };
const B: ActiveContext = { kind: 'character', id: 'B' };
const C: ActiveContext = { kind: 'character', id: 'C' };
const T: ActiveContext = { kind: 'team', id: 'T' };

function setup(): UserState {
  let s = emptyUserState();
  s = addCharacter(s, { name: 'Iop', color: '#f00' }, 1, 'A');
  s = addCharacter(s, { name: 'Eni', color: '#0f0' }, 1, 'B');
  s = addCharacter(s, { name: 'Cra', color: '#00f' }, 1, 'C');
  return addTeam(s, { name: 'Duo', memberIds: ['A', 'B'] }, 'T');
}

describe('cases à cocher : perso', () => {
  it('coche et décoche pour ce perso uniquement', () => {
    let s = toggleTask(setup(), A, G, 3, 1);
    expect(taskState(s, A, G, 3, 1)).toBe('checked');
    expect(taskState(s, B, G, 3, 1)).toBe('unchecked');
    expect(taskState(s, A, G, 3, 0)).toBe('unchecked');
    expect(taskState(s, A, G, 4, 1)).toBe('unchecked'); // autre étape
    expect(taskState(s, A, 99, 3, 1)).toBe('unchecked'); // autre guide
    s = toggleTask(s, A, G, 3, 1);
    expect(taskState(s, A, G, 3, 1)).toBe('unchecked');
    // Nettoyage : aucune structure vide ne reste.
    expect(s.checks).toEqual({});
  });

  it('mémorise par index de case, trié', () => {
    let s = toggleTask(setup(), A, G, 0, 5);
    s = toggleTask(s, A, G, 0, 2);
    expect(s.checks.A?.['2']?.['0']).toEqual([2, 5]);
    expect(stepTaskStates(s, A, G, 0, 6)).toEqual(['unchecked', 'unchecked', 'checked', 'unchecked', 'unchecked', 'checked']);
  });
});

describe('cases à cocher : équipe', () => {
  it('cocher coche pour tous les membres (et pas les autres persos)', () => {
    const s = toggleTask(setup(), T, G, 3, 0);
    expect(taskState(s, A, G, 3, 0)).toBe('checked');
    expect(taskState(s, B, G, 3, 0)).toBe('checked');
    expect(taskState(s, C, G, 3, 0)).toBe('unchecked');
    expect(taskState(s, T, G, 3, 0)).toBe('checked');
  });

  it('décocher décoche pour tous', () => {
    let s = toggleTask(setup(), T, G, 3, 0);
    s = toggleTask(s, T, G, 3, 0);
    expect(taskState(s, A, G, 3, 0)).toBe('unchecked');
    expect(taskState(s, B, G, 3, 0)).toBe('unchecked');
  });

  it('état intermédiaire si seule une partie a coché', () => {
    const s = toggleTask(setup(), A, G, 3, 0);
    expect(taskState(s, T, G, 3, 0)).toBe('mixed');
  });

  it('appui sur une case intermédiaire : coche pour tous', () => {
    let s = toggleTask(setup(), A, G, 3, 0);
    s = toggleTask(s, T, G, 3, 0);
    expect(taskState(s, T, G, 3, 0)).toBe('checked');
    expect(taskState(s, B, G, 3, 0)).toBe('checked');
  });

  it('un perso peut décocher seul : l’équipe repasse en intermédiaire', () => {
    let s = toggleTask(setup(), T, G, 3, 0);
    s = toggleTask(s, B, G, 3, 0);
    expect(taskState(s, T, G, 3, 0)).toBe('mixed');
    expect(taskState(s, A, G, 3, 0)).toBe('checked');
  });
});

describe('cases à cocher : divers', () => {
  it('sans contexte : rien', () => {
    const s = setup();
    expect(toggleTask(s, null, G, 0, 0)).toBe(s);
    expect(taskState(s, null, G, 0, 0)).toBe('unchecked');
  });

  it('supprimer un perso supprime ses cases', () => {
    let s = toggleTask(setup(), T, G, 0, 0);
    s = removeCharacter(s, 'B');
    expect(s.checks.B).toBeUndefined();
    expect(s.checks.A).toBeDefined();
  });

  it('setTask est pur', () => {
    const checks = { A: { '2': { '0': [1] } } };
    const snap = JSON.stringify(checks);
    setTask(checks, ['A'], 2, 0, 3, true);
    expect(JSON.stringify(checks)).toBe(snap);
  });
});
