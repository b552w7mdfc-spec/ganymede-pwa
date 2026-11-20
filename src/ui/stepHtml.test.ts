import { describe, expect, it } from 'vitest';
import { contrast, parseColor, THEME } from './color';
import { renderStepHtml } from './stepHtml';
import { loadSampleGuide } from '../test/samples';

const guide2 = loadSampleGuide(2);
const guide2975 = loadSampleGuide(2975);
const guide3595 = loadSampleGuide(3595);
const HAS_SAMPLES = !!(guide2 && guide2975 && guide3595);

const colorsIn = (html: string) => [...html.matchAll(/(?<!-)color: (rgb\([^)]*\))/g)].map((m) => m[1]!);

describe.skipIf(!HAS_SAMPLES)('renderStepHtml : couleurs des échantillons (docs/samples/)', () => {
  it('toutes les couleurs du guide [GP1] atteignent 4.5:1 dans les deux thèmes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      let n = 0;
      for (const step of guide2!.steps) {
        for (const c of colorsIn(renderStepHtml(step.web_text, scheme).html)) {
          n++;
          expect(contrast(parseColor(c)!, THEME[scheme].background)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(n).toBeGreaterThan(1500);
    }
  });
});

describe('renderStepHtml : styles', () => {

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

import { dofusDbUrl } from './stepHtml';

const SAMPLES = HAS_SAMPLES ? { 2: guide2!.steps, 2975: guide2975!.steps, 3595: guide3595!.steps } : {};
const parse = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe.skipIf(!HAS_SAMPLES)('renderStepHtml : balises Ganymède sur les échantillons (docs/samples/)', () => {
  for (const [id, steps] of Object.entries(SAMPLES)) {
    it(`guide ${id} : chaque balise est interprétée`, () => {
      for (const step of steps) {
        const src = step.web_text;
        const { html, taskCount } = renderStepHtml(src, 'light');
        const dom = parse(html);

        // custom-tag -> pastille avec icône, nom et identifiant DofusDB
        const tags = dom.querySelectorAll<HTMLElement>('.ctag');
        expect(tags.length).toBe(count(src, /data-type="custom-tag"/g));
        for (const t of tags) {
          expect(t.querySelector('svg.ico')).not.toBeNull();
          expect(t.dataset.name).toBeTruthy();
          expect(t.querySelector('.ctag-name')?.textContent).toBe(t.dataset.name);
          expect(t.dataset.dofusdbid).toMatch(/^\d+$/);
          expect(['monster', 'item', 'quest', 'dungeon']).toContain(t.dataset.tagType);
        }

        // guide-step -> lien avec données de navigation
        const links = dom.querySelectorAll<HTMLElement>('.gstep');
        expect(links.length).toBe(count(src, /data-type="guide-step"/g));
        for (const l of links) {
          expect(l.dataset.guideid).toMatch(/^\d+$/);
          expect(l.dataset.stepnumber).toMatch(/^\d+$/);
          expect(l.textContent?.trim()).toBeTruthy();
        }

        // quest-block -> en-tête nom + badge de statut
        const blocks = dom.querySelectorAll('.qblock');
        expect(blocks.length).toBe(count(src, /data-type="quest-block"/g));
        for (const b of blocks) {
          expect(b.firstElementChild?.classList.contains('qb-head')).toBe(true);
          expect(b.querySelector('.qb-name')?.textContent).toBeTruthy();
          expect(b.querySelector('.qb-status')?.textContent).toMatch(/^(Setup|Début|En cours|Fin)$/);
        }

        // Listes de tâches -> cases actives, numérotées dans l'ordre
        expect(taskCount).toBe(count(src, /data-type="taskItem"/g));
        const boxes = [...dom.querySelectorAll<HTMLInputElement>('input[data-task-index]')];
        expect(boxes.map((b) => Number(b.dataset.taskIndex))).toEqual([...Array(taskCount).keys()]);
        for (const b of boxes) expect(b.disabled).toBe(false);
      }
    });
  }

  it('cas précis du guide [GP1] : liens interne et externe, quête, monstre', () => {
    const step = (n: number) => parse(renderStepHtml(guide2!.steps[n - 1]!.web_text, 'dark').html);
    // Étape 127 : lien vers [GP4] (guide 3), début du guide
    const toOther = [...step(127).querySelectorAll<HTMLElement>('.gstep')].find((l) => l.dataset.guideid === '3');
    expect(toOther?.dataset).toMatchObject({ stepid: '0', stepnumber: '1' });
    // Étape 191 : lien interne vers l'étape 184
    const internal = step(191).querySelector<HTMLElement>('.gstep');
    expect(internal?.dataset).toMatchObject({ guideid: '0', stepnumber: '184' });
    // Étape 3 : quête « Réponses à tout », statut fin
    const qb = step(3).querySelector('.qblock');
    expect(qb?.querySelector('.qb-name')?.textContent).toBe('Réponses à tout');
    expect(qb?.querySelector('.qb-status')?.textContent).toBe('Fin');
  });

});

describe('renderStepHtml : sécurité et images', () => {
  it('les images hors pastilles sont agrandissables, pas celles des pastilles', () => {
    const dom = parse(
      renderStepHtml(
        '<p><img src="https://i.imgur.com/x.png"><span data-type="custom-tag" type="item" name="Blé" dofusdbid="289"><img src="https://api.dofusdb.fr/img/items/1.png"><span>Blé</span></span></p>',
        'light',
      ).html,
    );
    expect(dom.querySelectorAll('img.zoomable')).toHaveLength(1);
    expect(dom.querySelector('.ctag img')?.classList.contains('zoomable')).toBe(false);
  });

  it('le nom d’une balise est inséré comme texte, jamais comme HTML', () => {
    const dom = parse(renderStepHtml('<span data-type="custom-tag" type="item" name="<img src=x onerror=alert(1)>" dofusdbid="1">x</span>', 'light').html);
    expect(dom.querySelector('.ctag-name img')).toBeNull();
    expect(dom.querySelectorAll('img')).toHaveLength(0);
    expect(dom.innerHTML).not.toContain('<img');
  });
});

describe('dofusDbUrl', () => {
  it('item -> object, autres types tels quels', () => {
    expect(dofusDbUrl('item', '289')).toBe('https://dofusdb.fr/fr/database/object/289');
    expect(dofusDbUrl('monster', '8018')).toBe('https://dofusdb.fr/fr/database/monster/8018');
    expect(dofusDbUrl('quest', '1631')).toBe('https://dofusdb.fr/fr/database/quest/1631');
    expect(dofusDbUrl('dungeon', '12')).toBe('https://dofusdb.fr/fr/database/dungeon/12');
    expect(dofusDbUrl('wakfu-item', '1')).toBeNull();
    expect(dofusDbUrl('item', 'abc')).toBeNull();
  });
});
