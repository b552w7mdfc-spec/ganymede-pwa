import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'catalog' }
  | { name: 'manage' }
  | { name: 'guide'; id: number };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const m = /^\/guide\/(\d+)$/.exec(path);
  if (m) return { name: 'guide', id: Number(m[1]) };
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
      return `#/guide/${route.id}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
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
