import { describe, expect, it } from 'vitest';
import { contrast, parseColor, THEME } from './color';
import { renderStepHtml } from './stepHtml';
import guide2 from '../../docs/samples/guide_2.json';

const colorsIn = (html: string) => [...html.matchAll(/(?<!-)color: (rgb\([^)]*\))/g)].map((m) => m[1]!);

describe('renderStepHtml : couleurs', () => {
  it('toutes les couleurs du guide [GP1] atteignent 4.5:1 dans les deux thèmes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      let n = 0;
      for (const step of guide2.steps) {
        for (const c of colorsIn(renderStepHtml(step.web_text, scheme).html)) {
          n++;
          expect(contrast(parseColor(c)!, THEME[scheme].background)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(n).toBeGreaterThan(1500);
    }
  });

  it('ne garde que couleur, surlignage et alignement', () => {
    const html = renderStepHtml(
      '<p style="text-align: center; position: fixed; width: 900px">a<span style="color: rgb(255, 255, 0); background-color: rgb(0, 0, 0); font-size: 40px">b</span></p>',
      'light',
    ).html;
    expect(html).not.toMatch(/position|width|font-size/);
    expect(html).toContain('text-align: center');
    expect(html).toMatch(/color: rgb\(\d+, \d+, 0\)/);
    expect(html).toContain('background-color');
  });
});
