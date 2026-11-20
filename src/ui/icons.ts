/** Petites icônes SVG (dessinées pour l'appli), en chaînes pour le HTML des étapes. */

const svg = (body: string) =>
  `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  // Tête de monstre : crâne cornu.
  monster: svg(
    '<path d="M3 6.5C3 4 5.2 2.5 8 2.5S13 4 13 6.5c0 1.7-.8 2.8-2 3.4V12H5V9.9C3.8 9.3 3 8.2 3 6.5Z"/><circle cx="6" cy="6.8" r=".9" fill="currentColor"/><circle cx="10" cy="6.8" r=".9" fill="currentColor"/><path d="M7 12v1.5M9 12v1.5M3.5 3.5 2 1.8M12.5 3.5 14 1.8"/>',
  ),
  // Objet : sacoche.
  item: svg('<path d="M3 6h10l-1 7.5H4L3 6Z"/><path d="M5.5 6V4.5a2.5 2.5 0 0 1 5 0V6"/>'),
  // Quête : point d'exclamation dans une bulle.
  quest: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.8v4"/><circle cx="8" cy="11.2" r=".6" fill="currentColor"/>'),
  // Donjon : porte en arche.
  dungeon: svg('<path d="M3 14V7a5 5 0 0 1 10 0v7"/><path d="M2 14h12"/><path d="M6 14V9.5a2 2 0 0 1 4 0V14"/>'),
  // Lien vers une étape / un guide : livre avec flèche.
  guide: svg('<path d="M2.5 3h4A1.5 1.5 0 0 1 8 4.5V14a1.5 1.5 0 0 0-1.5-1.5h-4V3Z"/><path d="M13.5 3h-4A1.5 1.5 0 0 0 8 4.5V14a1.5 1.5 0 0 1 1.5-1.5h4V3Z"/>'),
  generic: svg('<circle cx="8" cy="8" r="5.5"/>'),
} as const;

export type IconName = keyof typeof ICONS;
