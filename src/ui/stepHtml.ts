import { adjustBackgroundColor, adjustTextColor, type Scheme } from './color';
import { sanitizeToFragment } from './sanitize';

export interface RenderedStep {
  html: string;
}

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

/** Transforme le web_text d'une étape en HTML sûr et adapté au thème. */
export function renderStepHtml(webText: string, scheme: Scheme): RenderedStep {
  const frag = sanitizeToFragment(webText);
  rewriteStyles(frag, scheme);
  const box = document.createElement('div');
  box.appendChild(frag);
  return { html: box.innerHTML };
}
