import { describe, expect, it } from 'vitest';
import { classifySwipe } from './useSwipe';

describe('classifySwipe', () => {
  it('balayage franc vers la gauche / la droite', () => {
    expect(classifySwipe(-120, 10, 200)).toBe('left');
    expect(classifySwipe(120, -15, 200)).toBe('right');
  });
  it('ignore les petits mouvements (seuil franc)', () => {
    expect(classifySwipe(-60, 0, 100)).toBeNull();
  });
  it('ignore les gestes surtout verticaux (défilement)', () => {
    expect(classifySwipe(-100, 80, 200)).toBeNull();
    expect(classifySwipe(10, 300, 200)).toBeNull();
  });
  it('ignore les gestes trop lents (sélection, hésitation)', () => {
    expect(classifySwipe(-200, 0, 1500)).toBeNull();
  });
});
