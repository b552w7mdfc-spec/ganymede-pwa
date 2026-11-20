import { createStore, set } from 'idb-keyval';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCharacter } from '../model/roster';
import { emptyUserState } from '../model/types';
import { loadUserState, saveUserState } from './persistence';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistance de l’état utilisateur', () => {
  it('premier lancement : état vide et demande de stockage persistant (erreur tolérée)', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('refusé'));
    vi.stubGlobal('navigator', { storage: { persist } });
    const r = await loadUserState();
    expect(r.firstLaunch).toBe(true);
    expect(r.state).toEqual(emptyUserState());
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('relit ce qui a été enregistré, sans redemander la persistance', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    const s = addCharacter(emptyUserState(), { name: 'Iop', color: '#f00' }, 1, 'A');
    await saveUserState(s);
    const r = await loadUserState();
    expect(r.firstLaunch).toBe(false);
    expect(r.state).toEqual(s);
    expect(persist).not.toHaveBeenCalled();
  });

  it('données illisibles : mises de côté, avertissement, état vide', async () => {
    await set('user-state', { schemaVersion: 1, characters: 'cassé' }, createStore('guide-dofus-user', 'state'));
    const r = await loadUserState();
    expect(r.warning).toMatch(/illisibles/);
    expect(r.state).toEqual(emptyUserState());
  });
});
