import { describe, expect, it } from 'vitest';
import { sanitizeStepHtml } from './sanitize';

describe('sanitizeStepHtml', () => {
  it('retire scripts et gestionnaires d’événements', () => {
    const out = sanitizeStepHtml('<p onclick="x()">a<script>alert(1)</script><img src="x" onerror="y()"></p>');
    expect(out).not.toMatch(/script|onclick|onerror/);
  });

  it('force les liens externes en nouvel onglet', () => {
    const out = sanitizeStepHtml('<a href="https://youtube.com">v</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('conserve les balises Ganymède et leurs attributs', () => {
    const html =
      '<span class="tag-item" data-type="custom-tag" dofusdbid="17078" type="item" imageurl="https://api.dofusdb.fr/img/items/1.png">Dokoko</span>' +
      '<span data-type="guide-step" guideid="0" stepid="12" stepnumber="12">ici</span>';
    const out = sanitizeStepHtml(html);
    expect(out).toContain('data-type="custom-tag"');
    expect(out).toContain('dofusdbid="17078"');
    expect(out).toContain('stepnumber="12"');
  });

  it('désactive les cases à cocher', () => {
    const out = sanitizeStepHtml('<ul data-type="taskList"><li data-type="taskItem"><input type="checkbox"></li></ul>');
    expect(out).toMatch(/<input[^>]*disabled/);
  });
});
