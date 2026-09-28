import type { Graphics } from 'pixi.js';
import { hexToRgb, mixRgb, rgbToHex, type RGB } from '@/world/math';
import { mulberry32, type Rng } from '@/world/random';
import type { SeasonState } from '@/world/season';

export type TreeSpecies = 'maple' | 'cherry' | 'pine' | 'bamboo';

export interface TreeLook {
  species: TreeSpecies;
  seed: number;
  /** Croissance 0 (pousse) → 1 (adulte). */
  growth: number;
  /** Taille/bonsaï 0 (libre) → 1 (très taillé, en plateaux). */
  prune: number;
  season: SeasonState;
  snow: number;
  /** Soif 0..1 : feuillage un peu terne. */
  thirst: number;
  /** Hauteur adulte en unités monde. */
  height: number;
}

interface Palette {
  dark: RGB;
  mid: RGB;
  light: RGB;
}

const C = (h: string): RGB => hexToRgb(h);
const mixP = (a: Palette, b: Palette, t: number): Palette => ({
  dark: mixRgb(a.dark, b.dark, t),
  mid: mixRgb(a.mid, b.mid, t),
  light: mixRgb(a.light, b.light, t),
});

const MAPLE_SPRING: Palette = { dark: C('#4f7a38'), mid: C('#7aa54e'), light: C('#a8cc72') };
const MAPLE_SUMMER: Palette = { dark: C('#2f5a2c'), mid: C('#4f7f3a'), light: C('#7fa95a') };
const MAPLE_AUTUMN: Palette = { dark: C('#8e2a22'), mid: C('#d44a2c'), light: C('#f28a45') };
const CHERRY_BLOOM: Palette = { dark: C('#d4829e'), mid: C('#f5aec4'), light: C('#ffd6e3') };
const CHERRY_AUTUMN: Palette = { dark: C('#9a5a2c'), mid: C('#d08a3c'), light: C('#eec06a') };
const PINE: Palette = { dark: C('#23402f'), mid: C('#35593f'), light: C('#62875c') };
const BAMBOO: Palette = { dark: C('#4c7a3a'), mid: C('#6f9c4c'), light: C('#a3c874') };
const BARK = C('#4a3b33');
const BARK_LIGHT = C('#6d5a4c');
const SNOW = C('#f2f5fb');

function dull(p: Palette, thirst: number): Palette {
  const grey = C('#8a8468');
  const t = thirst * 0.35;
  return {
    dark: mixRgb(p.dark, grey, t),
    mid: mixRgb(p.mid, grey, t),
    light: mixRgb(p.light, grey, t),
  };
}

function foliagePalette(look: TreeLook): { palette: Palette; amount: number } {
  const s = look.season;
  switch (look.species) {
    case 'maple': {
      const base = mixP(MAPLE_SPRING, MAPLE_SUMMER, s.season === 'spring' ? 0.2 : 0.85);
      return { palette: mixP(base, MAPLE_AUTUMN, s.autumn), amount: s.foliage };
    }
    case 'cherry': {
      const leaves = mixP(MAPLE_SUMMER, CHERRY_AUTUMN, s.autumn);
      const bloom = Math.min(1, s.sakura * 1.3);
      return { palette: mixP(leaves, CHERRY_BLOOM, bloom), amount: Math.max(s.foliage, s.sakura) };
    }
    case 'pine':
      return {
        palette: s.season === 'winter' ? mixP(PINE, { ...PINE, light: C('#55735a') }, 0.6) : PINE,
        amount: 1,
      };
    case 'bamboo':
      return { palette: mixP(BAMBOO, CHERRY_AUTUMN, s.season === 'winter' ? 0.15 : 0), amount: 1 };
  }
}

interface Tip {
  x: number;
  y: number;
  r: number;
}

function taper(
  g: Graphics,
  x1: number,
  y1: number,
  w1: number,
  x2: number,
  y2: number,
  w2: number,
  color: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  g.poly([
    x1 + nx * w1,
    y1 + ny * w1,
    x2 + nx * w2,
    y2 + ny * w2,
    x2 - nx * w2,
    y2 - ny * w2,
    x1 - nx * w1,
    y1 - ny * w1,
  ]).fill(color);
  g.circle(x2, y2, w2).fill(color);
  // Modelé de l'écorce : bande éclairée côté gauche (lumière haut-gauche)
  if (w1 > 2.2) {
    const side = nx < 0 ? 1 : -1;
    const lx = nx * side;
    const ly = ny * side;
    const light = rgbToHex(
      mixRgb(
        [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255],
        [1, 0.95, 0.85],
        0.22,
      ),
    );
    g.poly([
      x1 - lx * w1 * 0.85,
      y1 - ly * w1 * 0.85,
      x2 - lx * w2 * 0.85,
      y2 - ly * w2 * 0.85,
      x2 - lx * w2 * 0.2,
      y2 - ly * w2 * 0.2,
      x1 - lx * w1 * 0.2,
      y1 - ly * w1 * 0.2,
    ]).fill({ color: light, alpha: 0.8 });
  }
}

export type ClumpKind = 'leaf' | 'maple' | 'blossom' | 'needle';

/** Amas de feuillage à poser en sprite (texture peinte, teintée). */
export interface Clump {
  x: number;
  y: number;
  r: number;
  /** Aplatissement vertical (1 = rond). */
  ry: number;
  tint: number;
  kind: ClumpKind;
  alpha: number;
}

export interface TreeResult {
  clumps: Clump[];
}

function crownClumps(
  out: Clump[],
  tips: Tip[],
  p: Palette,
  rng: Rng,
  flat: number,
  snow: number,
  kind: ClumpKind,
): void {
  if (!tips.length) return;
  const ry = 1 - flat * 0.4;
  const ys = tips.map((t) => t.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const range = Math.max(1, bottom - top);
  // Quelques trouées : le ciel et les branches se devinent à travers la couronne
  const sorted = [...tips].filter(() => rng() > 0.12).sort((a, b) => a.y - b.y);
  // Masse d'ombre (arrière)
  for (const t of sorted)
    out.push({
      x: t.x + t.r * 0.15,
      y: t.y + t.r * 0.22,
      r: t.r * 1.1,
      ry,
      tint: rgbToHex(p.dark),
      kind: kind === 'blossom' ? 'leaf' : kind,
      alpha: 0.9,
    });
  // Masse principale : plus claire en haut de la couronne
  for (const t of sorted) {
    const k = 1 - (t.y - top) / range;
    const c = mixRgb(p.mid, p.light, 0.15 + k * 0.6 + (rng() - 0.5) * 0.25);
    out.push({ x: t.x, y: t.y, r: t.r * 0.95, ry, tint: rgbToHex(c), kind, alpha: 1 });
  }
  // Touches de lumière, côté soleil (haut-gauche)
  for (const t of sorted) {
    if (rng() < 0.35) continue;
    out.push({
      x: t.x - t.r * 0.3,
      y: t.y - t.r * 0.35 * ry,
      r: t.r * 0.55,
      ry,
      tint: rgbToHex(p.light),
      kind,
      alpha: 0.9,
    });
  }
  if (snow > 0.05) {
    for (const t of sorted)
      out.push({
        x: t.x - t.r * 0.05,
        y: t.y - t.r * 0.55 * ry,
        r: t.r * 0.75,
        ry: ry * 0.4,
        tint: rgbToHex(SNOW),
        kind: 'leaf',
        alpha: snow,
      });
  }
}

function drawBroadleaf(g: Graphics, look: TreeLook, rng: Rng, out: Clump[]): void {
  const size = look.height * (0.22 + 0.78 * look.growth);
  const depth = Math.max(1, Math.round(2 + look.growth * 3.5 - look.prune * 0.8));
  const { palette, amount } = foliagePalette(look);
  const bark = rgbToHex(mixRgb(BARK, BARK_LIGHT, look.species === 'cherry' ? 0.5 : 0.1));
  const tips: Tip[] = [];
  // Couronne large et aérée (érable du Japon), plus ronde pour le cerisier
  const spread = (look.species === 'maple' ? 0.5 : 0.44) + look.prune * 0.15;

  const branch = (x: number, y: number, angle: number, len: number, w: number, d: number): void => {
    const bend = (rng() - 0.5) * 0.25;
    const x2 = x + Math.sin(angle + bend) * len;
    const y2 = y - Math.cos(angle + bend) * len;
    taper(g, x, y, w, x2, y2, w * 0.66, bark);
    if (d <= 0) {
      const r = size * (0.08 + rng() * 0.04) * (1 + look.prune * 0.5);
      tips.push({ x: x2, y: y2, r });
      // Un second amas au milieu du rameau : aucune branche nue ne dépasse
      tips.push({ x: (x + x2) / 2, y: (y + y2) / 2, r: r * 0.85 });
      return;
    }
    const n = 2 + (rng() < 0.4 - look.prune * 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      // Les branches s'étalent : l'angle s'ouvre vers l'horizontale en montant
      const a = angle * 0.7 + t * spread * 2 + (rng() - 0.5) * 0.3;
      branch(x2, y2, a, len * (0.66 + rng() * 0.14), w * 0.66, d - 1);
    }
    if (d <= 2 && rng() < 0.45) tips.push({ x: x2, y: y2, r: size * 0.065 * (0.8 + rng() * 0.4) });
  };

  const trunkLen = size * (0.34 - look.prune * 0.08);
  const lean = (rng() - 0.5) * 0.25;
  branch(0, 0, lean, trunkLen, size * 0.05, depth);
  // Racines apparentes
  g.ellipse(0, 0, size * 0.08, size * 0.02).fill(bark);

  if (amount > 0.02 && tips.length) {
    // Couronne : ellipsoïde posé sur la ramure, rempli d'amas (en étages pour l'érable)
    const xs = tips.map((t) => t.x);
    const ys = tips.map((t) => t.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const rx = Math.max((maxX - minX) / 2 + size * 0.08, size * 0.26);
    const ry = Math.max(
      (maxY - minY) / 2 + size * 0.1,
      rx * (look.species === 'maple' ? 0.62 : 0.72),
    );
    const cy = Math.min((minY + maxY) / 2, maxY - ry * 0.35);
    const maple = look.species === 'maple';
    const count = Math.round((12 + 24 * look.growth) * (0.35 + 0.65 * amount));
    const crown: Tip[] = [];
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const rr = 0.3 + 0.7 * Math.sqrt(rng());
      let x = cx + Math.cos(a) * rx * rr * 0.88;
      let y = cy + Math.sin(a) * ry * rr * 0.82;
      if (maple) {
        // Trois étages horizontaux séparés par de fines trouées
        const tier = Math.max(0, Math.min(2, Math.floor(((y - (cy - ry)) / (2 * ry)) * 3)));
        y = cy - ry + (tier + 0.5) * ((2 * ry) / 3) + (rng() - 0.5) * ry * 0.22;
        x = cx + (x - cx) * (1 - tier * 0.12 + 0.12);
      }
      crown.push({
        x,
        y,
        r: Math.min(rx, ry) * (0.3 + rng() * 0.16) * (0.6 + 0.4 * amount) * (1 + look.prune * 0.3),
      });
    }
    const blossom = look.species === 'cherry' && look.season.sakura > 0.35;
    crownClumps(
      out,
      crown,
      dull(palette, look.thirst),
      rng,
      maple ? Math.max(look.prune, 0.45) : look.prune,
      look.snow,
      blossom ? 'blossom' : maple ? 'maple' : 'leaf',
    );
  } else if (look.snow > 0.05) {
    for (const t of tips)
      g.ellipse(t.x, t.y - 2, size * 0.03, size * 0.01).fill({
        color: rgbToHex(SNOW),
        alpha: look.snow,
      });
  }
}

function drawPine(g: Graphics, look: TreeLook, rng: Rng, out: Clump[]): void {
  const size = look.height * (0.25 + 0.75 * look.growth);
  const bark = rgbToHex(BARK);
  const palette = dull(foliagePalette(look).palette, look.thirst);
  const segs = 6;
  let x = 0;
  let y = 0;
  let w = size * 0.05;
  const pads: Tip[] = [];
  const nodes: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < segs; i++) {
    const nx = x + (rng() - 0.5) * size * 0.12 + Math.sin(i * 1.3 + look.seed) * size * 0.03;
    const ny = y - (size * 0.8) / segs;
    taper(g, x, y, w, nx, ny, w * 0.85, bark);
    nodes.push({ x: nx, y: ny, w });
    x = nx;
    y = ny;
    w *= 0.85;
  }
  const levels = Math.max(2, Math.round(2 + look.growth * 3));
  for (let l = 0; l < levels; l++) {
    const node =
      nodes[Math.min(nodes.length - 1, Math.floor(((l + 1) / levels) * (nodes.length - 1)))]!;
    const side = l % 2 === 0 ? -1 : 1;
    const reach = size * (0.32 - l * 0.04) * (1 - look.prune * 0.2);
    const ex = node.x + side * reach;
    const ey = node.y - size * 0.03;
    taper(g, node.x, node.y, node.w * 0.6, ex, ey, node.w * 0.25, bark);
    pads.push({ x: ex, y: ey - size * 0.02, r: size * (0.14 - l * 0.012) });
    if (rng() < 0.6)
      pads.push({ x: node.x - side * reach * 0.4, y: node.y - size * 0.05, r: size * 0.09 });
  }
  pads.push({ x, y: y - size * 0.03, r: size * 0.12 });
  // Plateaux « nuages » typiques des pins taillés (niwaki)
  const sorted = [...pads].sort((a, b) => a.y - b.y);
  for (const p of sorted)
    out.push({
      x: p.x + p.r * 0.08,
      y: p.y + p.r * 0.14,
      r: p.r * 1.3,
      ry: 0.5,
      tint: rgbToHex(palette.dark),
      kind: 'needle',
      alpha: 1,
    });
  for (const p of sorted)
    out.push({
      x: p.x,
      y: p.y,
      r: p.r * 1.15,
      ry: 0.45,
      tint: rgbToHex(mixRgb(palette.mid, palette.light, 0.35)),
      kind: 'needle',
      alpha: 1,
    });
  for (const p of sorted)
    out.push({
      x: p.x - p.r * 0.2,
      y: p.y - p.r * 0.16,
      r: p.r * 0.65,
      ry: 0.4,
      tint: rgbToHex(palette.light),
      kind: 'needle',
      alpha: 0.85,
    });
  if (look.snow > 0.05) {
    for (const p of sorted)
      out.push({
        x: p.x - p.r * 0.05,
        y: p.y - p.r * 0.25,
        r: p.r * 1.0,
        ry: 0.2,
        tint: rgbToHex(SNOW),
        kind: 'leaf',
        alpha: look.snow,
      });
  }
}

function drawBamboo(g: Graphics, look: TreeLook, rng: Rng): void {
  const size = look.height * (0.2 + 0.8 * look.growth);
  const culms = Math.max(1, Math.round(1 + look.growth * 6));
  const palette = dull(foliagePalette(look).palette, look.thirst);
  const stem = rgbToHex(mixRgb(palette.mid, C('#c8c27a'), 0.25));
  const node = rgbToHex(palette.dark);
  const leaves: { x: number; y: number; a: number; l: number }[] = [];
  for (let c = 0; c < culms; c++) {
    const bx = (rng() - 0.5) * size * 0.22;
    const h = size * (0.75 + rng() * 0.3);
    const curve = (rng() - 0.5) * size * 0.12;
    const w = size * 0.014;
    const segs = 8;
    let px = bx;
    let py = 0;
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const nx = bx + curve * t * t;
      const ny = -h * t;
      taper(g, px, py, w, nx, ny, w * 0.95, stem);
      g.rect(nx - w * 1.1, ny - 1, w * 2.2, 2).fill(node);
      if (t > 0.45) {
        for (let k = 0; k < 3; k++)
          leaves.push({ x: nx, y: ny, a: (rng() - 0.5) * 2.6, l: size * (0.07 + rng() * 0.05) });
      }
      px = nx;
      py = ny;
    }
  }
  const colors = [palette.dark, palette.mid, palette.light].map(rgbToHex);
  for (const lf of leaves) {
    const ex = lf.x + Math.sin(lf.a) * lf.l;
    const ey = lf.y + Math.cos(lf.a) * lf.l * 0.4;
    const nx = -(ey - lf.y);
    const ny = ex - lf.x;
    const n = Math.hypot(nx, ny) || 1;
    const wv = lf.l * 0.1;
    g.poly([
      lf.x,
      lf.y,
      (lf.x + ex) / 2 + (nx / n) * wv,
      (lf.y + ey) / 2 + (ny / n) * wv,
      ex,
      ey,
      (lf.x + ex) / 2 - (nx / n) * wv,
      (lf.y + ey) / 2 - (ny / n) * wv,
    ]).fill(colors[Math.floor(rng() * 3)]!);
  }
  if (look.snow > 0.05) {
    for (const lf of leaves.filter((_, i) => i % 3 === 0))
      g.ellipse(lf.x, lf.y - 2, lf.l * 0.3, lf.l * 0.08).fill({
        color: rgbToHex(SNOW),
        alpha: look.snow,
      });
  }
}

/** Dessine le bois d'un arbre (base en (0, 0), vers le haut) et renvoie ses amas de feuillage. */
export function drawTree(g: Graphics, look: TreeLook): TreeResult {
  const clumps: Clump[] = [];
  g.clear();
  const rng = mulberry32(look.seed);
  // Ombre portée au sol
  g.ellipse(0, 0, look.height * (0.12 + look.growth * 0.2), look.height * 0.04).fill({
    color: 0x1a261c,
    alpha: 0.28,
  });
  switch (look.species) {
    case 'maple':
    case 'cherry':
      drawBroadleaf(g, look, rng, clumps);
      break;
    case 'pine':
      drawPine(g, look, rng, clumps);
      break;
    case 'bamboo':
      drawBamboo(g, look, rng);
      break;
  }
  return { clumps };
}

/** Clé de cache : on ne redessine que si l'apparence change visiblement. */
export function treeLookKey(l: TreeLook): string {
  const q = (v: number, steps = 10) => Math.round(v * steps);
  return [
    l.species,
    l.seed,
    q(l.growth, 20),
    q(l.prune),
    q(l.season.foliage),
    q(l.season.autumn),
    q(l.season.sakura),
    q(l.snow, 4),
    q(l.thirst, 4),
    l.season.season,
  ].join(':');
}
