import { describe, expect, it } from 'vitest';
import { newGame, SAVE_VERSION } from '@/state/game';
import { crc32 } from './checksum';
import { decodeSave, encodeSave, pickSlot } from './format';
import { migrate, SaveError } from './migrations';
import { simulateAbsence } from './offline';

const H = 3_600_000;
const LOC = { lat: 45.19, lon: 5.72 };

describe('sauvegarde', () => {
  it('aller-retour encode/décode', () => {
    const g = newGame(Date.UTC(2026, 3, 1));
    const { game } = decodeSave(encodeSave(g, 123));
    expect(game).toEqual(g);
  });

  it('détecte une sauvegarde corrompue', () => {
    const text = encodeSave(newGame(0)).replace('"petals":40', '"petals":99999');
    expect(() => decodeSave(text)).toThrow(SaveError);
  });

  it('double emplacement : garde la plus récente valide', () => {
    const a = encodeSave({ ...newGame(0), petals: 1 }, 100);
    const b = encodeSave({ ...newGame(0), petals: 2 }, 200);
    expect(pickSlot([a, b])?.game.petals).toBe(2);
    // Emplacement le plus récent corrompu → repli sur l'autre
    expect(pickSlot([a, b.slice(0, -20)])?.game.petals).toBe(1);
    expect(pickSlot([null, null])).toBeNull();
  });

  it('crc32 connu', () => {
    expect(crc32('123456789')).toBe('cbf43926');
  });
});

describe('migrations', () => {
  it('v0 → courante : `fish` devient `kois` et les champs manquants sont complétés', () => {
    const v0 = { version: 0, createdAt: 5, petals: 12, fish: [], objects: [], stats: { fed: 3 } };
    const g = migrate(v0);
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.kois).toEqual([]);
    expect(g.petals).toBe(12);
    expect(g.stats.collected).toBe(0);
    expect(g.decor.length).toBeGreaterThan(0);
    expect(g.quests.length).toBe(3);
  });

  it('v1 → v2 : koïs gardés avec une croissance, objets du jardin remboursés', () => {
    const now = Date.UTC(2026, 5, 1);
    const koi = { ...newGame(now).kois[0]!, bornAt: now - 6 * 86_400_000, pondId: 'second' };
    delete (koi as { growth?: number }).growth;
    const v1 = {
      version: 1,
      createdAt: now,
      lastSimAt: now,
      petals: 50,
      kois: [koi],
      objects: [{ id: 'a' }, { id: 'b' }],
      seeds: { maple: 2 },
      zones: ['second-pond'],
      sand: { w: 0, h: 0, data: '' },
      objectives: { feed: 1 },
      stats: { fed: 9, raked: 3 },
      discovered: { varieties: ['kohaku'], species: ['maple'], events: [] },
    };
    const g = migrate(v1);
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.petals).toBe(70);
    expect(g.kois).toHaveLength(1);
    expect(g.kois[0]!.pondId).toBe('main');
    expect(g.kois[0]!.growth).toBeCloseTo(0.5, 2);
    expect(g.discovered.varieties).toEqual(['kohaku']);
    expect('objects' in g).toBe(false);
    expect(g.tutorial.done).toBe(false);
  });

  it('refuse une version future', () => {
    expect(() => migrate({ version: SAVE_VERSION + 1, kois: [] })).toThrow(SaveError);
  });
});

describe('simulation hors ligne', () => {
  it('le bassin produit et les koïs grandissent pendant l’absence, avec un plafond', () => {
    const t0 = Date.UTC(2026, 4, 1, 8);
    const g = { ...newGame(t0), pending: 0 };
    const { state: after, summary } = simulateAbsence(g, t0 + 72 * H, LOC, []);
    expect(summary.hours).toBe(72);
    expect(after.lastSimAt).toBe(t0 + 72 * H);
    expect(after.pending).toBeGreaterThan(0);
    // Plafond : pas plus de quelques heures de production accumulées
    const short = simulateAbsence(g, t0 + 4 * H, LOC, []).state.pending;
    expect(after.pending).toBeLessThan(short * 3);
    expect(after.kois[0]!.growth!).toBeGreaterThan(g.kois[0]!.growth!);
    // Les koïs ont faim en revenant
    expect(after.kois[0]!.satiety).toBeLessThan(g.kois[0]!.satiety);
  });

  it('déterministe et idempotent', () => {
    const t0 = Date.UTC(2026, 4, 1, 8);
    const g = newGame(t0);
    const a = simulateAbsence(g, t0 + 50 * H, LOC, []).state;
    const b = simulateAbsence(g, t0 + 50 * H, LOC, []).state;
    expect(a).toEqual(b);
    expect(simulateAbsence(a, t0 + 50 * H, LOC, []).summary.hours).toBe(0);
  });

  it('absence plafonnée à 30 jours', () => {
    const g = newGame(0);
    expect(simulateAbsence(g, 400 * 24 * H, LOC, []).summary.hours).toBe(30 * 24);
  });
});
