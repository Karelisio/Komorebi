import { mulberry32 } from '@/world/random';

/**
 * Dimensions du monde (unités monde ≈ px à zoom 1) : vue rapprochée du bassin,
 * vu de trois quarts ; la berge l'entoure. Pas d'horizon visible.
 */
export const WORLD = { width: 680, height: 1500, horizon: -600 } as const;

/** Vue par défaut : centre et largeur visible (tout le monde tient dans l'écran). */
export const DEFAULT_VIEW = { x: 340, y: 750, width: 680 } as const;

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

export const MAIN_POND = makePondShape('main', 340, 745, 225, 450, 3);
/** Ancien second bassin (hors champ), conservé pour les anciennes sauvegardes. */
export const SECOND_POND = makePondShape('second', 340, 2600, 120, 80, 13);

/** Emplacements de décor sur la berge (pied des objets). */
export const BANK_SLOTS: readonly Point[] = [
  { x: 92, y: 300 },
  { x: 596, y: 320 },
  { x: 58, y: 520 },
  { x: 622, y: 560 },
  { x: 50, y: 760 },
  { x: 628, y: 790 },
  { x: 60, y: 1000 },
  { x: 618, y: 1010 },
  { x: 104, y: 1215 },
  { x: 580, y: 1200 },
];
