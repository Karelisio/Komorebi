import { mulberry32 } from '@/world/random';

/** Dimensions du monde (unités monde ≈ px à zoom 1). */
export const WORLD = { width: 1200, height: 2400, horizon: 520 } as const;

/** Vue par défaut : centre et largeur visible. */
export const DEFAULT_VIEW = { x: 600, y: 840, width: 760 } as const;

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

/** Allée de gravier (10 points) : du premier plan vers le mur, en contournant le bassin. */
export const GARDEN_PATH: Point[] = [
  { x: 140, y: 2380 },
  { x: 90, y: 2120 },
  { x: 150, y: 1870 },
  { x: 95, y: 1620 },
  { x: 150, y: 1380 },
  { x: 120, y: 1150 },
  { x: 235, y: 960 },
  { x: 400, y: 840 },
  { x: 430, y: 700 },
  { x: 560, y: 590 },
];

/** Échantillonne une courbe de Catmull-Rom passant par les points. */
export function smoothPath(pts: readonly Point[], samples: number): Point[] {
  const out: Point[] = [];
  const n = pts.length - 1;
  for (let i = 0; i < samples; i++) {
    const u = (i / (samples - 1)) * n;
    const k = Math.min(n - 1, Math.floor(u));
    const t = u - k;
    const p0 = pts[Math.max(0, k - 1)]!;
    const p1 = pts[k]!;
    const p2 = pts[k + 1]!;
    const p3 = pts[Math.min(n, k + 2)]!;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t * t +
        (-a + 3 * b - 3 * c + d) * t * t * t);
    out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
  }
  return out;
}

export const PATH_SAMPLES = 24;

export const MAIN_POND = makePondShape('main', 600, 1190, 330, 205, 7);
export const SECOND_POND = makePondShape('second', 360, 1690, 215, 118, 13);
