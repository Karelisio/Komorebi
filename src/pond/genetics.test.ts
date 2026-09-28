import { describe, expect, it } from 'vitest';
import { breed, express, randomGenome, type Genome } from './genetics';

describe('génétique des koïs', () => {
  it('les gabarits de départ expriment la bonne variété', () => {
    expect(express(randomGenome(1, 'kohaku')).variety).toBe('kohaku');
    expect(express(randomGenome(2, 'sanke')).variety).toBe('sanke');
    expect(express(randomGenome(3, 'showa')).variety).toBe('showa');
    expect(express(randomGenome(4, 'chagoi')).variety).toBe('chagoi');
    expect(express(randomGenome(5, 'ogon')).variety).toBe('ogon');
    expect(express(randomGenome(6, 'asagi')).variety).toBe('asagi');
  });

  it('dominance : W domine K, N domine d', () => {
    const g = randomGenome(9, 'kohaku');
    expect(express({ ...g, ground: ['K', 'W'] }).ground).toBe('W');
    expect(express({ ...g, scales: ['d', 'N'] }).doitsu).toBe(false);
    expect(express({ ...g, scales: ['d', 'd'] }).doitsu).toBe(true);
  });

  it('chaque allèle d’un alevin vient d’un parent (sans mutation)', () => {
    const a = randomGenome(10);
    const b = randomGenome(11);
    for (let seed = 0; seed < 200; seed++) {
      const c = breed(a, b, seed, 0);
      expect(a.ground).toContain(c.ground[0]);
      expect(b.ground).toContain(c.ground[1]);
      expect(a.scales).toContain(c.scales[0]);
      expect(b.scales).toContain(c.scales[1]);
    }
  });

  it('deux parents doitsu homozygotes donnent des alevins doitsu', () => {
    const a: Genome = { ...randomGenome(12), scales: ['d', 'd'] };
    const b: Genome = { ...randomGenome(13), scales: ['d', 'd'] };
    for (let seed = 0; seed < 50; seed++) expect(express(breed(a, b, seed, 0)).doitsu).toBe(true);
  });

  it('ratio mendélien ~1/4 pour un caractère récessif (porteurs × porteurs)', () => {
    const a: Genome = { ...randomGenome(14, 'kohaku'), butterfly: ['B', 'b'] };
    const b: Genome = { ...randomGenome(15, 'kohaku'), butterfly: ['B', 'b'] };
    let count = 0;
    const n = 4000;
    for (let seed = 0; seed < n; seed++) if (express(breed(a, b, seed, 0)).butterfly) count++;
    expect(count / n).toBeGreaterThan(0.21);
    expect(count / n).toBeLessThan(0.29);
  });

  it('les motifs sont hérités des parents (taches proches)', () => {
    const a = randomGenome(16, 'kohaku');
    const b = randomGenome(17, 'kohaku');
    const c = breed(a, b, 99, 0);
    const parents = [...a.hiPatches, ...b.hiPatches];
    const inherited = c.hiPatches.filter((p) =>
      parents.some((q) => Math.abs(q.t - p.t) < 0.06 && Math.abs(q.s - p.s) < 0.2),
    );
    expect(inherited.length).toBeGreaterThan(0);
  });

  it('le croisement est déterministe pour une même graine', () => {
    const a = randomGenome(20);
    const b = randomGenome(21);
    expect(breed(a, b, 5)).toEqual(breed(a, b, 5));
  });

  it('la rareté augmente avec gin-rin et nageoires papillon', () => {
    const g = randomGenome(30, 'kohaku');
    const base = express(g).rarity;
    expect(express({ ...g, ginrin: ['G', 'g'], butterfly: ['b', 'b'] }).rarity).toBeGreaterThan(
      base,
    );
  });
});
