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
    const text = encodeSave(newGame(0)).replace('"petals":30', '"petals":99999');
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
    expect(g.stats.fed).toBe(3);
    expect(g.stats.raked).toBe(0);
    expect(g.sand).toEqual({ w: 0, h: 0, data: '' });
  });

  it('refuse une version future', () => {
    expect(() => migrate({ version: SAVE_VERSION + 1, objects: [], kois: [] })).toThrow(SaveError);
  });
});

describe('simulation hors ligne', () => {
  it('le jardin évolue pendant une absence de 3 jours', () => {
    const t0 = Date.UTC(2026, 4, 1, 8);
    const g = newGame(t0);
    const sapling = {
      ...g.objects[0]!,
      id: 'sapling',
      kind: 'maple' as const,
      growth: 0,
      water: 1,
    };
    const state = { ...g, objects: [...g.objects, sapling] };
    const { state: after, summary } = simulateAbsence(state, t0 + 72 * H, LOC, []);
    expect(summary.hours).toBe(72);
    const grown = after.objects.find((o) => o.id === 'sapling')!;
    expect(grown.growth).toBeGreaterThan(0.2);
    expect(after.lastSimAt).toBe(t0 + 72 * H);
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
