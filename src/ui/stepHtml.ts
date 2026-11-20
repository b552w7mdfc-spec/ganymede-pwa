import { adjustBackgroundColor, adjustTextColor, type Scheme } from './color';
import { ICONS, type IconName } from './icons';
import { sanitizeToFragment } from './sanitize';

export interface RenderedStep {
  html: string;
  /** Nombre de cases à cocher (index 0..taskCount-1, ordre d'apparition). */
  taskCount: number;
}

// ---------- Styles ----------

const ALLOWED_ALIGN = new Set(['left', 'right', 'center', 'justify']);

/**
 * Ne garde que les styles en ligne utiles (couleur, surlignage, alignement)
 * et adapte les couleurs au thème pour rester lisibles.
 */
function rewriteStyles(root: ParentNode, scheme: Scheme): void {
  for (const el of root.querySelectorAll<HTMLElement>('[style]')) {
    const color = el.style.getPropertyValue('color');
    const bg = el.style.getPropertyValue('background-color');
    const align = el.style.getPropertyValue('text-align');
    el.removeAttribute('style');
    const c = color ? adjustTextColor(color, scheme) : null;
    const b = bg ? adjustBackgroundColor(bg, scheme) : null;
    if (c) el.style.setProperty('color', c);
    if (b) el.style.setProperty('background-color', b);
    if (align && ALLOWED_ALIGN.has(align)) el.style.setProperty('text-align', align);
    if (!el.getAttribute('style')) el.removeAttribute('style');
  }
}

// ---------- Balises Ganymède ----------

export type CustomTagType = 'monster' | 'item' | 'quest' | 'dungeon';
const TAG_TYPES = new Set<string>(['monster', 'item', 'quest', 'dungeon']);

/** Section DofusDB correspondant à un type de balise. */
export const DOFUSDB_SECTION: Record<CustomTagType, string> = {
  item: 'object',
  monster: 'monster',
  quest: 'quest',
  dungeon: 'dungeon',
};

export function dofusDbUrl(type: string, id: string): string | null {
  if (!TAG_TYPES.has(type) || !/^\d+$/.test(id)) return null;
  return `https://dofusdb.fr/fr/database/${DOFUSDB_SECTION[type as CustomTagType]}/${id}`;
}

export const QUEST_STATUS_LABELS: Record<string, string> = {
  setup: 'Setup',
  start: 'Début',
  in_progress: 'En cours',
  end: 'Fin',
};

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function icon(name: IconName): DocumentFragment {
  const t = document.createElement('template');
  t.innerHTML = ICONS[name];
  return t.content;
}

function renderCustomTags(root: ParentNode): void {
  for (const tag of root.querySelectorAll<HTMLElement>('[data-type="custom-tag"]')) {
    const rawType = tag.getAttribute('type') ?? '';
    const type = TAG_TYPES.has(rawType) ? rawType : 'generic';
    const name = (tag.getAttribute('name') || tag.textContent || '').trim();
    const id = tag.getAttribute('dofusdbid') ?? tag.getAttribute('data-id') ?? '';
    const img = tag.querySelector('img')?.getAttribute('src') ?? null;

    const pill = el('span', {
      class: `ctag ctag-${type}`,
      'data-type': 'custom-tag',
      'data-tag-type': type,
      'data-name': name,
      'data-dofusdbid': id,
      role: 'button',
      tabindex: '0',
    });
    pill.appendChild(icon(type === 'generic' ? 'generic' : (type as IconName)));
    // Les vignettes d'objets et de monstres aident à les reconnaître.
    if (img && (type === 'item' || type === 'monster'))
      pill.appendChild(el('img', { class: 'ctag-img', src: img, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
    pill.appendChild(el('span', { class: 'ctag-name' }, name));
    tag.replaceWith(pill);
  }
}

function renderGuideSteps(root: ParentNode): void {
  for (const tag of root.querySelectorAll<HTMLElement>('[data-type="guide-step"]')) {
    const guideId = tag.getAttribute('guideid') ?? '0';
    const stepId = tag.getAttribute('stepid') ?? '0';
    const stepNumber = tag.getAttribute('stepnumber') ?? '1';
    const text = (tag.textContent || tag.getAttribute('label') || tag.getAttribute('guidename') || `Étape ${stepNumber}`).trim();
    const link = el('span', {
      class: 'gstep',
      'data-type': 'guide-step',
      'data-guideid': /^\d+$/.test(guideId) ? guideId : '0',
      'data-stepid': /^\d+$/.test(stepId) ? stepId : '0',
      'data-stepnumber': /^\d+$/.test(stepNumber) ? stepNumber : '1',
      role: 'link',
      tabindex: '0',
    });
    link.appendChild(icon('guide'));
    link.appendChild(el('span', {}, text));
    tag.replaceWith(link);
  }
}

function renderQuestBlocks(root: ParentNode): void {
  for (const block of root.querySelectorAll<HTMLElement>('[data-type="quest-block"]')) {
    const name = (block.getAttribute('questname') || block.getAttribute('title') || 'Quête').trim();
    const raw = block.getAttribute('status') ?? '';
    const status = raw in QUEST_STATUS_LABELS ? raw : 'unknown';
    block.setAttribute('class', `qblock qblock-${status}`);
    block.removeAttribute('title');
    const head = el('div', { class: 'qb-head' });
    head.appendChild(icon('quest'));
    head.appendChild(el('span', { class: 'qb-name' }, name));
    if (status !== 'unknown') head.appendChild(el('span', { class: `qb-status qb-status-${status}` }, QUEST_STATUS_LABELS[status]));
    block.prepend(head);
  }
}

function renderTasks(root: ParentNode): number {
  let i = 0;
  for (const item of root.querySelectorAll<HTMLElement>('[data-type="taskItem"]')) {
    item.removeAttribute('data-checked');
    let input = item.querySelector<HTMLInputElement>(':scope > label > input, :scope input');
    if (!input) {
      input = el('input') as HTMLInputElement;
      const label = el('label');
      label.appendChild(input);
      item.prepend(label);
    }
    input.setAttribute('type', 'checkbox');
    input.removeAttribute('disabled');
    input.setAttribute('data-task-index', String(i));
    const label = item.textContent?.trim().slice(0, 80);
    if (label) input.setAttribute('aria-label', label);
    i++;
  }
  return i;
}

function markZoomableImages(root: ParentNode): void {
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    if (img.closest('.ctag, .gstep')) continue;
    img.classList.add('zoomable');
  }
}

/** Transforme le web_text d'une étape en HTML sûr, interactif et adapté au thème. */
export function renderStepHtml(webText: string, scheme: Scheme): RenderedStep {
  const frag = sanitizeToFragment(webText);
  rewriteStyles(frag, scheme);
  renderCustomTags(frag);
  renderGuideSteps(frag);
  renderQuestBlocks(frag);
  const taskCount = renderTasks(frag);
  markZoomableImages(frag);
  const box = document.createElement('div');
  box.appendChild(frag);
  return { html: box.innerHTML, taskCount };
}
