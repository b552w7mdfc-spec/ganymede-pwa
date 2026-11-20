import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Échantillons réels de l'API Ganymède (docs/samples/). Ils ne sont PAS
 * versionnés (contenu des guides non publiable) : absents en CI, les tests
 * qui en dépendent sont alors ignorés.
 */
// Vitest s'exécute à la racine du projet.
const dir = join(process.cwd(), 'docs', 'samples');

export interface SampleStep {
  web_text: string;
}
export interface SampleGuide {
  id: number;
  steps: SampleStep[];
}

export function loadSampleGuide(id: number): SampleGuide | null {
  const file = join(dir, `guide_${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as SampleGuide;
}
