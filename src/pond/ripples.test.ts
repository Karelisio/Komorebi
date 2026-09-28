import { describe, expect, it } from 'vitest';
import { RippleField } from './ripples';

describe('RippleField', () => {
  it('une perturbation se propage puis s’amortit', () => {
    const f = new RippleField(48, 32);
    f.disturb(0.5, 0.5, 0.05, 1);
    const e0 = f.energy();
    expect(e0).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) f.step();
    // L'onde s'est propagée : il y a du mouvement loin du centre.
    expect(Math.abs(f.heightAt(24 + 6, 16))).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) f.step();
    expect(f.energy()).toBeLessThan(e0 * 0.2);
  });

  it('les cellules hors masque restent immobiles', () => {
    const mask = new Uint8Array(20 * 20).fill(1);
    mask[10 * 20 + 15] = 0;
    const f = new RippleField(20, 20, mask);
    f.disturb(0.5, 0.5, 0.2, 1);
    for (let i = 0; i < 20; i++) f.step();
    expect(f.heightAt(15, 10)).toBe(0);
  });
});
