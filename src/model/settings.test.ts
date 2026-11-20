import { describe, expect, it } from 'vitest';
import { nextFontScale } from './settings';

describe('nextFontScale', () => {
  it('monte et descend dans l’échelle, bornée', () => {
    expect(nextFontScale(1, 1)).toBe(1.15);
    expect(nextFontScale(1.15, 1)).toBe(1.3);
    expect(nextFontScale(1, -1)).toBe(0.85);
    expect(nextFontScale(0.85, -1)).toBe(0.85);
    expect(nextFontScale(1.75, 1)).toBe(1.75);
  });
  it('valeur hors échelle : se recale', () => {
    expect(nextFontScale(1.2, 1)).toBe(1.5);
    expect(nextFontScale(9, -1)).toBe(1.5);
  });
});
