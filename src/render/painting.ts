import { Texture } from 'pixi.js';
import type { PondShape } from '@/world/layout';
import { mulberry32 } from '@/world/random';
import type { SeasonState } from '@/world/season';

/**
 * Peinture procédurale « aquarelle » (Canvas 2D) : lavis superposés, bords humides plus
 * foncés, granulation. Sert à peindre la berge et le fond du bassin une fois par saison.
 */

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  return [c, ctx];
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Contour irrégulier (tache) autour de (x, y). */
function blobPath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rng: Rng, n = 14): void {
  const phase = rng() * Math.PI * 2;
  const k1 = 0.08 + rng() * 0.12;
  const k2 = 0.05 + rng() * 0.08;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 1 + k1 * Math.sin(2 * t + phase) + k2 * Math.sin(3 * t - phase * 1.7) + (rng() - 0.5) * 0.12;
    pts.push([x + Math.cos(t) * rx * r, y + Math.sin(t) * ry * r]);
  }
  ctx.beginPath();
  // Courbe lissée passant par les milieux
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const first = mid(pts[n - 1]!, pts[0]!);
  ctx.moveTo(first[0], first[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % n]!);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/** Tache d'aquarelle : lavis translucide et bord humide légèrement plus foncé. */
export function wash(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
  rng: Rng,
  edge = 0.35,
): void {
  blobPath(ctx, x, y, rx, ry, rng);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  if (edge > 0) {
    ctx.lineWidth = Math.max(1, Math.min(rx, ry) * 0.06);
    ctx.strokeStyle = rgba(color, alpha * edge);
    ctx.stroke();
  }
}

/** Granulation du pigment : fines taches aléatoires. */
function granulate(ctx: Ctx, w: number, h: number, rng: Rng, count: number, color: string): void {
  for (let i = 0; i < count; i++) {
    const r = 0.6 + rng() * 1.6;
    ctx.fillStyle = rgba(color, 0.05 + rng() * 0.1);
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Trait de pinceau effilé (brin d'herbe, fronde, tige). */
function stroke(
  ctx: Ctx,
  x: number,
  y: number,
  ang: number,
  len: number,
  width: number,
  bend: number,
  color: string,
  alpha: number,
): void {
  const ex = x + Math.cos(ang) * len;
  const ey = y + Math.sin(ang) * len;
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const cx = (x + ex) / 2 + nx * bend;
  const cy = (y + ey) / 2 + ny * bend;
  ctx.beginPath();
  ctx.moveTo(x + nx * width, y + ny * width);
  ctx.quadraticCurveTo(cx + nx * width * 0.6, cy + ny * width * 0.6, ex, ey);
  ctx.quadraticCurveTo(cx - nx * width * 0.6, cy - ny * width * 0.6, x - nx * width, y - ny * width);
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
}

function pondPath(ctx: Ctx, shape: PondShape, s: number, grow = 0): void {
  const pts = shape.points;
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n]!;
    const dx = p.x - shape.cx;
    const dy = p.y - shape.cy;
    const d = Math.hypot(dx, dy) || 1;
    const x = (p.x + (dx / d) * grow) * s;
    const y = (p.y + (dy / d) * grow) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

interface Palette {
  grass: string[];
  dry: string;
  flowers: string[];
  leaves: string[];
  moss: string;
}

function palette(season: SeasonState): Palette {
  const autumn = season.season === 'autumn' || season.autumn > 0.4;
  if (season.season === 'winter')
    return {
      grass: ['#6f7a55', '#5d6a4a', '#7c8060', '#556248'],
      dry: '#a3946c',
      flowers: [],
      leaves: ['#8a6a4a'],
      moss: '#5a6e46',
    };
  if (autumn)
    return {
      grass: ['#7b8a4c', '#66783f', '#8d8f52', '#5b6d3c'],
      dry: '#b89a5a',
      flowers: ['#e9d9a8'],
      leaves: ['#d9622b', '#e8943a', '#c4432a', '#f0b347'],
      moss: '#61783f',
    };
  if (season.season === 'summer')
    return {
      grass: ['#5f8a45', '#4e7a3c', '#74994f', '#44693a'],
      dry: '#9aa05a',
      flowers: ['#f4f1e4', '#f6d65c', '#9fb5ea', '#f0a4c0'],
      leaves: [],
      moss: '#4f7a3a',
    };
  return {
    grass: ['#6f9a4c', '#5a8742', '#86a95a', '#4c773e'],
    dry: '#a7ad66',
    flowers: ['#fbf5f0', '#f7c6d6', '#f3a8c2', '#fff2a8', '#c8d4fb'],
    leaves: [],
    moss: '#5b8a41',
  };
}

export interface BankPaintOptions {
  width: number;
  height: number;
  shape: PondShape;
  season: SeasonState;
  snow: number;
  /** Échelle de la texture (qualité). */
  scale: number;
}

/**
 * Berge peinte : herbe et mousse en lavis, terre humide autour de l'eau, grosses pierres
 * plates qui débordent sur le bassin, fougères, joncs et fleurs. Le bassin est laissé transparent.
 */
export function paintBank(o: BankPaintOptions): Texture {
  const s = o.scale;
  const W = o.width * s;
  const H = o.height * s;
  const [c, ctx] = canvas(W, H);
  const rng = mulberry32(4242);
  const pal = palette(o.season);
  const { shape } = o;

  // 1. Fond : lavis superposés de verts et d'ocres
  ctx.fillStyle = pal.grass[1]!;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const col = rng() < 0.18 ? pal.dry : pal.grass[Math.floor(rng() * pal.grass.length)]!;
    const r = (50 + rng() * 150) * s;
    wash(ctx, rng() * W, rng() * H, r, r * (0.55 + rng() * 0.4), col, 0.16 + rng() * 0.18, rng);
  }
  granulate(ctx, W, H, rng, Math.round(W * H * 0.004), '#1f2a18');

  // 2. Zones d'ombre (sous les arbres hors champ) et de lumière, en grands lavis
  for (let i = 0; i < 9; i++) {
    const r = (160 + rng() * 200) * s;
    wash(ctx, rng() * W, rng() * H, r, r * 0.7, '#2d4a2a', 0.18, rng, 0.2);
  }
  for (let i = 0; i < 7; i++) {
    const r = (120 + rng() * 160) * s;
    wash(ctx, rng() * W, rng() * H, r, r * 0.6, '#c9d58a', 0.14, rng, 0.2);
  }

  // 3. Touffes d'herbe : bouquets de brins effilés, sombres au pied, clairs en pointe
  const tuft = (x: number, y: number, size: number) => {
    const blades = 5 + Math.floor(rng() * 6);
    const base = pal.grass[Math.floor(rng() * pal.grass.length)]!;
    wash(ctx, x, y + size * 0.1, size * 0.55, size * 0.22, '#1f3319', 0.25, rng, 0);
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.3;
      const len = size * (0.6 + rng() * 0.6);
      stroke(ctx, x + (rng() - 0.5) * size * 0.4, y, a, len, size * 0.07, (rng() - 0.5) * size * 0.4, base, 0.75);
      if (rng() < 0.5)
        stroke(ctx, x + (rng() - 0.5) * size * 0.3, y, a, len * 0.7, size * 0.05, 0, '#b9cf7a', 0.45);
    }
  };
  for (let i = 0; i < 520 * s * s; i++) tuft(rng() * W, rng() * H, (12 + rng() * 16) * s);

  // Trèfles et petites feuilles rondes en tapis
  for (let i = 0; i < 70; i++) {
    const cx = rng() * W;
    const cy = rng() * H;
    for (let k = 0; k < 14; k++) {
      const x = cx + (rng() - 0.5) * 60 * s;
      const y = cy + (rng() - 0.5) * 36 * s;
      for (let l = 0; l < 3; l++) {
        const a = (l / 3) * Math.PI * 2 + rng();
        wash(ctx, x + Math.cos(a) * 3 * s, y + Math.sin(a) * 3 * s, 3.2 * s, 2.6 * s, rng() < 0.5 ? '#4f8a3c' : '#6fa24d', 0.7, rng, 0.5);
      }
    }
  }

  // 3. Terre humide et ombre portée de la berge autour de l'eau
  ctx.save();
  ctx.filter = `blur(${Math.round(14 * s)}px)`;
  pondPath(ctx, shape, s, 26);
  ctx.lineWidth = 60 * s;
  ctx.strokeStyle = rgba('#26361f', 0.75);
  ctx.stroke();
  ctx.filter = `blur(${Math.round(5 * s)}px)`;
  pondPath(ctx, shape, s, 10);
  ctx.lineWidth = 22 * s;
  ctx.strokeStyle = rgba('#6e6546', 0.45);
  ctx.stroke();
  ctx.restore();

  // 4. Mousse en coussins le long du bord
  const pts = shape.points;
  const n = pts.length;
  const outward = (i: number, d: number): [number, number, number] => {
    const p = pts[i % n]!;
    const q = pts[(i + 1) % n]!;
    const tx = q.x - p.x;
    const ty = q.y - p.y;
    const l = Math.hypot(tx, ty) || 1;
    // Normale extérieure (points parcourus dans le sens horaire à l'écran)
    const nx = ty / l;
    const ny = -tx / l;
    const cx = p.x - shape.cx;
    const cy = p.y - shape.cy;
    const sgn = nx * cx + ny * cy >= 0 ? 1 : -1;
    return [(p.x + nx * sgn * d) * s, (p.y + ny * sgn * d) * s, Math.atan2(ny * sgn, nx * sgn)];
  };
  for (let i = 0; i < n * 3; i++) {
    const [x, y] = outward(Math.floor(rng() * n), 14 + rng() * 30);
    const r = (8 + rng() * 16) * s;
    wash(ctx, x, y, r, r * 0.7, rng() < 0.5 ? pal.moss : '#3f6232', 0.45 + rng() * 0.2, rng, 0.5);
  }

  // 5. Découpe du bassin (bord légèrement adouci)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.filter = `blur(${Math.max(1, Math.round(2 * s))}px)`;
  pondPath(ctx, shape, s, -2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  // 6. Pierres plates de la margelle, certaines débordant sur l'eau
  const stones: { x: number; y: number; r: number; tone: number }[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += 0.55 + rng() * 0.7;
    if (acc < 1.3) continue;
    acc = 0;
    const big = rng() < 0.3;
    const r = (big ? 26 + rng() * 22 : 13 + rng() * 11) * s;
    const [x, y] = outward(i, (big ? 4 : 8) + (rng() - 0.3) * 10);
    stones.push({ x, y, r, tone: rng() });
  }
  stones.sort((a, b) => a.y - b.y);
  const greys = ['#9a958a', '#8b877d', '#aaa497', '#7f7d77', '#a19886'];
  for (const st of stones) {
    const ry = st.r * (0.62 + rng() * 0.18);
    // Ombre douce
    ctx.save();
    ctx.filter = `blur(${Math.round(st.r * 0.25)}px)`;
    wash(ctx, st.x + st.r * 0.15, st.y + ry * 0.45, st.r * 1.05, ry * 0.9, '#152015', 0.45, rng, 0);
    ctx.restore();
    const g = greys[Math.floor(st.tone * greys.length)]!;
    wash(ctx, st.x, st.y, st.r, ry, g, 0.95, rng, 0.7);
    // Face éclairée (lumière venant du haut-gauche) et arête sombre en bas
    wash(ctx, st.x - st.r * 0.18, st.y - ry * 0.2, st.r * 0.7, ry * 0.55, '#d8d2c2', 0.35, rng, 0);
    wash(ctx, st.x + st.r * 0.1, st.y + ry * 0.35, st.r * 0.75, ry * 0.35, '#4d4a44', 0.25, rng, 0);
    if (rng() < 0.45)
      wash(ctx, st.x + (rng() - 0.5) * st.r, st.y - ry * 0.3, st.r * 0.4, ry * 0.3, pal.moss, 0.7, rng, 0.4);
  }

  // 7. Fougères et joncs en bouquets sur la berge
  for (let k = 0; k < 16; k++) {
    const [x, y] = outward(Math.floor(rng() * n), 30 + rng() * 40);
    const fern = rng() < 0.55;
    const blades = fern ? 7 : 9;
    for (let b = 0; b < blades; b++) {
      const a = fern ? (b / blades) * Math.PI * 2 + rng() * 0.3 : -Math.PI / 2 + (rng() - 0.5) * 1.1;
      const len = (fern ? 18 + rng() * 12 : 20 + rng() * 22) * s;
      stroke(ctx, x, y, a, len, (fern ? 3.2 : 1.6) * s, (rng() - 0.5) * 8 * s, rng() < 0.5 ? '#3f6d33' : '#5c8a3e', 0.8);
      if (fern)
        for (let l = 1; l < 5; l++) {
          const t = l / 5;
          const lx = x + Math.cos(a) * len * t;
          const ly = y + Math.sin(a) * len * t;
          stroke(ctx, lx, ly, a + 0.9, len * 0.22 * (1 - t * 0.5), 1.4 * s, 0, '#6d9a48', 0.7);
          stroke(ctx, lx, ly, a - 0.9, len * 0.22 * (1 - t * 0.5), 1.4 * s, 0, '#6d9a48', 0.7);
        }
    }
  }

  // 8. Fleurs, feuilles tombées, neige selon la saison
  // Fleurs par petits groupes d'une même couleur
  for (let g = 0; g < 22 && pal.flowers.length; g++) {
    const gx = rng() * W;
    const gy = rng() * H;
    const col = pal.flowers[Math.floor(rng() * pal.flowers.length)]!;
    const count = 3 + Math.floor(rng() * 6);
    for (let i = 0; i < count; i++) {
      const x = gx + (rng() - 0.5) * 50 * s;
      const y = gy + (rng() - 0.5) * 30 * s;
      stroke(ctx, x, y + 6 * s, -Math.PI / 2, 7 * s, 0.8 * s, 0, '#3e6a31', 0.8);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        wash(ctx, x + Math.cos(a) * 2.6 * s, y + Math.sin(a) * 2.2 * s, 2.4 * s, 2 * s, col, 0.9, rng, 0.3);
      }
      wash(ctx, x, y, 1.2 * s, 1.2 * s, '#e8b830', 0.95, rng, 0);
    }
  }
  for (let i = 0; i < 380 && pal.leaves.length; i++) {
    const col = pal.leaves[Math.floor(rng() * pal.leaves.length)]!;
    wash(ctx, rng() * W, rng() * H, (3 + rng() * 3) * s, (2 + rng() * 2) * s, col, 0.8, rng, 0.5);
  }
  if (o.snow > 0.05) {
    for (let i = 0; i < 220 * o.snow; i++) {
      const r = (30 + rng() * 90) * s;
      wash(ctx, rng() * W, rng() * H, r, r * 0.6, '#f4f6fb', 0.35 + o.snow * 0.45, rng, 0.2);
    }
  }
  // Re-découpe du bassin sous la neige et les fleurs, sans toucher aux pierres débordantes
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  pondPath(ctx, shape, s, -26);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  const tex = Texture.from(c);
  tex.source.style.scaleMode = 'linear';
  return tex;
}

/** Fond du bassin peint : sable et galets près des bords, vase sombre au centre. */
export function paintBed(shape: PondShape, texW = 512): Texture {
  const { bbox } = shape;
  const W = texW;
  const H = Math.round((texW * bbox.height) / bbox.width);
  const [c, ctx] = canvas(W, H);
  const rng = mulberry32(99);
  const sx = W / bbox.width;
  const sy = H / bbox.height;
  ctx.fillStyle = '#56603f';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const r = 30 + rng() * 90;
    wash(ctx, rng() * W, rng() * H, r, r * 0.7, rng() < 0.5 ? '#6f7550' : '#454f36', 0.25, rng);
  }
  // Galets le long du bord
  const pts = shape.points;
  for (let i = 0; i < 900; i++) {
    const p = pts[Math.floor(rng() * pts.length)]!;
    const t = Math.pow(rng(), 1.8) * 0.45;
    const x = (p.x + (shape.cx - p.x) * t - bbox.x) * sx;
    const y = (p.y + (shape.cy - p.y) * t - bbox.y) * sy;
    const r = 2 + rng() * rng() * 9;
    const tone = ['#a39c86', '#8e8a78', '#bcb39a', '#6f6d62', '#9b8a6a'][Math.floor(rng() * 5)]!;
    wash(ctx, x, y, r, r * (0.6 + rng() * 0.3), tone, 0.5 + rng() * 0.4, rng, 0.6);
  }
  // Quelques grosses pierres immergées
  for (let i = 0; i < 7; i++) {
    const r = 14 + rng() * 22;
    wash(ctx, rng() * W, rng() * H, r, r * 0.7, '#6d6a5e', 0.55, rng, 0.6);
  }
  granulate(ctx, W, H, rng, W * H * 0.01, '#20261a');
  const tex = Texture.from(c);
  tex.source.style.addressMode = 'clamp-to-edge';
  return tex;
}
