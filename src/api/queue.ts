import { ApiError } from './client';

/**
 * File qui exécute les tâches une par une (jamais deux requêtes de détail en
 * parallèle) et qui se bloque après un 429 jusqu'à la date indiquée, en
 * rejetant immédiatement les nouvelles demandes au lieu de réessayer.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private blockedUntil = 0;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  /** Date (ms) jusqu'à laquelle la file refuse les requêtes, ou 0. */
  get blockedUntilMs(): number {
    return this.blockedUntil > this.now() ? this.blockedUntil : 0;
  }

  /**
   * Ajoute une tâche. Si une tâche de même clé est déjà en attente ou en cours,
   * renvoie sa promesse au lieu d'en créer une seconde.
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const p = this.tail.then(async () => {
      if (this.now() < this.blockedUntil) throw this.blockedError();
      try {
        return await task();
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'rate-limit') {
          this.blockedUntil = Math.max(this.blockedUntil, e.retryAt ?? this.now() + 60_000);
        }
        throw e;
      }
    });
    const cleanup = () => {
      this.inFlight.delete(key);
    };
    p.then(cleanup, cleanup);
    this.inFlight.set(key, p);
    // La file continue même si la tâche échoue.
    this.tail = p.catch(() => undefined);
    return p;
  }

  private blockedError(): ApiError {
    return new ApiError(
      'rate-limit',
      'Limite de requêtes Ganymède atteinte. Patiente un peu avant de réessayer.',
      { status: 429, retryAt: this.blockedUntil },
    );
  }
}
