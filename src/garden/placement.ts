import type { GardenObject } from '@/state/types';
import { pointInPolygon, WORLD, type PondShape } from '@/world/layout';
import { CATALOG, type CatalogId } from './catalog';

/** Zone de sable ratissé (karesansui). */
export const SAND_ZONE = { x: 170, y: 1900, width: 860, height: 400 } as const;

export function inSand(x: number, y: number): boolean {
  return (
    x >= SAND_ZONE.x &&
    x <= SAND_ZONE.x + SAND_ZONE.width &&
    y >= SAND_ZONE.y &&
    y <= SAND_ZONE.y + SAND_ZONE.height
  );
}

export type PlaceResult =
  { ok: true } | { ok: false; reason: 'bounds' | 'water' | 'dry' | 'crowded' | 'sand' };

/** Vérifie qu'un objet peut être posé à cet endroit. */
export function canPlace(
  kind: CatalogId,
  x: number,
  y: number,
  objects: readonly GardenObject[],
  ponds: readonly PondShape[],
  ignoreId?: string,
): PlaceResult {
  const e = CATALOG[kind];
  if (x < 20 || x > WORLD.width - 20 || y < 40 || y > WORLD.height - 20)
    return { ok: false, reason: 'bounds' };
  const onWater = ponds.some((p) => pointInPolygon({ x, y }, p.points));
  if (e.onWater && !onWater) return { ok: false, reason: 'dry' };
  if (!e.onWater && onWater) return { ok: false, reason: 'water' };
  // Seules les pierres vont dans le sable ratissé
  if (inSand(x, y) && e.category !== 'stone') return { ok: false, reason: 'sand' };
  for (const o of objects) {
    if (o.id === ignoreId) continue;
    const other = CATALOG[o.kind];
    const min = (e.radius + other.radius) * 0.55;
    if (Math.hypot((o.x - x) * 1, (o.y - y) * 1.6) < min) return { ok: false, reason: 'crowded' };
  }
  return { ok: true };
}
