import { describe, expect, it } from 'vitest';
import type { GardenObject } from '@/state/types';
import { MAIN_POND } from '@/world/layout';
import { canPlace, SAND_ZONE } from './placement';

const obj = (x: number, y: number): GardenObject => ({
  id: 'a',
  kind: 'stone',
  x,
  y,
  seed: 1,
  placedAt: 0,
  water: 1,
  lastWateredAt: 0,
  prune: 0,
  pruneCount: 0,
  growth: 1,
  flip: false,
  harvestAt: 0,
});

describe('placement', () => {
  it('pas de plante dans l’eau, pas de pont sur la terre', () => {
    expect(canPlace('maple', MAIN_POND.cx, MAIN_POND.cy, [], [MAIN_POND])).toEqual({
      ok: false,
      reason: 'water',
    });
    expect(canPlace('bridge', 600, 800, [], [MAIN_POND])).toEqual({ ok: false, reason: 'dry' });
    expect(canPlace('bridge', MAIN_POND.cx, MAIN_POND.cy, [], [MAIN_POND]).ok).toBe(true);
  });

  it('refuse le ciel et les objets trop serrés', () => {
    expect(canPlace('stone', 600, 100, [], []).ok).toBe(false);
    expect(canPlace('stone', 600, 800, [obj(605, 802)], []).ok).toBe(false);
    expect(canPlace('stone', 600, 800, [obj(700, 900)], []).ok).toBe(true);
  });

  it('seules les pierres vont dans le sable', () => {
    const x = SAND_ZONE.x + 100;
    const y = SAND_ZONE.y + 100;
    expect(canPlace('stone', x, y, [], []).ok).toBe(true);
    expect(canPlace('azalea', x, y, [], [])).toEqual({ ok: false, reason: 'sand' });
  });
});
