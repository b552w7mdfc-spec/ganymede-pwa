import { createStore, get, set, type UseStore } from 'idb-keyval';
import { migrateUserState } from '../model/schema';
import { emptyUserState, type UserState } from '../model/types';

let store: UseStore | undefined;
function db(): UseStore {
  store ??= createStore('guide-dofus-user', 'state');
  return store;
}

const STATE_KEY = 'user-state';

export interface LoadResult {
  state: UserState;
  firstLaunch: boolean;
  /** Message si les données stockées étaient illisibles (sauvegardées à part). */
  warning?: string;
}

/** Demande au navigateur de ne pas purger nos données (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
  } catch {
    // Non supporté ou refusé : on continue sans.
  }
  return false;
}

export async function loadUserState(): Promise<LoadResult> {
  const raw = await get<unknown>(STATE_KEY, db());
  if (raw === undefined) {
    await requestPersistentStorage();
    const state = emptyUserState();
    await saveUserState(state);
    return { state, firstLaunch: true };
  }
  const migrated = migrateUserState(raw);
  if (migrated.ok) {
    // Données d'une version antérieure : on enregistre la version migrée.
    const v = typeof raw === 'object' && raw !== null ? (raw as { schemaVersion?: unknown }).schemaVersion : undefined;
    if (v !== migrated.value.schemaVersion) await saveUserState(migrated.value);
    return { state: migrated.value, firstLaunch: false };
  }

  // Données illisibles : on les met de côté plutôt que de les écraser.
  const backupKey = `user-state-unreadable-${Date.now()}`;
  await set(backupKey, raw, db());
  const state = emptyUserState();
  await saveUserState(state);
  return {
    state,
    firstLaunch: false,
    warning: `Les données enregistrées étaient illisibles (${migrated.error}). Elles ont été mises de côté et l’appli repart de zéro.`,
  };
}

export async function saveUserState(state: UserState): Promise<void> {
  await set(STATE_KEY, state, db());
}
