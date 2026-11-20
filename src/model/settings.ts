import { FONT_SCALES } from './types';

/** Taille de texte suivante/précédente dans l'échelle, bornée. */
export function nextFontScale(current: number, delta: number): number {
  const i = FONT_SCALES.findIndex((f) => f >= current - 1e-6);
  const base = i === -1 ? FONT_SCALES.length - 1 : i;
  return FONT_SCALES[Math.min(FONT_SCALES.length - 1, Math.max(0, base + delta))] ?? 1;
}
