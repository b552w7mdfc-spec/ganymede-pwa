import { useSyncExternalStore } from 'react';
import type { Scheme } from './color';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(cb: () => void): () => void {
  const mq = query();
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Thème actif (clair/sombre) selon prefers-color-scheme, réactif. */
export function useColorScheme(): Scheme {
  return useSyncExternalStore(subscribe, () => (query().matches ? 'dark' : 'light'), () => 'light');
}
