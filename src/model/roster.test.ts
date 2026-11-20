import { describe, expect, it } from 'vitest';
import { openGuide } from './progress';
import { addCharacter, addTeam, removeCharacter, removeTeam, setActive, updateCharacter, updateTeam } from './roster';
import { emptyUserState, type UserState } from './types';

function base(): UserState {
  let s = emptyUserState();
  s = addCharacter(s, { name: 'Iop', color: '#f00' }, 1, 'A');
  s = addCharacter(s, { name: 'Eni', color: '#0f0' }, 1, 'B');
  s = addCharacter(s, { name: 'Cra', color: '#00f' }, 1, 'C');
  return s;
}

describe('persos', () => {
  it('le premier perso créé devient actif', () => {
    const s = base();
    expect(s.active).toEqual({ kind: 'character', id: 'A' });
  });

  it('refuse un nom vide, nettoie les champs optionnels', () => {
    let s = emptyUserState();
    expect(addCharacter(s, { name: '  ', color: '#f00' }, 1)).toBe(s);
    s = addCharacter(s, { name: ' Iop ', className: ' ', level: NaN, color: '#f00' }, 1, 'X');
    expect(s.characters[0]).toEqual({ id: 'X', name: 'Iop', color: '#f00', createdAt: 1 });
  });

  it('renomme sans accepter un nom vide', () => {
    let s = updateCharacter(base(), 'A', { name: 'Iopette' });
    expect(s.characters[0]?.name).toBe('Iopette');
    s = updateCharacter(s, 'A', { name: '   ' });
    expect(s.characters[0]?.name).toBe('Iopette');
  });

  it('supprimer un perso supprime sa progression, le retire des équipes et dissout les équipes trop petites', () => {
    let s = base();
    s = addTeam(s, { name: 'Duo', memberIds: ['A', 'B'] }, 'T1');
    s = addTeam(s, { name: 'Trio', memberIds: ['A', 'B', 'C'] }, 'T2');
    s = openGuide(s, { kind: 'team', id: 'T2' }, 7, 1);
    s = setActive(s, { kind: 'team', id: 'T1' });
    s = removeCharacter(s, 'B');
    expect(s.characters.map((c) => c.id)).toEqual(['A', 'C']);
    expect(s.teams).toEqual([{ id: 'T2', name: 'Trio', memberIds: ['A', 'C'] }]);
    expect(s.progress.B).toBeUndefined();
    expect(s.progress.A?.['7']).toBeDefined();
    // T1 a disparu : retour au premier perso.
    expect(s.active).toEqual({ kind: 'character', id: 'A' });
  });

  it('supprimer le dernier perso laisse un contexte nul', () => {
    let s = addCharacter(emptyUserState(), { name: 'Iop', color: '#f00' }, 1, 'A');
    s = removeCharacter(s, 'A');
    expect(s.active).toBeNull();
  });
});

describe('équipes', () => {
  it('exige au moins 2 membres existants, sans doublon', () => {
    const s = base();
    expect(addTeam(s, { name: 'Solo', memberIds: ['A'] })).toBe(s);
    expect(addTeam(s, { name: 'Faux', memberIds: ['A', 'A'] })).toBe(s);
    expect(addTeam(s, { name: 'Fantôme', memberIds: ['A', 'Z'] })).toBe(s);
    expect(addTeam(s, { name: ' ', memberIds: ['A', 'B'] })).toBe(s);
    expect(addTeam(s, { name: 'Duo', memberIds: ['A', 'B'] }, 'T').teams).toEqual([
      { id: 'T', name: 'Duo', memberIds: ['A', 'B'] },
    ]);
  });

  it('modifie le nom et les membres, refuse moins de 2 membres', () => {
    let s = addTeam(base(), { name: 'Duo', memberIds: ['A', 'B'] }, 'T');
    s = updateTeam(s, 'T', { name: 'Trio', memberIds: ['A', 'B', 'C'] });
    expect(s.teams[0]).toEqual({ id: 'T', name: 'Trio', memberIds: ['A', 'B', 'C'] });
    s = updateTeam(s, 'T', { memberIds: ['A'] });
    expect(s.teams[0]?.memberIds).toEqual(['A', 'B', 'C']);
  });

  it('supprimer l’équipe active revient au premier perso', () => {
    let s = addTeam(base(), { name: 'Duo', memberIds: ['A', 'B'] }, 'T');
    s = setActive(s, { kind: 'team', id: 'T' });
    expect(s.active).toEqual({ kind: 'team', id: 'T' });
    s = removeTeam(s, 'T');
    expect(s.active).toEqual({ kind: 'character', id: 'A' });
  });

  it('setActive refuse un contexte inexistant', () => {
    const s = setActive(base(), { kind: 'team', id: 'nope' });
    expect(s.active).toEqual({ kind: 'character', id: 'A' });
  });
});
