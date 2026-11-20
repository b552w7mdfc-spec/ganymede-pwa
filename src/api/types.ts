export type GuideStatus = 'certified' | 'public' | 'gp';
export const GUIDE_STATUSES: readonly GuideStatus[] = ['certified', 'public', 'gp'];

export type GuideLang = 'fr' | 'en' | 'es' | 'pt';
export const GUIDE_LANGS: readonly GuideLang[] = ['fr', 'en', 'es', 'pt'];

export interface GuideAuthor {
  id: number;
  name: string;
  is_admin: number | boolean;
  is_certified: number | boolean;
}

/** Élément de la liste (sans étapes). Version allégée de la réponse API. */
export interface GuideSummary {
  id: number;
  name: string;
  status: string;
  lang: string;
  game_type: string;
  web_description: string | null;
  likes: number;
  dislikes: number;
  downloads: number;
  order: number;
  updated_at: string;
  node_image: string | null;
  user: GuideAuthor | null;
}

export interface GuideStep {
  id: number;
  name: string | null;
  map: string | null;
  pos_x: number;
  pos_y: number;
  web_text: string;
}

export interface GuideDetail {
  id: number;
  name: string;
  description: string | null;
  status: string;
  likes: number;
  dislikes: number;
  updated_at: string;
  user: GuideAuthor | null;
  lang: string;
  order: number;
  game_type: string;
  node_image: string | null;
  steps: GuideStep[];
}

/** Infos légères d'un guide en cache, pour l'accueil (sans les étapes). */
export interface GuideMeta {
  id: number;
  name: string;
  lang: string;
  status: string;
  totalSteps: number;
  updated_at: string;
  fetchedAt: number;
}

export interface CachedList {
  status: GuideStatus;
  fetchedAt: number;
  guides: GuideSummary[];
}

export interface CachedGuide {
  fetchedAt: number;
  guide: GuideDetail;
}
