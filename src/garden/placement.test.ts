import { describe, expect, it } from 'vitest';
import type { GardenObject } from '@/state/types';
import { MAIN_POND } from '@/world/layout';
import { canPlace } from './placement';

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
    expect(canPlace('bridge', 40, 800, [], [MAIN_POND])).toEqual({ ok: false, reason: 'dry' });
    expect(canPlace('bridge', MAIN_POND.cx, MAIN_POND.cy, [], [MAIN_POND]).ok).toBe(true);
  });

  it('refuse hors du monde et les objets trop serrés', () => {
    expect(canPlace('stone', 300, 5, [], []).ok).toBe(false);
    expect(canPlace('stone', 50, 800, [obj(55, 802)], []).ok).toBe(false);
    expect(canPlace('stone', 50, 800, [obj(150, 900)], []).ok).toBe(true);
  });
});
