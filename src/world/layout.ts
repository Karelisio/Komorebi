import { mulberry32 } from '@/world/random';

/** Dimensions du monde (unités monde ≈ px à zoom 1). */
export const WORLD = { width: 1200, height: 2100, horizon: 520 } as const;

/** Vue par défaut : centre et largeur visible. */
export const DEFAULT_VIEW = { x: 600, y: 930, width: 760 } as const;

export interface Point {
  x: number;
  y: number;
}

export interface PondShape {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  points: Point[];
  bbox: { x: number; y: number; width: number; height: number };
}

/** Bassin organique : ellipse dont le rayon est modulé par quelques harmoniques. */
export function makePondShape(
  id: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
): PondShape {
  const rng = mulberry32(seed);
  const harmonics = [2, 3, 5].map((k) => ({ k, a: 0.04 + rng() * 0.07, p: rng() * Math.PI * 2 }));
  const n = 64;
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = 1;
    for (const h of harmonics) r += h.a * Math.sin(h.k * t + h.p);
    points.push({ x: cx + Math.cos(t) * rx * r, y: cy + Math.sin(t) * ry * r });
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    cx,
    cy,
    rx,
    ry,
    points,
    bbox: { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY },
  };
}

export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/** Distance normalisée au bord (0 = centre, 1 = berge) approximée par l'ellipse. */
export function pondDepthAt(shape: PondShape, p: Point): number {
  const dx = (p.x - shape.cx) / shape.rx;
  const dy = (p.y - shape.cy) / shape.ry;
  return Math.min(1, Math.hypot(dx, dy));
}

export const MAIN_POND = makePondShape('main', 600, 1190, 330, 205, 7);
export const SECOND_POND = makePondShape('second', 320, 1800, 200, 120, 13);
