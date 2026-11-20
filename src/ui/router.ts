import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'catalog' }
  | { name: 'manage' }
  /** step : index 0 de l'étape à atteindre (lien d'étape), facultatif. */
  | { name: 'guide'; id: number; step?: number };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const m = /^\/guide\/(\d+)(?:\/etape\/(\d+))?$/.exec(path);
  if (m) {
    const step = m[2] !== undefined ? Number(m[2]) - 1 : undefined;
    return step !== undefined && step >= 0 ? { name: 'guide', id: Number(m[1]), step } : { name: 'guide', id: Number(m[1]) };
  }
  if (path === '/catalogue') return { name: 'catalog' };
  if (path === '/gestion') return { name: 'manage' };
  return { name: 'home' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'catalog':
      return '#/catalogue';
    case 'manage':
      return '#/gestion';
    case 'guide':
      return route.step !== undefined ? `#/guide/${route.id}/etape/${route.step + 1}` : `#/guide/${route.id}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
}

/** Remplace l'URL sans créer d'entrée d'historique ni re-router. */
export function replaceSilently(route: Route): void {
  window.history.replaceState(window.history.state, '', hrefFor(route));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}

export function useRoute(): Route {
  return parseHash(useHash());
}
