/**
 * Ajustement des couleurs en ligne des auteurs pour garantir un contraste
 * lisible (WCAG ≥ 4.5:1) sur le fond du thème actif, en gardant la teinte.
 */

export type Rgb = { r: number; g: number; b: number };
export type Scheme = 'light' | 'dark';

/** Couleurs de référence du thème (doivent suivre styles.css). */
export const THEME = {
  light: {
    // Fond le plus défavorable sur lequel le texte d'étape peut apparaître
    // (--surface-2, utilisé par les blocs de quête) : si ça passe ici,
    // ça passe aussi sur la carte blanche.
    background: { r: 0xeb, g: 0xe6, b: 0xdb },
    text: { r: 0x1c, g: 0x1b, b: 0x18 },
  },
  dark: {
    background: { r: 0x2a, g: 0x2e, b: 0x35 },
    text: { r: 0xec, g: 0xe9, b: 0xe2 },
  },
} as const satisfies Record<Scheme, { background: Rgb; text: Rgb }>;

export const MIN_CONTRAST = 4.5;

const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

/** Lit une couleur CSS simple : #rgb, #rrggbb, rgb(), rgba(). Sinon null. */
export function parseColor(input: string): (Rgb & { a: number }) | null {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m?.[1]) {
    const [r, g, b] = [...m[1]].map((c) => parseInt(c + c, 16)) as [number, number, number];
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m?.[1]) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(s);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: clamp255(Number(m[1])), g: clamp255(Number(m[2])), b: clamp255(Number(m[3])), a };
  }
  return null;
}

export function toCss({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- HSL ---

type Hsl = { h: number; s: number; l: number };

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = clamp255(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const conv = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: clamp255(conv(hk + 1 / 3) * 255), g: clamp255(conv(hk) * 255), b: clamp255(conv(hk - 1 / 3) * 255) };
}

/**
 * Renvoie la couleur `fg` (même teinte et saturation) dont la luminosité a été
 * déplacée le moins possible pour atteindre `min` de contraste avec `against`.
 * On assombrit si `against` est clair, on éclaircit s'il est sombre.
 */
export function ensureContrast(fg: Rgb, against: Rgb, min = MIN_CONTRAST): Rgb {
  if (contrast(fg, against) >= min) return fg;
  const hsl = rgbToHsl(fg);
  const darken = luminance(against) > 0.18;
  // Recherche dichotomique de la luminosité la plus proche de l'originale.
  let ok = darken ? 0 : 1; // extrême qui passe forcément (ou presque)
  let ko = hsl.l; // originale, qui ne passe pas
  for (let i = 0; i < 20; i++) {
    const mid = (ok + ko) / 2;
    if (contrast(hslToRgb({ ...hsl, l: mid }), against) >= min) ok = mid;
    else ko = mid;
  }
  const out = hslToRgb({ ...hsl, l: ok });
  // Sécurité : si même l'extrême ne suffit pas, noir ou blanc.
  if (contrast(out, against) < min) return darken ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  return out;
}

/** Couleur de texte en ligne adaptée au thème. */
export function adjustTextColor(css: string, scheme: Scheme): string | null {
  const c = parseColor(css);
  if (!c) return null;
  return toCss(ensureContrast(c, THEME[scheme].background));
}

/**
 * Surlignage (background-color) adapté au thème : on ajuste le fond pour que
 * le texte normal du thème reste lisible dessus.
 */
export function adjustBackgroundColor(css: string, scheme: Scheme): string | null {
  const c = parseColor(css);
  if (!c) return null;
  if (c.a === 0) return 'transparent';
  return toCss(ensureContrast(c, THEME[scheme].text));
}
