import { useEffect } from 'react';

/**
 * Garde l'écran allumé tant que le composant est monté et `enabled` vrai.
 * Le verrou est relâché par le système quand l'appli passe en arrière-plan :
 * on le redemande au retour au premier plan. Échec silencieux.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (disposed) void s.release().catch(() => undefined);
        else sentinel = s;
      } catch {
        // Non supporté, refusé, batterie faible… : on ignore.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}
