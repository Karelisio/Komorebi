import { describe, expect, it } from 'vitest';
import { MAIN_POND } from '@/world/layout';
import { mulberry32 } from '@/world/random';
import { spawnAgent, stepBoids, edgeInfo, type BoidsWorld } from './boids';
import { createKoi, koiSize, starterKois, stepPondHour } from './koi';

const DAY = 86_400_000;

describe('cycle de vie des koïs', () => {
  it('la taille croît avec l’âge puis plafonne', () => {
    const now = Date.UTC(2026, 3, 1);
    const k = createKoi({ seed: 1, now, pondId: 'main' });
    expect(koiSize(k, now)).toBeCloseTo(0.3);
    expect(koiSize(k, now + 6 * DAY)).toBeGreaterThan(0.6);
    expect(koiSize(k, now + 60 * DAY)).toBe(1);
  });

  it('des alevins naissent au printemps quand les poissons sont nourris', () => {
    const now = Date.UTC(2026, 3, 10);
    let kois = starterKois(now, 'main').map((k) => ({ ...k, satiety: 1 }));
    let births = 0;
    for (let h = 0; h < 24 * 20; h++) {
      const res = stepPondHour(kois, {
        pondId: 'main',
        capacity: 14,
        season: 'spring',
        now: now + h * 3600_000,
        seed: h,
      });
      kois = res.kois.map((k) => ({ ...k, satiety: 1 }));
      births += res.births.length;
    }
    expect(births).toBeGreaterThan(0);
    expect(kois.length).toBeLessThanOrEqual(14);
    const fry = kois.find((k) => k.parents);
    expect(fry).toBeDefined();
  });

  it('aucune naissance en hiver', () => {
    const now = Date.UTC(2026, 0, 10);
    const kois = starterKois(now, 'main').map((k) => ({ ...k, satiety: 1 }));
    for (let h = 0; h < 500; h++) {
      expect(
        stepPondHour(kois, { pondId: 'main', capacity: 14, season: 'winter', now, seed: h }).births,
      ).toHaveLength(0);
    }
  });
});

describe('boids', () => {
  it('les poissons restent dans le bassin', () => {
    const rng = mulberry32(3);
    const agents = Array.from({ length: 8 }, (_, i) => spawnAgent(`f${i}`, MAIN_POND, rng, 0.8));
    const world: BoidsWorld = { shape: MAIN_POND, food: [], attractor: null, time: 0 };
    for (let i = 0; i < 60 * 120; i++) {
      world.time += 1 / 60;
      stepBoids(agents, world, 1 / 60, rng);
    }
    for (const a of agents) expect(edgeInfo(MAIN_POND, a.x, a.y).dist).toBeGreaterThan(-6);
  });

  it('les poissons trouvent et mangent la nourriture', () => {
    const rng = mulberry32(4);
    const agents = Array.from({ length: 5 }, (_, i) => spawnAgent(`f${i}`, MAIN_POND, rng, 1));
    const world: BoidsWorld = {
      shape: MAIN_POND,
      food: [{ id: 1, x: MAIN_POND.cx + 40, y: MAIN_POND.cy, age: 0 }],
      attractor: null,
      time: 0,
    };
    let eaten = 0;
    for (let i = 0; i < 60 * 30 && world.food.length; i++) {
      world.time += 1 / 60;
      stepBoids(agents, world, 1 / 60, rng, { onEat: () => eaten++ });
    }
    expect(eaten).toBe(1);
    expect(world.food).toHaveLength(0);
  });
});
