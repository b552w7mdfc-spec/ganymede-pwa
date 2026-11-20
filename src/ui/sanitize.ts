import DOMPurify from 'dompurify';

/** Attributs propres aux balises Ganymède, conservés pour le futur lecteur. */
const GANYMEDE_ATTRS = [
  'target', 'dofusdbid', 'imageurl', 'guideid', 'stepid', 'stepnumber', 'guidename', 'label',
  'baseurl', 'questid', 'questname', 'status',
];

let hooked = false;

function ensureHooks(): void {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    } else if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('referrerpolicy', 'no-referrer');
    } else if (node.tagName === 'INPUT') {
      // Cases des listes de tâches : affichage seul pour l'instant.
      node.setAttribute('disabled', '');
    }
  });
}

/** Nettoie le HTML d'une étape (web_text) avant affichage. */
export function sanitizeStepHtml(html: string): string {
  ensureHooks();
  return DOMPurify.sanitize(html, {
    ADD_ATTR: GANYMEDE_ATTRS,
    FORBID_TAGS: ['style', 'form', 'button', 'iframe', 'object', 'embed', 'textarea', 'select'],
    FORBID_ATTR: ['id'],
  });
}
