/** URL de base de l'API Ganymède (v2). Seul endroit où elle est définie. */
export const API_BASE = 'https://ganymede-app.com/api/v2';

export type ApiErrorKind = 'rate-limit' | 'network' | 'not-found' | 'http' | 'format';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  /** Pour 'rate-limit' : date (ms) avant laquelle il ne faut pas réessayer. */
  readonly retryAt: number | undefined;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; retryAt?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status;
    this.retryAt = opts.retryAt;
  }
}

/** Délai par défaut après un 429 si le serveur n'indique rien (fenêtre inconnue). */
export const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;

function retryAfterMs(res: Response): number {
  const h = res.headers.get('retry-after');
  if (h) {
    const secs = Number(h);
    if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
    const date = Date.parse(h);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return DEFAULT_RATE_LIMIT_COOLDOWN_MS;
}

/** GET JSON sur l'API. Une seule tentative, jamais de relance automatique. */
export async function apiGet(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('network', 'Pas de connexion au serveur Ganymède.');
  }
  if (res.status === 429) {
    const retryAt = Date.now() + retryAfterMs(res);
    throw new ApiError('rate-limit', 'Trop de requêtes vers Ganymède. Patiente un peu avant de réessayer.', {
      status: 429,
      retryAt,
    });
  }
  if (res.status === 404) throw new ApiError('not-found', 'Guide introuvable sur Ganymède.', { status: 404 });
  if (!res.ok) throw new ApiError('http', `Erreur du serveur Ganymède (${res.status}).`, { status: res.status });
  try {
    return await res.json();
  } catch {
    throw new ApiError('format', 'Réponse illisible du serveur Ganymède.');
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kind === 'rate-limit' && e.retryAt) {
      const secs = Math.max(1, Math.ceil((e.retryAt - Date.now()) / 1000));
      return `${e.message} (réessaie dans ~${secs} s)`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Erreur inconnue.';
}
