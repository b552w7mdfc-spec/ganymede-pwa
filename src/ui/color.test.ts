import { describe, expect, it } from 'vitest';
import {
  adjustBackgroundColor,
  adjustTextColor,
  contrast,
  MIN_CONTRAST,
  parseColor,
  rgbToHsl,
  THEME,
} from './color';

const rgb = (css: string) => {
  const c = parseColor(css);
  if (!c) throw new Error(css);
  return c;
};

// Couleurs réellement utilisées dans les échantillons de docs/samples/.
const SAMPLE_COLORS = [
  'rgb(255, 255, 0)', 'rgb(98, 172, 255)', 'rgb(250, 0, 0)', 'rgb(255, 255, 255)',
  'rgb(5, 160, 69)', 'rgb(216, 27, 67)', 'rgb(255, 167, 39)', 'rgb(76, 176, 80)',
  'rgb(235, 65, 101)', 'rgb(255, 183, 78)', '#ffff00', '#000', 'rgb(0, 0, 0)',
];

describe('parseColor', () => {
  it('lit hex court/long, rgb et rgba', () => {
    expect(parseColor('#ff0')).toEqual({ r: 255, g: 255, b: 0, a: 1 });
    expect(parseColor('#62ACFF')).toEqual({ r: 98, g: 172, b: 255, a: 1 });
    expect(parseColor('rgb(5, 160, 69)')).toEqual({ r: 5, g: 160, b: 69, a: 1 });
    expect(parseColor('rgba(5,160,69,0.5)')).toEqual({ r: 5, g: 160, b: 69, a: 0.5 });
    expect(parseColor('red')).toBeNull();
    expect(parseColor('var(--x)')).toBeNull();
  });
});

describe('adjustTextColor', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it.each(SAMPLE_COLORS)(`%s atteint 4.5:1 en thème ${scheme}`, (css) => {
      const out = adjustTextColor(css, scheme);
      expect(out).not.toBeNull();
      expect(contrast(rgb(out!), THEME[scheme].background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  }

  it('jaune reste jaune (teinte conservée) mais foncé en thème clair', () => {
    const out = rgb(adjustTextColor('rgb(255, 255, 0)', 'light')!);
    const hsl = rgbToHsl(out);
    expect(hsl.h).toBeGreaterThan(50);
    expect(hsl.h).toBeLessThan(70);
    expect(out.r).toBeLessThan(160);
    expect(out.r).toBe(out.g);
    expect(out.b).toBe(0);
  });

  it('ne change pas une couleur déjà lisible', () => {
    expect(adjustTextColor('rgb(255, 255, 0)', 'dark')).toBe('rgb(255, 255, 0)');
    expect(adjustTextColor('rgb(0, 0, 0)', 'light')).toBe('rgb(0, 0, 0)');
  });

  it('bleu des directions éclairci en sombre seulement si nécessaire, assombri en clair', () => {
    const light = rgb(adjustTextColor('rgb(98, 172, 255)', 'light')!);
    expect(light.b).toBeGreaterThan(light.r);
    expect(luminanceOrder(light, rgb('rgb(98, 172, 255)'))).toBe('darker');
  });

  it('modifie le moins possible (juste au-dessus du seuil)', () => {
    const out = rgb(adjustTextColor('rgb(255, 255, 0)', 'light')!);
    expect(contrast(out, THEME.light.background)).toBeLessThan(MIN_CONTRAST + 0.3);
  });

  it('couleur illisible -> null', () => {
    expect(adjustTextColor('inherit', 'light')).toBeNull();
  });
});

describe('adjustBackgroundColor', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it.each(['rgb(255, 255, 0)', 'rgb(0, 0, 128)', 'rgb(250, 0, 0)', '#fff'])(
      `surlignage %s lisible avec le texte du thème ${scheme}`,
      (css) => {
        const out = adjustBackgroundColor(css, scheme)!;
        expect(contrast(rgb(out), THEME[scheme].text)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      },
    );
  }
  it('transparent reste transparent', () => {
    expect(adjustBackgroundColor('rgba(0, 0, 0, 0)', 'light')).toBe('transparent');
  });
});

function luminanceOrder(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  return rgbToHsl(a).l < rgbToHsl(b).l ? 'darker' : 'lighter';
}
