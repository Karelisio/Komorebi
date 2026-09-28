import { describe, expect, it } from 'vitest';
import type { GardenObject } from '@/state/types';
import {
  bloomOf,
  bonsaiStyle,
  canHarvest,
  harvestYield,
  prune,
  stageOf,
  stepObjectHour,
  thirst,
  water,
} from './growth';

const base = (over: Partial<GardenObject> = {}): GardenObject => ({
  id: 'o',
  kind: 'maple',
  x: 0,
  y: 0,
  seed: 1,
  placedAt: 0,
  water: 1,
  lastWateredAt: 0,
  prune: 0,
  pruneCount: 0,
  growth: 0,
  flip: false,
  harvestAt: 0,
  ...over,
});
const spring = { season: 'spring' as const, day: 100, rain: 0, temperature: 15, snow: 0 };

describe('croissance du jardin', () => {
  it('un érable arrosé atteint la maturité en ~6 jours', () => {
    let o = base();
    for (let h = 0; h < 24 * 6; h++) o = water(stepObjectHour(o, spring), 0.05, h);
    expect(o.growth).toBeCloseTo(1, 1);
    expect(stageOf(o)).toBe(4);
  });

  it('sans eau la plante ralentit et devient terne, mais ne meurt jamais', () => {
    let o = base();
    for (let h = 0; h < 24 * 30; h++) o = stepObjectHour(o, spring);
    expect(o.water).toBe(0);
    expect(thirst(o)).toBe(1);
    expect(o.growth).toBeGreaterThan(0);
    expect(o.growth).toBeLessThanOrEqual(1);
  });

  it('la pluie arrose', () => {
    const o = stepObjectHour(base({ water: 0.2 }), { ...spring, rain: 3 });
    expect(o.water).toBeGreaterThan(0.2);
  });

  it('croissance ralentie en hiver', () => {
    const w = stepObjectHour(base(), { ...spring, season: 'winter' });
    const s = stepObjectHour(base(), spring);
    expect(w.growth).toBeLessThan(s.growth);
  });

  it('les objets inertes ne changent pas', () => {
    const lantern = base({ kind: 'lantern', growth: 1 });
    expect(stepObjectHour(lantern, spring)).toBe(lantern);
  });

  it('floraison du cerisier début avril, pas en août', () => {
    expect(bloomOf('cherry', 95)).toBeCloseTo(1);
    expect(bloomOf('cherry', 220)).toBe(0);
  });

  it('la taille façonne progressivement un bonsaï', () => {
    let o = base({ growth: 1 });
    expect(bonsaiStyle(o)).toBe('free');
    for (let i = 0; i < 12; i++) o = prune(o);
    expect(bonsaiStyle(o)).toBe('bonsai');
  });

  it('récolte : plantes mûres uniquement, bonus en floraison', () => {
    expect(canHarvest(base({ growth: 0.5 }), 10)).toBe(false);
    const cherry = base({ kind: 'cherry', growth: 1 });
    expect(canHarvest(cherry, 10)).toBe(true);
    expect(harvestYield(cherry, 95)).toBeGreaterThan(harvestYield(cherry, 220));
  });
});
